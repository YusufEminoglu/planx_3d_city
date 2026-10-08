// Mesh merging core shared by the building batcher and the static-layer
// batcher. Merges many small meshes into one mesh per (material look, tile):
//   - material colour moves into a vertex colour (multiplied with any existing
//     vertex colour), so meshes that differ only in colour share a material;
//   - the colour map's repeat/offset/rotation is baked into the UVs, so
//     clones of one texture share a single canonical texture;
//   - fully transparent materials are dropped.
// Meshes whose material cannot be merged safely are left untouched.
import * as THREE from 'three';

const MERGEABLE_TYPES = new Set([
  'MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial', 'MeshBasicMaterial'
]);
// Any of these would need its own UV transform or per-mesh data.
const OTHER_MAPS = ['alphaMap', 'aoMap', 'bumpMap', 'displacementMap', 'emissiveMap', 'envMap', 'lightMap',
  'metalnessMap', 'normalMap', 'roughnessMap', 'specularMap', 'clearcoatMap', 'sheenColorMap'];

function toByte(v) {
  return v <= 0 ? 0 : (v >= 1 ? 255 : Math.round(v * 255));
}

export function isInvisible(mat) {
  return !mat || mat.visible === false || (mat.transparent && mat.opacity <= 0.001);
}

export function isMergeableMaterial(mat) {
  if (!mat || !MERGEABLE_TYPES.has(mat.type) || mat.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return false;
  if (mat.wireframe) return false;
  for (const k of OTHER_MAPS) if (mat[k]) return false;
  return true;
}

function textureKey(map) {
  return `${map.source.uuid}:${map.wrapS}:${map.wrapT}:${map.colorSpace}:${map.magFilter}:${map.minFilter}:${map.anisotropy}`;
}

// Everything that changes how a material renders, except colour and map
// transform (those move into vertex data).
export function materialLookKey(mat, { ignoreEmissive = false } = {}) {
  const map = mat.map;
  return [
    mat.type,
    map ? textureKey(map) : '-',
    mat.side, mat.transparent ? 1 : 0, mat.opacity, mat.depthWrite ? 1 : 0, mat.depthTest ? 1 : 0,
    mat.alphaTest, mat.blending, mat.fog ? 1 : 0, mat.flatShading ? 1 : 0, mat.colorWrite ? 1 : 0,
    mat.roughness ?? '', mat.metalness ?? '', mat.shininess ?? '',
    !ignoreEmissive && mat.emissive ? `${mat.emissive.getHexString()}*${mat.emissiveIntensity}` : '',
    mat.polygonOffset ? `${mat.polygonOffsetFactor}:${mat.polygonOffsetUnits}` : ''
  ].join('|');
}

export class CanonicalTextures {
  constructor() { this.map = new Map(); }
  get(map) {
    if (!map) return null;
    const key = textureKey(map);
    let tex = this.map.get(key);
    if (!tex) {
      tex = map.clone();
      tex.repeat.set(1, 1);
      tex.offset.set(0, 0);
      tex.center.set(0, 0);
      tex.rotation = 0;
      tex.matrixAutoUpdate = true;
      tex.needsUpdate = true;
      this.map.set(key, tex);
    }
    return tex;
  }
  dispose() {
    for (const tex of this.map.values()) tex.dispose();
    this.map.clear();
  }
}

// Shared material for a bucket: the source look, white colour, vertex colours,
// and the canonical (untransformed) texture.
export function sharedMaterialFrom(src, textures) {
  const mat = src.clone();
  mat.map = textures.get(src.map);
  mat.color.setRGB(1, 1, 1);
  mat.vertexColors = true;
  return mat;
}

/**
 * Merge meshes into one mesh per bucket.
 * @param {THREE.Mesh[]} meshes
 * @param {object} opt
 *   tileSize       - metres; 0 disables tiling
 *   classify(mesh, materialIndex, isMultiMaterial) -> kind string, or null to drop the range
 *   keyOptions     - passed to materialLookKey
 *   perPiece(mesh, centre) -> { [attrName]: number } constant float attributes per mesh
 *   attributes     - perPiece attributes, in a fixed order: names, or
 *                    { name, unit: true } for values in [0, 1] (stored as
 *                    normalized bytes)
 *   makeMaterial(sourceMaterial, kind) -> THREE.Material
 *   onMesh(mergedMesh, bucket) - final touches (raycast, userData)
 * @returns {{ merged: THREE.Mesh[], consumed: THREE.Mesh[] }} consumed meshes
 *   were merged and can be removed; others were left alone.
 */
export function mergeMeshes(meshes, opt) {
  const tileSize = opt.tileSize || 0;
  const attrSpecs = (opt.attributes || []).map((a) => (typeof a === 'string' ? { name: a } : a));
  const buckets = new Map();
  const nonIndexed = new Map();
  const consumed = [];
  const box = new THREE.Box3();
  const centre = new THREE.Vector3();

  for (const mesh of meshes) {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.morphTargetInfluences) continue;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.every((m) => isInvisible(m) || isMergeableMaterial(m))) continue;
    let geo = mesh.geometry;
    if (!geo?.attributes?.position || geo.attributes.position.isInterleavedBufferAttribute) continue;
    if (Object.values(geo.attributes).some((a) => a.isInterleavedBufferAttribute)) continue;
    if (geo.index) {
      if (!nonIndexed.has(geo)) nonIndexed.set(geo, geo.toNonIndexed());
      geo = nonIndexed.get(geo);
    }
    if (!geo.attributes.normal) geo.computeVertexNormals();
    mesh.updateMatrix();
    if (!geo.boundingBox) geo.computeBoundingBox();
    box.copy(geo.boundingBox).applyMatrix4(mesh.matrix).getCenter(centre);
    const tile = tileSize ? `${Math.floor(centre.x / tileSize)}:${Math.floor(centre.z / tileSize)}` : '';
    const extra = opt.perPiece ? opt.perPiece(mesh, centre) : null;

    const total = geo.attributes.position.count;
    const multi = Array.isArray(mesh.material);
    const ranges = multi && geo.groups.length
      ? geo.groups.map((g) => ({ start: g.start, count: Math.min(g.count, total - g.start), mi: g.materialIndex }))
      : [{ start: 0, count: total, mi: 0 }];
    for (const r of ranges) {
      const mat = mats[r.mi];
      if (isInvisible(mat) || r.count <= 0) continue;
      const kind = opt.classify ? opt.classify(mesh, r.mi, multi) : 'mesh';
      if (kind == null) continue;
      const key = [materialLookKey(mat, opt.keyOptions), kind, mesh.castShadow ? 1 : 0, mesh.receiveShadow ? 1 : 0,
        mesh.renderOrder, mesh.frustumCulled ? 1 : 0, tile].join('#');
      let b = buckets.get(key);
      if (!b) {
        b = { source: mat, kind, mesh, pieces: [], vertexCount: 0 };
        buckets.set(key, b);
      }
      b.pieces.push({ geo, matrix: mesh.matrix, start: r.start, count: r.count, mat, extra });
      b.vertexCount += r.count;
    }
    consumed.push(mesh);
  }

  const normalMatrix = new THREE.Matrix3();
  const uvMatrix = new THREE.Matrix3();
  const merged = [];
  for (const b of buckets.values()) {
    // Compact storage: merged city meshes run to millions of vertices.
    // Normals as normalized int16, colours as normalized bytes, and UVs only
    // when the material samples a texture.
    const n = b.vertexCount;
    const pos = new Float32Array(n * 3);
    const nor = new Int16Array(n * 3);
    const uv = b.source.map ? new Float32Array(n * 2) : null;
    const col = new Uint8Array(n * 3);
    const extras = attrSpecs.map((a) => (a.unit ? new Uint8Array(n) : new Float32Array(n)));
    let o = 0;
    for (const p of b.pieces) {
      // Direct typed-array access: this loop touches every merged vertex.
      const P = p.geo.attributes.position.array;
      const N = p.geo.attributes.normal.array;
      const U = p.geo.attributes.uv?.array;
      const C = p.mat.vertexColors ? p.geo.attributes.color : null;
      const e = p.matrix.elements;
      const rigid = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[1] === 0 && e[2] === 0
        && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
      const end = p.start + p.count;
      if (rigid) {
        const tx = e[12], ty = e[13], tz = e[14];
        for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
          pos[j] = P[i * 3] + tx; pos[j + 1] = P[i * 3 + 1] + ty; pos[j + 2] = P[i * 3 + 2] + tz;
        }
        for (let i = p.start * 3, j = o * 3; i < end * 3; i++, j++) nor[j] = Math.round(N[i] * 32767);
      } else {
        normalMatrix.getNormalMatrix(p.matrix);
        const nm = normalMatrix.elements;
        for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
          const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
          pos[j] = e[0] * x + e[4] * y + e[8] * z + e[12];
          pos[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
          pos[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
          const mx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
          const my = nm[1] * nx + nm[4] * ny + nm[7] * nz;
          const mz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
          const len = (Math.hypot(mx, my, mz) || 1) / 32767;
          nor[j] = Math.round(mx / len); nor[j + 1] = Math.round(my / len); nor[j + 2] = Math.round(mz / len);
        }
      }
      if (U && uv) {
        const map = p.mat.map;
        if (map) {
          if (map.matrixAutoUpdate) map.updateMatrix();
          uvMatrix.copy(map.matrix);
        } else {
          uvMatrix.identity();
        }
        const um = uvMatrix.elements;
        for (let i = p.start, j = o * 2; i < end; i++, j += 2) {
          const u0 = U[i * 2], v0 = U[i * 2 + 1];
          uv[j] = um[0] * u0 + um[3] * v0 + um[6];
          uv[j + 1] = um[1] * u0 + um[4] * v0 + um[7];
        }
      }
      const { r, g, b: bl } = p.mat.color;
      if (C) {
        for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
          col[j] = toByte(C.getX(i) * r); col[j + 1] = toByte(C.getY(i) * g); col[j + 2] = toByte(C.getZ(i) * bl);
        }
      } else {
        const R = toByte(r), G = toByte(g), B = toByte(bl);
        for (let j = o * 3, k = 0; k < p.count; k++, j += 3) {
          col[j] = R; col[j + 1] = G; col[j + 2] = B;
        }
      }
      for (let a = 0; a < attrSpecs.length; a++) {
        const v = p.extra?.[attrSpecs[a].name] ?? 0;
        extras[a].fill(attrSpecs[a].unit ? toByte(v) : v, o, o + p.count);
      }
      o += p.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3, true));
    if (uv) geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3, true));
    attrSpecs.forEach((a, k) => geo.setAttribute(a.name, new THREE.BufferAttribute(extras[k], 1, !!a.unit)));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, opt.makeMaterial(b.source, b.kind));
    mesh.castShadow = b.mesh.castShadow;
    mesh.receiveShadow = b.mesh.receiveShadow;
    mesh.renderOrder = b.mesh.renderOrder;
    mesh.frustumCulled = b.mesh.frustumCulled;
    if (opt.onMesh) opt.onMesh(mesh, b);
    merged.push(mesh);
  }
  for (const g of nonIndexed.values()) g.dispose();
  return { merged, consumed };
}

// Replace `consumed` children of `group` with `merged`, disposing the
// originals' geometries and materials (textures are left alone: they are
// shared with caches and the canonical textures).
export function replaceChildren(group, consumed, merged) {
  // One pass: group.remove() per child is indexOf + splice, which is
  // quadratic over tens of thousands of meshes.
  const removed = new Set(consumed);
  const kept = group.children.filter((c) => !removed.has(c));
  group.children.length = 0;
  group.children.push(...kept);
  const geos = new Set();
  const mats = new Set();
  for (const mesh of consumed) {
    mesh.parent = null;
    mesh.dispatchEvent({ type: 'removed' });
    geos.add(mesh.geometry);
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) if (m) mats.add(m);
  }
  for (const g of geos) g.dispose();
  for (const m of mats) m.dispose();
  for (const m of merged) group.add(m);
}

// Static layers (blocks, roads, sidewalks, paths...) are built once per scene
// build and never touched per mesh afterwards, so their meshes can be merged
// wholesale. Each group keeps its own canonical textures, released on the
// next batch of that group (the previous merged meshes are gone by then).
const staticTextures = new WeakMap();
export function batchStaticGroup(group, { tileSize = 400 } = {}) {
  let textures = staticTextures.get(group);
  if (textures) textures.dispose();
  else staticTextures.set(group, (textures = new CanonicalTextures()));
  const meshes = group.children.filter((c) => c.isMesh);
  if (meshes.length < 2) return;
  const { merged, consumed } = mergeMeshes(meshes, {
    tileSize,
    makeMaterial: (src) => sharedMaterialFrom(src, textures)
  });
  replaceChildren(group, consumed, merged);
}
