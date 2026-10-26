// @ts-check
// Street surfaces: tileable asphalt and interlocking-paver textures with
// normal maps, and the road material that paints lane markings, stop lines,
// zebra crossings, tyre tracks and gutter grime in the fragment shader.
//
// Markings in the shader cost no geometry or draw calls, stay sharp at any
// distance (anti-aliased with screen-space derivatives) and never z-fight.
// Each road vertex carries its road frame:
//   aRoad  = (lateral m, right of the line positive; along m; half width; length)
//   aRoadB = (lanes per direction; one-way flag; signed distance along the
//             road to the nearest junction; that junction's clearance)
// A clearance > 0 marks a junction (a road end or a crossing road): markings
// stop short of it, and zebra crossings and stop lines are painted in front.
// Texture coordinates are world metres (scaled), so roads that overlap at a
// junction sample the same texels and their overlap cannot be seen.
import * as THREE from 'three';
import { rendererMaxAnisotropy } from './textures.js';

/** Metres covered by one asphalt / paver texture tile. */
export const ASPHALT_TILE_M = 6;
export const PAVER_TILE_M = 1.6;

// Tileable value noise on a size x size grid (wraps at the edges).
function valueNoise(size, cells, seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
  const out = new Float32Array(size * size);
  const k = cells / size;
  for (let y = 0; y < size; y++) {
    const gy = y * k;
    const y0 = Math.floor(gy);
    const fy = gy - y0;
    const sy = fy * fy * (3 - 2 * fy);
    const r0 = (y0 % cells) * cells;
    const r1 = ((y0 + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const gx = x * k;
      const x0 = Math.floor(gx);
      const fx = gx - x0;
      const sx = fx * fx * (3 - 2 * fx);
      const c0 = x0 % cells;
      const c1 = (x0 + 1) % cells;
      const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * sx;
      const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * sx;
      out[y * size + x] = a + (b - a) * sy;
    }
  }
  return out;
}

function fbm(size, octaves, seed) {
  const out = new Float32Array(size * size);
  let amp = 0.5;
  let total = 0;
  for (const cells of octaves) {
    const n = valueNoise(size, cells, seed + cells * 7919);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
    total += amp;
    amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(size, fill, colorSpace) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  fill(img.data);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = colorSpace;
  t.anisotropy = rendererMaxAnisotropy();
  return t;
}

// Tangent-space normal map from a tileable height field.
function normalMapFromHeight(height, size, strength) {
  return canvasTexture(size, (px) => {
    for (let y = 0; y < size; y++) {
      const up = ((y - 1 + size) % size) * size;
      const dn = ((y + 1) % size) * size;
      for (let x = 0; x < size; x++) {
        const l = (x - 1 + size) % size;
        const r = (x + 1) % size;
        const dx = (height[y * size + r] - height[y * size + l]) * strength;
        // Canvas rows run down, texture v runs up.
        const dy = (height[up + x] - height[dn + x]) * strength;
        const inv = 1 / Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        px[i] = Math.round((0.5 - 0.5 * dx * inv) * 255);
        px[i + 1] = Math.round((0.5 - 0.5 * dy * inv) * 255);
        px[i + 2] = Math.round((0.5 + 0.5 * inv) * 255);
        px[i + 3] = 255;
      }
    }
  }, THREE.NoColorSpace);
}

let asphaltCache = null;
/**
 * Neutral (near white) asphalt: the road colour comes from vertex colours.
 * Aggregate grains, binder mottling, a few sealed cracks and patches.
 * @returns {{ map: any, normalMap: any }}
 */
export function createAsphaltSurface() {
  if (asphaltCache) return asphaltCache;
  const size = 512;
  const rand = seededRandom(9157);
  const mottle = fbm(size, [4, 8, 16, 32], 11);
  const fine = fbm(size, [64, 128], 23);
  const lum = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  for (let i = 0; i < lum.length; i++) {
    lum[i] = 0.86 + (mottle[i] - 0.5) * 0.16 + (fine[i] - 0.5) * 0.12;
    height[i] = fine[i] * 0.6;
  }
  const put = (x, y, f) => {
    const xi = ((Math.round(x) % size) + size) % size;
    const yi = ((Math.round(y) % size) + size) % size;
    f(yi * size + xi);
  };
  // Aggregate: light and dark stones, 1-3 px, raised.
  for (let n = 0; n < 16000; n++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = rand() < 0.85 ? 0.7 : 1.6;
    const tone = rand() < 0.55 ? 0.62 + rand() * 0.12 : 1.0 + rand() * 0.12;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.2) continue;
        put(x + dx, y + dy, (i) => { lum[i] = lum[i] * 0.35 + tone * 0.65; height[i] += 0.9; });
      }
    }
  }
  // One repair patch: a little darker and smoother, with a sealed seam.
  {
    const x0 = rand() * size;
    const y0 = rand() * size;
    const w = 70 + rand() * 90;
    const h = 50 + rand() * 60;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y) < 1.5;
        put(x0 + x, y0 + y, (i) => {
          lum[i] = edge ? lum[i] * 0.85 : lum[i] * 0.96;
          height[i] = edge ? height[i] - 0.4 : height[i] * 0.75;
        });
      }
    }
  }
  // Sealed cracks: thin dark random walks.
  for (let n = 0; n < 7; n++) {
    let x = rand() * size;
    let y = rand() * size;
    let a = rand() * Math.PI * 2;
    const steps = 60 + rand() * 160;
    for (let s = 0; s < steps; s++) {
      a += (rand() - 0.5) * 0.7;
      x += Math.cos(a);
      y += Math.sin(a);
      put(x, y, (i) => { lum[i] *= 0.45; height[i] -= 1.4; });
      if (rand() < 0.3) put(x + 1, y, (i) => { lum[i] *= 0.7; height[i] -= 0.6; });
    }
  }
  const map = canvasTexture(size, (px) => {
    for (let i = 0; i < lum.length; i++) {
      const v = Math.max(0, Math.min(255, Math.round(lum[i] * 255)));
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = Math.min(255, v + 3);
      px[i * 4 + 3] = 255;
    }
  }, THREE.SRGBColorSpace);
  asphaltCache = { map, normalMap: normalMapFromHeight(height, size, 0.9) };
  return asphaltCache;
}

let paverCache = null;
/**
 * Interlocking concrete pavers (running bond, 20 x 10 cm) with bevelled
 * joints, near white: the sidewalk colour comes from vertex colours.
 * @returns {{ map: any, normalMap: any }}
 */
export function createPaverSurface() {
  if (paverCache) return paverCache;
  const size = 512;
  const rand = seededRandom(4421);
  const grain = fbm(size, [32, 64, 128], 5);
  const pxPerM = size / PAVER_TILE_M;
  const bw = 0.2 * pxPerM;
  const bh = 0.1 * pxPerM;
  const cols = Math.round(size / bw);
  const rows = Math.round(size / bh);
  const tones = new Float32Array(cols * rows).map(() => 0.84 + rand() * 0.16);
  const lum = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / bh) % rows;
    const fy = y - Math.floor(y / bh) * bh;
    const shift = (row % 2) * bw * 0.5;
    for (let x = 0; x < size; x++) {
      const xs = (x + shift) % size;
      const col = Math.floor(xs / bw) % cols;
      const fx = xs - Math.floor(xs / bw) * bw;
      const edge = Math.min(fx, bw - fx, fy, bh - fy);
      const bevel = Math.min(1, edge / 3);
      const i = y * size + x;
      const g = (grain[i] - 0.5) * 0.14;
      lum[i] = edge < 1 ? 0.5 : tones[row * cols + col] * (0.82 + 0.18 * bevel) + g;
      height[i] = bevel + g * 0.5;
    }
  }
  const map = canvasTexture(size, (px) => {
    for (let i = 0; i < lum.length; i++) {
      const v = Math.max(0, Math.min(255, Math.round(lum[i] * 255)));
      px[i * 4] = v;
      px[i * 4 + 1] = v;
      px[i * 4 + 2] = v;
      px[i * 4 + 3] = 255;
    }
  }, THREE.SRGBColorSpace);
  paverCache = { map, normalMap: normalMapFromHeight(height, size, 1.4) };
  return paverCache;
}

// Shared by every road material, so toggling markings is one uniform write.
const roadUniforms = {
  uRoadMarkings: { value: 1 },
  uRoadCrosswalks: { value: 1 }
};

/** @param {{ markings: boolean, crosswalks: boolean }} opts */
export function setRoadMarkingFlags({ markings, crosswalks }) {
  roadUniforms.uRoadMarkings.value = markings ? 1 : 0;
  roadUniforms.uRoadCrosswalks.value = crosswalks ? 1 : 0;
}

const ROAD_FRAGMENT_COMMON = `
varying vec4 vRoad;
varying vec4 vRoadB;
uniform float uRoadMarkings;
uniform float uRoadCrosswalks;
float roadBand(float x, float centre, float halfWidth) {
  float w = fwidth(x) * 0.75 + 1e-4;
  return smoothstep(halfWidth + w, halfWidth - w, abs(x - centre));
}
float roadBandW(float x, float centre, float halfWidth, float w) {
  return smoothstep(halfWidth + w, halfWidth - w, abs(x - centre));
}
float roadDash(float a, float on, float period) {
  float m = mod(a, period);
  float w = fwidth(a) + 1e-4;
  return smoothstep(0.0, w, m) * smoothstep(on + w, on, m);
}
`;

// After <color_fragment>: diffuseColor = map * vertex colour * colour.
const ROAD_FRAGMENT_MAIN = `
{
  float lat = vRoad.x;
  float along = vRoad.y;
  float hw = vRoad.z;
  float len = vRoad.w;
  float lanes = max(1.0, vRoadB.x);
  // 0: two-way, 1: one-way along the line, 2: one-way against it.
  float oneway = step(0.5, vRoadB.y);
  float onewayBack = step(1.5, vRoadB.y);
  float dJ = vRoadB.z;
  float hasJ = step(0.01, vRoadB.w);
  // Distance beyond the junction box (< 0 inside it).
  float dist = mix(1e4, abs(dJ) - vRoadB.w, hasJ);
  // 1 on open road, 0 inside a junction box.
  float open = smoothstep(-0.2, 0.2, dist);
  float alat = abs(lat);
  // Large-scale variation breaks the texture repeat.
#ifdef USE_MAP
  float big = texture2D(map, vMapUv * 0.071).r;
#else
  float big = 0.9;
#endif
  diffuseColor.rgb *= mix(0.86, 1.08, big);
  // Gutter grime along the curbs, darker tyre tracks in each lane.
  diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(hw - 0.7, hw, alat) * open;
  float laneW = (oneway > 0.5 ? 2.0 * hw : hw) / lanes;
  float laneLat = oneway > 0.5 ? lat + hw : alat;
  float inLane = fract(laneLat / laneW) * laneW - laneW * 0.5;
  float tracks = roadBand(abs(inLane), 0.85, 0.28);
  diffuseColor.rgb *= 1.0 - 0.07 * tracks * open;
  float paint = 0.0;
  if (uRoadMarkings > 0.5 && hw >= 2.4) {
    // Edge lines.
    if (hw >= 3.0) paint += roadBand(alat, hw - 0.32, 0.07);
    // Centre: dashed, or double solid on wide two-way roads.
    if (oneway < 0.5) {
      if (hw >= 6.0) paint += roadBand(alat, 0.13, 0.06);
      else paint += roadBand(lat, 0.0, 0.065) * roadDash(along, 3.0, 8.0);
    }
    // Lane dividers between lanes of one direction.
    for (int k = 1; k < 4; k++) {
      float fk = float(k);
      if (fk >= lanes) break;
      float off = oneway > 0.5 ? -hw + fk * laneW : fk * laneW;
      float x = oneway > 0.5 ? lat : alat;
      paint += roadBand(x, off, 0.06) * roadDash(along, 3.0, 9.0);
    }
    paint *= open;
    // Stop lines across the incoming lanes (right of travel) at junctions.
    float stopAt = uRoadCrosswalks > 0.5 ? 5.0 : 0.6;
    // Traffic along the line meets the junction from dJ < 0 in the right
    // half (lat > 0), traffic against it from dJ > 0 in the left half.
    float ahead = step(dJ, 0.0);
    float twoWayIn = mix(step(lat, 0.0), step(0.0, lat), ahead);
    float onewayIn = mix(ahead, 1.0 - ahead, onewayBack);
    float incoming = hasJ * mix(twoWayIn, onewayIn, oneway);
    float stopBar = step(alat, hw - 0.35);
    paint += roadBand(dist, stopAt, 0.2) * incoming * stopBar;
  }
  if (uRoadCrosswalks > 0.5 && hw >= 2.4) {
    // Zebra crossings in front of junction ends: 0.5 m bars every metre.
    float stripes = roadBandW(fract(lat + 0.25), 0.5, 0.25, fwidth(lat) * 0.75 + 1e-4) * step(alat, hw - 0.25);
    paint += stripes * hasJ * roadBand(dist, 2.7, 1.5);
  }
  paint = clamp(paint, 0.0, 1.0);
  // Worn white paint, not multiplied by the road colour.
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78) * mix(0.8, 1.0, big), paint * 0.92);
  roadPaint = paint;
}
`;

/**
 * Road material with shader markings. The geometry needs aRoad and aRoadB.
 * @param {{ map?: any, normalMap?: any, roughness?: number, markings?: boolean }} opts
 */
export function createRoadMaterial({ map = null, normalMap = null, roughness = 0.94, markings = true } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    normalMap,
    roughness,
    metalness: 0,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  if (normalMap) mat.normalScale.set(0.7, 0.7);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRoadMarkings = markings ? roadUniforms.uRoadMarkings : { value: 0 };
    shader.uniforms.uRoadCrosswalks = markings ? roadUniforms.uRoadCrosswalks : { value: 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aRoad;\nattribute vec4 aRoadB;\nvarying vec4 vRoad;\nvarying vec4 vRoadB;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRoad = aRoad;\nvRoadB = aRoadB;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${ROAD_FRAGMENT_COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat roadPaint = 0.0;\n${ROAD_FRAGMENT_MAIN}`)
      // Paint is a little smoother than the asphalt around it.
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.7, roadPaint);');
  };
  mat.customProgramCacheKey = () => `planx-road-${markings ? 1 : 0}`;
  return mat;
}
