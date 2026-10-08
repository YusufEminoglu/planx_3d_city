// Building batching: collapses the per-building meshes produced by
// buildBuildingLayer into a handful of merged meshes.
//
// The builder creates one mesh (and one material) per wall volume, roof and
// floor slab, which costs tens of thousands of draw calls on a real city.
// batchBuildingGroup() walks those meshes once, and re-emits them as one merged
// mesh per (material look, spatial tile):
//   - per-building colour moves into a vertex colour, so buildings that differ
//     only in colour share a material;
//   - texture repeat/offset (the per-floor-count facade clones) is baked into
//     the UVs, so they share the base texture;
//   - fully transparent helper caps are dropped;
//   - a planxId vertex attribute keeps the link back to each building's
//     properties for hover, click and fly-to;
//   - a planxGlow attribute keeps the per-building night window brightness.
// Tiles keep frustum culling and raycasting effective on large scenes.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

const TILE_SIZE = 240; // metres, local scene units
export const SLAB_NAME = 'planx-floor-slab';
const HOVER_COLOR = new THREE.Color(0x1a5c44).multiplyScalar(1.4);
const NIGHT_EMISSIVE = 0x333322;

// Shared by every batched material, so hover is one uniform write.
const sharedUniforms = {
  uPlanxHover: { value: -1 },
  uPlanxHoverColor: { value: HOVER_COLOR }
};

let records = [];

function isInvisible(mat) {
  return !mat || mat.visible === false || (mat.transparent && mat.opacity <= 0.001);
}

function materialKey(mat, kind, mesh) {
  const map = mat.map;
  return [
    mat.type,
    map ? `${map.source.uuid}:${map.wrapS}:${map.wrapT}:${map.colorSpace}` : '-',
    mat.side, mat.transparent ? 1 : 0, mat.opacity, mat.depthWrite ? 1 : 0,
    mat.roughness ?? '', mat.metalness ?? '',
    mat.polygonOffset ? `${mat.polygonOffsetFactor}:${mat.polygonOffsetUnits}` : '',
    kind,
    mesh.castShadow ? 1 : 0, mesh.receiveShadow ? 1 : 0, mesh.renderOrder
  ].join('|');
}

const canonicalTextures = new Map();
function canonicalTexture(map) {
  if (!map) return null;
  const key = `${map.source.uuid}:${map.wrapS}:${map.wrapT}:${map.colorSpace}`;
  let tex = canonicalTextures.get(key);
  if (!tex) {
    tex = map.clone();
    tex.repeat.set(1, 1);
    tex.offset.set(0, 0);
    tex.center.set(0, 0);
    tex.rotation = 0;
    tex.matrixAutoUpdate = true;
    tex.needsUpdate = true;
    canonicalTextures.set(key, tex);
  }
  return tex;
}

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

function makeSharedMaterial(src, isWall, isNight) {
  const mat = src.clone();
  mat.map = canonicalTexture(src.map);
  mat.color.setRGB(1, 1, 1);
  mat.vertexColors = true;
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
  for (const tex of canonicalTextures.values()) tex.dispose();
  canonicalTextures.clear();
  const recordIds = new Map();
  const buckets = new Map();
  const nonIndexedCache = new Map();
  const tmpBox = new THREE.Box3();
  const tmpCenter = new THREE.Vector3();
  const uvMatrix = new THREE.Matrix3();

  for (const mesh of meshes) {
    mesh.updateMatrix();
    let geo = mesh.geometry;
    if (geo.index) {
      if (!nonIndexedCache.has(geo)) nonIndexedCache.set(geo, geo.toNonIndexed());
      geo = nonIndexedCache.get(geo);
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const data = mesh.userData;
    let rid = -1;
    if (data && Object.keys(data).length) {
      if (!recordIds.has(data)) {
        recordIds.set(data, records.length);
        records.push(data);
      }
      rid = recordIds.get(data);
    }
    if (!geo.boundingBox) geo.computeBoundingBox();
    tmpBox.copy(geo.boundingBox).applyMatrix4(mesh.matrix).getCenter(tmpCenter);
    const tile = `${Math.floor(tmpCenter.x / TILE_SIZE)}:${Math.floor(tmpCenter.z / TILE_SIZE)}`;
    // Builder meshes sit at x = z = 0 (geometry is in scene coordinates), so
    // hash the footprint centre rather than the mesh position.
    const glow = glowFor(tmpCenter.x, tmpCenter.z);

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const total = geo.attributes.position.count;
    const ranges = Array.isArray(mesh.material) && geo.groups.length
      ? geo.groups.map((g) => ({ start: g.start, count: Math.min(g.count, total - g.start), mi: g.materialIndex }))
      : [{ start: 0, count: total, mi: 0 }];
    for (const r of ranges) {
      const mat = mats[r.mi];
      if (isInvisible(mat) || r.count <= 0) continue;
      // Wall materials are the second slot of the [cap, wall] pair; floor
      // slabs are tagged by the builder.
      const kind = mesh.name === SLAB_NAME ? 'slab' : (Array.isArray(mesh.material) && r.mi === 1 ? 'wall' : 'other');
      const key = `${materialKey(mat, kind, mesh)}#${tile}`;
      let b = buckets.get(key);
      if (!b) {
        b = { source: mat, kind, mesh, pieces: [], vertexCount: 0 };
        buckets.set(key, b);
      }
      b.pieces.push({ geo, matrix: mesh.matrix, start: r.start, count: r.count, color: mat.color, map: mat.map, rid, glow });
      b.vertexCount += r.count;
    }
  }

  const normalMatrix = new THREE.Matrix3();
  const merged = [];
  for (const b of buckets.values()) {
    const n = b.vertexCount;
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const ids = new Float32Array(n);
    const glow = new Float32Array(n);
    let o = 0;
    for (const p of b.pieces) {
      // Direct typed-array access: this loop touches every vertex of the city.
      const P = p.geo.attributes.position.array;
      const N = p.geo.attributes.normal.array;
      const U = p.geo.attributes.uv?.array;
      const e = p.matrix.elements;
      const rigid = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[1] === 0 && e[2] === 0
        && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
      normalMatrix.getNormalMatrix(p.matrix);
      const nm = normalMatrix.elements;
      if (p.map) {
        if (p.map.matrixAutoUpdate) p.map.updateMatrix();
        uvMatrix.copy(p.map.matrix);
      } else {
        uvMatrix.identity();
      }
      const um = uvMatrix.elements;
      const end = p.start + p.count;
      if (rigid) {
        const tx = e[12], ty = e[13], tz = e[14];
        for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
          pos[j] = P[i * 3] + tx; pos[j + 1] = P[i * 3 + 1] + ty; pos[j + 2] = P[i * 3 + 2] + tz;
        }
        nor.set(N.subarray(p.start * 3, end * 3), o * 3);
      } else {
        for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
          const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
          pos[j] = e[0] * x + e[4] * y + e[8] * z + e[12];
          pos[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          pos[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
          const mx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
          const my = nm[1] * nx + nm[4] * ny + nm[7] * nz;
          const mz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
          const len = Math.hypot(mx, my, mz) || 1;
          nor[j] = mx / len; nor[j + 1] = my / len; nor[j + 2] = mz / len;
        }
      }
      if (U) {
        for (let i = p.start, j = o * 2; i < end; i++, j += 2) {
          const u0 = U[i * 2], v0 = U[i * 2 + 1];
          uv[j] = um[0] * u0 + um[3] * v0 + um[6];
          uv[j + 1] = um[1] * u0 + um[4] * v0 + um[7];
        }
      }
      const { r, g, b: bl } = p.color;
      for (let j = o * 3, k = o; k < o + p.count; k++, j += 3) {
        col[j] = r; col[j + 1] = g; col[j + 2] = bl;
      }
      ids.fill(p.rid, o, o + p.count);
      glow.fill(p.glow, o, o + p.count);
      o += p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('planxId', new THREE.BufferAttribute(ids, 1));
    geo.setAttribute('planxGlow', new THREE.BufferAttribute(glow, 1));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, makeSharedMaterial(b.source, b.kind === 'wall', isNight));
    mesh.raycast = lazyBvhRaycast;
    mesh.castShadow = b.mesh.castShadow;
    mesh.receiveShadow = b.mesh.receiveShadow;
    mesh.renderOrder = b.mesh.renderOrder;
    mesh.userData = { planxBatch: true, planxLodSlab: b.kind === 'slab' };
    merged.push(mesh);
  }

  // Release the per-building originals (their textures stay: they are shared
  // with the facade/roof caches and the canonical textures).
  const disposedGeos = new Set();
  const disposedMats = new Set();
  // Detach in one pass: group.remove() per child is indexOf + splice, which
  // is quadratic over tens of thousands of meshes.
  const removed = new Set(meshes);
  const kept = group.children.filter((c) => !removed.has(c));
  group.children.length = 0;
  group.children.push(...kept);
  for (const mesh of meshes) {
    mesh.parent = null;
    mesh.dispatchEvent({ type: 'removed' });
    if (!disposedGeos.has(mesh.geometry)) { mesh.geometry.dispose(); disposedGeos.add(mesh.geometry); }
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (m && !disposedMats.has(m)) { m.dispose(); disposedMats.add(m); }
    }
  }
  for (const g of nonIndexedCache.values()) g.dispose();
  for (const m of merged) group.add(m);
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
