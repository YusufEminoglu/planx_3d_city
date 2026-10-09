// Merged building meshes: one mesh per (material look, spatial tile) instead
// of one mesh and material per wall, roof and floor slab (tens of thousands
// of draw calls on a real city). The geometry is built and merged in
// building_geometry.js (in workers when available); here the buffers become
// meshes with shared materials, plus:
//   - a planxId vertex attribute links each vertex to its building's
//     properties for hover, click and fly-to;
//   - a planxGlow attribute sets each building's share of lit windows at
//     night (single windows light up on a grid estimated from the facade).
// Tiles keep frustum culling and raycasting effective on large scenes.
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { CanonicalTextures, sharedMaterialFrom } from './mesh_merge.js';

export const BUILDING_TILE_SIZE = 400; // metres, local scene units
const HOVER_COLOR = new THREE.Color(0x1a5c44).multiplyScalar(1.4);
const NIGHT_EMISSIVE = 0x333322;
// Lit window radiance relative to NIGHT_EMISSIVE (linear): bright enough to
// reach the night bloom threshold.
const WINDOW_GAIN = 45;

// Shared by every batched material, so hover is one uniform write.
const sharedUniforms = {
  uPlanxHover: { value: -1 },
  uPlanxHoverColor: { value: HOVER_COLOR }
};

let records = [];
const textures = new CanonicalTextures();

// Facade textures are photos or drawings of a regular window grid. To light
// single windows at night the shader needs that grid: the number of window
// columns and rows per texture tile, where the cell edges fall (on the wall
// between windows) and how dark glass is. It is estimated once per texture
// from luminance profiles, so any facade image works without metadata.
const windowGridCache = new WeakMap();
const DEFAULT_WINDOW_GRID = { grid: [3, 3], offset: [0, 0], rect: [0.25, 0.2, 0.75, 0.8], lum: [0.05, 0.12] };

function luminanceImage(image, size) {
  if (!image || typeof document === 'undefined') return null;
  const w = image.width || image.videoWidth;
  const h = image.height || image.videoHeight;
  if (!w || !h) return null;
  try {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    const lum = new Float32Array(size * size);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
    }
    return lum;
  } catch {
    return null; // tainted or undrawable (compressed) image
  }
}

// Repeat count of a periodic profile over one tile, and where its cells start
// (as a fraction of one period) so that each window sits in a cell centre.
function profilePeriod(profile) {
  const n = profile.length;
  let mean = 0;
  for (const v of profile) mean += v;
  mean /= n;
  let variance = 0;
  for (const v of profile) variance += (v - mean) ** 2;
  if (variance < 1e-6) return null;
  const scores = [];
  for (let count = 2; count <= 12; count++) {
    const shift = n / count;
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + shift) % n;
      const j0 = Math.floor(j);
      const f = j - j0;
      const v = profile[j0] * (1 - f) + profile[(j0 + 1) % n] * f;
      acc += (profile[i] - mean) * (v - mean);
    }
    scores.push({ count, score: acc / variance });
  }
  const best = Math.max(...scores.map((s) => s.score));
  if (best < 0.3) return null;
  // A shift of two periods correlates as well as one: take the finest grid
  // that is nearly as periodic as the best.
  const count = Math.max(...scores.filter((s) => s.score >= best * 0.85).map((s) => s.count));
  const period = n / count;
  // Fold the profile over one period; windows are its darkest part, so centre
  // the cell on the darkest (smoothed) bin and put its edges on the wall.
  const bins = new Float32Array(Math.max(4, Math.round(period)));
  for (let i = 0; i < n; i++) bins[Math.floor((i % period) / period * bins.length) % bins.length] += profile[i];
  const half = Math.max(1, Math.round(bins.length / 8));
  let darkest = 0;
  let darkestSum = Infinity;
  for (let i = 0; i < bins.length; i++) {
    let acc = 0;
    for (let k = -half; k <= half; k++) acc += bins[(i + k + bins.length) % bins.length];
    if (acc < darkestSum) { darkestSum = acc; darkest = i; }
  }
  const centre = (darkest + 0.5) / bins.length;
  return { count, offset: (centre - 0.5 + 1) % 1 };
}

// The window inside a cell: average every cell of the texture into one (so
// balconies, shutters and ornaments that only some cells have fade out),
// then measure the dark opening around the cell centre. Returns its rectangle
// in cell-local texture coordinates and its luminance range (linear).
const CELL_BINS = 24;
function windowShape(lum, size, grid, offset) {
  const sum = new Float32Array(CELL_BINS * CELL_BINS);
  const cnt = new Float32Array(CELL_BINS * CELL_BINS);
  for (let y = 0; y < size; y++) {
    const cv = (1 - (y + 0.5) / size) * grid[1] - offset[1];
    const by = Math.min(CELL_BINS - 1, Math.floor((cv - Math.floor(cv)) * CELL_BINS));
    for (let x = 0; x < size; x++) {
      const cu = ((x + 0.5) / size) * grid[0] - offset[0];
      const bx = Math.min(CELL_BINS - 1, Math.floor((cu - Math.floor(cu)) * CELL_BINS));
      sum[by * CELL_BINS + bx] += lum[y * size + x];
      cnt[by * CELL_BINS + bx] += 1;
    }
  }
  const avg = sum.map((v, i) => (cnt[i] ? v / cnt[i] : 1));
  // Cells are centred on windows: grow from the centre along the column and
  // row profiles (taken through the middle of the cell) while it stays darker
  // than halfway between the centre and the surrounding wall.
  const lo = CELL_BINS >> 2;
  const hi = CELL_BINS - lo;
  const colProfile = new Float32Array(CELL_BINS);
  const rowProfile = new Float32Array(CELL_BINS);
  for (let y = 0; y < CELL_BINS; y++) {
    for (let x = 0; x < CELL_BINS; x++) {
      const v = avg[y * CELL_BINS + x];
      if (y >= lo && y < hi) colProfile[x] += v / (hi - lo);
      if (x >= lo && x < hi) rowProfile[y] += v / (hi - lo);
    }
  }
  const extent = (raw) => {
    // Smooth over mullions and bars, then grow from the centre.
    const prof = raw.map((_, i) => {
      let acc = 0;
      for (let k = -2; k <= 2; k++) acc += raw[Math.min(CELL_BINS - 1, Math.max(0, i + k))];
      return acc / 5;
    });
    const c = CELL_BINS >> 1;
    const inner = Math.min(prof[c - 1], prof[c]);
    const wall = Math.max(...prof);
    if (wall - inner < 0.03) return null;
    const limit = inner + 0.5 * (wall - inner);
    let a = c - 1;
    let b = c;
    while (a > 0 && prof[a - 1] < limit) a--;
    while (b < CELL_BINS - 1 && prof[b + 1] < limit) b++;
    // Windows sit in the cell centre: keep the narrower side (a cornice or
    // sill shadow can extend one side) and stay between 30% and 80% of the cell.
    const halfBins = Math.min(c - a, b + 1 - c);
    const half = Math.min(0.4, Math.max(0.15, halfBins / CELL_BINS));
    return [0.5 - half, 0.5 + half];
  };
  const ex = extent(colProfile);
  const ey = extent(rowProfile);
  const rect = (ex && ey) ? [ex[0], ey[0], ex[1], ey[1]] : DEFAULT_WINDOW_GRID.rect;
  // Luminance band of the window area, to keep frames and bars a little darker.
  const inside = [];
  for (let y = Math.floor(rect[1] * CELL_BINS); y < Math.ceil(rect[3] * CELL_BINS); y++) {
    for (let x = Math.floor(rect[0] * CELL_BINS); x < Math.ceil(rect[2] * CELL_BINS); x++) inside.push(avg[y * CELL_BINS + x]);
  }
  inside.sort((p, q) => p - q);
  const toLinear = (c) => Math.pow(Math.max(0, c), 2.2);
  const band = inside.length ? [inside[0], inside[inside.length - 1]] : [0.1, 0.4];
  return { rect, lum: [toLinear(band[0]), toLinear(Math.max(band[1], band[0] + 0.05))] };
}

export function estimateWindowGrid(texture) {
  const source = texture?.source;
  if (!source) return DEFAULT_WINDOW_GRID;
  if (windowGridCache.has(source)) return windowGridCache.get(source);
  const size = 128;
  const lum = luminanceImage(source.data, size);
  let result = DEFAULT_WINDOW_GRID;
  if (lum) {
    const cols = new Float32Array(size);
    const rows = new Float32Array(size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        cols[x] += lum[y * size + x] / size;
        rows[y] += lum[y * size + x] / size;
      }
    }
    const u = profilePeriod(cols);
    const v = profilePeriod(rows);
    const grid = [u ? u.count : 3, v ? v.count : 3];
    // Image rows run top to bottom, texture v bottom to top (flipY).
    const offset = [u ? u.offset : 0, v ? (1 - v.offset) % 1 : 0];
    result = { grid, offset, ...windowShape(lum, size, grid, offset) };
  }
  windowGridCache.set(source, result);
  return result;
}

function patchMaterial(mat, windows) {
  const winUniforms = {
    uPlanxWinGrid: { value: new THREE.Vector2(...(windows?.grid || [1, 1])) },
    uPlanxWinOffset: { value: new THREE.Vector2(...(windows?.offset || [0, 0])) },
    uPlanxWinRect: { value: new THREE.Vector4(...(windows?.rect || [0, 0, 1, 1])) },
    uPlanxWinLum: { value: new THREE.Vector2(...(windows?.lum || [0, 0])) },
    uPlanxWindows: { value: windows ? 1 : 0 }
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanxHover = sharedUniforms.uPlanxHover;
    shader.uniforms.uPlanxHoverColor = sharedUniforms.uPlanxHoverColor;
    Object.assign(shader.uniforms, winUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float planxId;\nattribute float planxGlow;\nvarying float vPlanxId;\nvarying float vPlanxGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlanxId = planxId;\nvPlanxGlow = planxGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform float uPlanxHover;',
        'uniform vec3 uPlanxHoverColor;',
        'uniform vec2 uPlanxWinGrid;',
        'uniform vec2 uPlanxWinOffset;',
        'uniform vec4 uPlanxWinRect;',
        'uniform vec2 uPlanxWinLum;',
        'uniform float uPlanxWindows;',
        'varying float vPlanxId;',
        'varying float vPlanxGlow;',
        'float planxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }'
      ].join('\n'))
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        '#ifdef USE_MAP',
        'if (uPlanxWindows > 0.5) {',
        // One cell per window; each building lights its own random share
        // (planxGlow), in warm or cool light, with a little per-window dimming.
        '  vec2 planxGridUv = vMapUv * uPlanxWinGrid - uPlanxWinOffset;',
        '  vec2 planxCell = floor(planxGridUv);',
        '  vec2 planxLocal = planxGridUv - planxCell;',
        '  float planxInRect = step(uPlanxWinRect.x, planxLocal.x) * step(planxLocal.x, uPlanxWinRect.z) * step(uPlanxWinRect.y, planxLocal.y) * step(planxLocal.y, uPlanxWinRect.w);',
        '  float planxH = planxHash(planxCell + vec2(vPlanxId * 0.731, vPlanxId * 0.197));',
        '  float planxLit = step(1.0 - vPlanxGlow * 0.7, planxH);',
        '  float planxLum = dot(sampledDiffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));',
        '  float planxGlass = 1.0 - 0.5 * smoothstep(uPlanxWinLum.x, uPlanxWinLum.y, planxLum);',
        '  vec3 planxTint = mix(vec3(1.0, 0.78, 0.5), vec3(0.8, 0.88, 1.0), step(0.82, fract(planxH * 17.0)));',
        `  totalEmissiveRadiance *= planxTint * planxGlass * planxInRect * planxLit * (0.6 + 0.4 * fract(planxH * 31.0)) * ${WINDOW_GAIN.toFixed(1)};`,
        '} else {',
        '  totalEmissiveRadiance *= vPlanxGlow;',
        '}',
        '#else',
        'totalEmissiveRadiance *= vPlanxGlow;',
        '#endif',
        'if (abs(vPlanxId - uPlanxHover) < 0.5) totalEmissiveRadiance = uPlanxHoverColor;'
      ].join('\n'));
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
    patchMaterial(mat, isWall && mat.map ? estimateWindowGrid(mat.map) : null);
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
