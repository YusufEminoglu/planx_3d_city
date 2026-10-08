// Building batching: collapses the per-building meshes produced by
// buildBuildingLayer into a handful of merged meshes.
//
// The builder creates one mesh (and one material) per wall volume, roof and
// floor slab, which costs tens of thousands of draw calls on a real city.
// batchBuildingGroup() merges them per (material look, spatial tile) through
// mesh_merge.js (colour -> vertex colour, texture repeat -> UVs), plus:
//   - a planxId vertex attribute keeps the link back to each building's
//     properties for hover, click and fly-to;
//   - a planxGlow attribute keeps the per-building night window brightness.
// Tiles keep frustum culling and raycasting effective on large scenes.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { CanonicalTextures, mergeMeshes, replaceChildren, sharedMaterialFrom } from './mesh_merge.js';

const TILE_SIZE = 400; // metres, local scene units
export const SLAB_NAME = 'planx-floor-slab';
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

// Deterministic night window brightness in [0.2, 1.0] per building.
function glowFor(x, z) {
  return 0.2 + (Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) * 0.8;
}

export function batchBuildingGroup(group, { isNight = false } = {}) {
  const meshes = group.children.filter((c) => c.isMesh && !c.isInstancedMesh);
  if (!meshes.length) return;
  records = [];
  textures.dispose();
  const recordIds = new Map();
  const { merged, consumed } = mergeMeshes(meshes, {
    tileSize: TILE_SIZE,
    // Wall materials are the second slot of the [cap, wall] pair; floor slabs
    // are tagged by the builder.
    classify: (mesh, mi, multi) => (mesh.name === SLAB_NAME ? 'slab' : (multi && mi === 1 ? 'wall' : 'other')),
    // Night glow lives in planxGlow, so emissive must not split buckets.
    keyOptions: { ignoreEmissive: true },
    attributes: ['planxId', { name: 'planxGlow', unit: true }],
    perPiece: (mesh, centre) => {
      const data = mesh.userData;
      let rid = -1;
      if (data && Object.keys(data).length) {
        if (!recordIds.has(data)) {
          recordIds.set(data, records.length);
          records.push(data);
        }
        rid = recordIds.get(data);
      }
      // Builder meshes sit at x = z = 0 (geometry is in scene coordinates),
      // so hash the footprint centre rather than the mesh position.
      return { planxId: rid, planxGlow: glowFor(centre.x, centre.z) };
    },
    makeMaterial: (src, kind) => makeBuildingMaterial(src, kind === 'wall', isNight),
    onMesh: (mesh, bucket) => {
      mesh.raycast = lazyBvhRaycast;
      mesh.userData = { planxBatch: true, planxLodSlab: bucket.kind === 'slab' };
    }
  });
  replaceChildren(group, consumed, merged);
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
