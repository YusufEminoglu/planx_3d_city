// Merged building meshes: one mesh per (material look, spatial tile) instead
// of one mesh and material per wall, roof and floor slab (tens of thousands
// of draw calls on a real city). The geometry is built and merged in
// building_geometry.js (in workers when available); here the buffers become
// meshes with shared materials, plus:
//   - a planxId vertex attribute links each vertex to its building's
//     properties for hover, click and fly-to;
//   - a planxGlow attribute keeps the per-building night window brightness.
// Tiles keep frustum culling and raycasting effective on large scenes.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { CanonicalTextures, sharedMaterialFrom } from './mesh_merge.js';

export const BUILDING_TILE_SIZE = 400; // metres, local scene units
const HOVER_COLOR = new THREE.Color(0x1a5c44).multiplyScalar(1.4);
const NIGHT_EMISSIVE = 0x333322;

// Shared by every batched material, so hover is one uniform write.
const sharedUniforms = {
  uPlanxHover: { value: -1 },
  uPlanxHoverColor: { value: HOVER_COLOR }
};

let records = [];
const textures = new CanonicalTextures();

function patchMaterial(mat) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanxHover = sharedUniforms.uPlanxHover;
    shader.uniforms.uPlanxHoverColor = sharedUniforms.uPlanxHoverColor;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float planxId;\nattribute float planxGlow;\nvarying float vPlanxId;\nvarying float vPlanxGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlanxId = planxId;\nvPlanxGlow = planxGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPlanxHover;\nuniform vec3 uPlanxHoverColor;\nvarying float vPlanxId;\nvarying float vPlanxGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vPlanxGlow;\nif (abs(vPlanxId - uPlanxHover) < 0.5) totalEmissiveRadiance = uPlanxHoverColor;');
  };
  mat.customProgramCacheKey = () => 'planx-building-batch';
}

function makeBuildingMaterial(src, isWall, isNight) {
  const mat = sharedMaterialFrom(src, textures);
  mat.userData = { planxBatchWall: isWall };
  if (mat.emissive) {
    if (isWall) {
      mat.emissive.setHex(NIGHT_EMISSIVE);
      mat.emissiveIntensity = isNight ? 1 : 0;
    }
    patchMaterial(mat);
  }
  return mat;
}

// Merged tiles hold hundreds of thousands of triangles, so a brute-force
// raycast (hover, click, shadow heatmap) would test every one. The BVH is
// built on first use, keeping it off the scene-load path.
function lazyBvhRaycast(raycaster, intersects) {
  if (!this.geometry.boundsTree) this.geometry.boundsTree = new MeshBVH(this.geometry);
  return acceleratedRaycast.call(this, raycaster, intersects);
}

/**
 * Turn merged building buffers (buildBuildingBuckets / the worker pool) into
 * meshes in `group`.
 * looks[id] = { material (template), kind: 'wall' | 'slab' | 'other',
 *               castShadow, receiveShadow, renderOrder }
 * buildingRecords[planxId] = the building's properties, for picking.
 */
export function addBuildingBuckets(group, buckets, looks, buildingRecords, { isNight = false } = {}) {
  records = buildingRecords;
  textures.dispose();
  const materials = new Map();
  for (const b of buckets) {
    const look = looks[b.lookId];
    if (!look) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(b.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(b.normal, 3, true));
    if (b.uv) geo.setAttribute('uv', new THREE.BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(b.color, 3, true));
    geo.setAttribute('planxId', new THREE.BufferAttribute(b.planxId, 1));
    geo.setAttribute('planxGlow', new THREE.BufferAttribute(b.planxGlow, 1, true));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    // One shared material per look; tiles of the same look reuse it.
    let mat = materials.get(b.lookId);
    if (!mat) materials.set(b.lookId, (mat = makeBuildingMaterial(look.material, look.kind === 'wall', isNight)));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.raycast = lazyBvhRaycast;
    mesh.castShadow = look.castShadow;
    mesh.receiveShadow = look.receiveShadow;
    mesh.renderOrder = look.renderOrder;
    mesh.userData = { planxBatch: true, planxLodSlab: look.kind === 'slab' };
    group.add(mesh);
  }
}

// Building properties for a raycast hit on either a batched or a plain mesh.
export function buildingHitData(hit) {
  const obj = hit?.object;
  if (!obj) return {};
  if (obj.userData?.planxBatch) {
    const ids = obj.geometry.attributes.planxId;
    const id = hit.face ? ids.getX(hit.face.a) : -1;
    return records[id] || {};
  }
  return obj.userData || {};
}

// Stable identity for hover bookkeeping: the building record id, or the mesh.
export function buildingHitKey(hit) {
  const obj = hit?.object;
  if (obj?.userData?.planxBatch) return hit.face ? obj.geometry.attributes.planxId.getX(hit.face.a) : -1;
  return obj;
}

export function setHoveredBuildingId(id) {
  sharedUniforms.uPlanxHover.value = (typeof id === 'number' && id >= 0) ? id : -1;
}

export function setBatchedBuildingNight(group, isNight) {
  for (const mesh of group.children) {
    const mat = mesh.material;
    if (!mesh.userData?.planxBatch || !mat?.userData?.planxBatchWall || !mat.emissive) continue;
    mat.emissive.setHex(NIGHT_EMISSIVE);
    mat.emissiveIntensity = isNight ? 1 : 0;
  }
}

export function buildingPickTargets(group) {
  return group.children;
}

// Floor slabs are thin ledges: past SLAB_LOD_DISTANCE they are sub-pixel but
// still make up a large share of the triangles, so their tiles are hidden.
const SLAB_LOD_DISTANCE = 550;
const lodSphere = new THREE.Sphere();
export function updateBuildingLod(group, camera) {
  for (const mesh of group.children) {
    if (!mesh.userData?.planxLodSlab) continue;
    const bs = mesh.geometry.boundingSphere;
    if (!bs) continue;
    lodSphere.copy(bs).applyMatrix4(mesh.matrixWorld);
    mesh.visible = camera.position.distanceTo(lodSphere.center) - lodSphere.radius < SLAB_LOD_DISTANCE;
  }
}
