// @ts-check
// Dynamic facades: windows, frames, sills, shutters, balconies, shopfronts
// and entrances drawn in the fragment shader on the bay x floor grid that
// prismGeometry() puts on every wall (u = bays along the wall, whole bays
// per wall; v = floors from the ground). Only the wall material (plaster,
// render, brick, stone, concrete) is a texture. Every building varies its
// window proportions, which bays have balconies or doors and the blinds,
// from its id, so neighbours of one style still differ. Windows always fit
// a whole bay, never cross a corner and sit on the real floors.
//
// Technique after streets.gl (bay/floor UVs per wall, MIT), OSM2World and
// CityEngine CGA (whole repeats per wall) and Mapbox's faux facades (windows
// in the fragment shader with a hash per cell); no code taken from them.
import * as THREE from 'three';
import { fbm, seededRandom } from './road_surface.js';
import { rendererMaxAnisotropy } from './textures.js';

/**
 * @typedef {{ material: 'plaster' | 'render' | 'brick' | 'stone' | 'concrete', winW: number, winH: number,
 *   sill: number, balcony: number, ground: 'residential' | 'shops' | 'lobby', tint: number, shutters?: boolean,
 *   ribbon?: boolean, frame: string, glass: string, accent: string, bay: number }} DynamicFacadeStyle
 * winW / winH / sill: window width, height and sill height as shares of a bay and a floor;
 * balcony: share of upper-floor bays with a balcony; tint: how much the building colour tints
 * the wall material; bay: preferred bay width (m).
 */

/** @type {Record<string, DynamicFacadeStyle>} */
export const DYNAMIC_FACADE_STYLES = {
  Apartment: { material: 'plaster', winW: 0.4, winH: 0.5, sill: 0.3, balcony: 0.45, ground: 'residential', tint: 1, frame: '#f2f0ea', glass: '#26323c', accent: '#d8d4cb', bay: 3.1 },
  MixedUse: { material: 'plaster', winW: 0.44, winH: 0.54, sill: 0.28, balcony: 0.2, ground: 'shops', tint: 1, frame: '#3a3e44', glass: '#25313b', accent: '#9a3b2c', bay: 3.2 },
  Modern: { material: 'render', winW: 0.66, winH: 0.58, sill: 0.24, balcony: 0.55, ground: 'shops', tint: 1, frame: '#2b2e33', glass: '#22303a', accent: '#c9ced3', bay: 3.4 },
  Office: { material: 'concrete', winW: 0.88, winH: 0.6, sill: 0.24, balcony: 0, ground: 'lobby', tint: 0.5, ribbon: true, frame: '#9aa3ad', glass: '#2c4152', accent: '#5b6570', bay: 3.0 },
  Heritage: { material: 'stone', winW: 0.34, winH: 0.6, sill: 0.22, balcony: 0.12, ground: 'shops', tint: 0.45, shutters: true, frame: '#ece7dc', glass: '#28333b', accent: '#3d5c49', bay: 3.0 },
  Brick: { material: 'brick', winW: 0.38, winH: 0.54, sill: 0.28, balcony: 0.15, ground: 'residential', tint: 0.25, frame: '#ece8df', glass: '#27323a', accent: '#efe9dd', bay: 3.0 }
};

export const FACADE_MODE_OPTIONS = ['Dynamic (auto)', 'Catalogue textures'];

/** Catalogue key of a dynamic style ('Apartment' -> 'DynamicApartment'). */
export function dynamicFacadeKey(style) {
  return `Dynamic${style}`;
}

/** The style behind a catalogue token 'Dynamic:<style>', or null. */
export function dynamicStyleOfToken(token) {
  const m = /^Dynamic:(\w+)$/.exec(String(token || ''));
  return m && DYNAMIC_FACADE_STYLES[m[1]] ? m[1] : null;
}

/**
 * Pick a dynamic style for a building from its function and height, varied
 * per building (seed).
 * @param {string} fn building function
 * @param {number} levels
 * @param {number} seed
 */
export function autoDynamicStyle(fn, levels, seed) {
  const f = String(fn || '').toLowerCase();
  const r = Math.abs(Math.sin(seed * 91.345 + 7.13) * 43758.5453) % 1;
  if (/office|ofis|admin|idari|bank|corporate|hotel|otel/.test(f)) return levels >= 4 ? 'Office' : 'MixedUse';
  if (/commerc|retail|ticaret|mixed|karma|shop|avm|market/.test(f)) return levels >= 9 ? 'Office' : (r < 0.7 ? 'MixedUse' : 'Modern');
  if (/civic|public|kamu|cultur|kultur|relig|museum|school|educat|egitim|health|saglik|hospital/.test(f)) return r < 0.6 ? 'Heritage' : 'Brick';
  if (/indust|sanayi|warehouse|depo|factory/.test(f)) return r < 0.5 ? 'Brick' : 'Office';
  if (levels >= 10) return r < 0.6 ? 'Modern' : 'Apartment';
  if (r < 0.5) return 'Apartment';
  if (r < 0.75) return 'Modern';
  if (r < 0.9) return 'Brick';
  return 'Heritage';
}

// --- wall materials ----------------------------------------------------------

const MATERIAL_TILE_M = { plaster: 2.4, render: 2.4, brick: 1.2, stone: 2.4, concrete: 3.0 };

function paint(size, fill) {
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
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = rendererMaxAnisotropy();
  return t;
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

// Tileable wall material, near white for plaster/render/concrete (the
// building colour tints it) and in its own colours for brick and stone.
function materialTexture(kind) {
  const size = 512;
  const rand = seededRandom(kind.length * 977 + 13);
  const big = fbm(size, [4, 8, 16], 31);
  const fine = fbm(size, [64, 128], 47);
  const pxPerM = size / MATERIAL_TILE_M[kind];
  if (kind === 'brick') {
    const bw = 0.25 * pxPerM;
    const bh = 0.075 * pxPerM;
    const rows = Math.round(size / bh);
    const cols = Math.round(size / bw);
    const tones = Array.from({ length: rows * cols }, () => [0.55 + rand() * 0.2, 0.25 + rand() * 0.1, 0.18 + rand() * 0.08]);
    return paint(size, (px) => {
      for (let y = 0; y < size; y++) {
        const row = Math.floor(y / bh) % rows;
        const fy = y - Math.floor(y / bh) * bh;
        for (let x = 0; x < size; x++) {
          const xs = (x + (row % 2) * bw * 0.5) % size;
          const col = Math.floor(xs / bw) % cols;
          const fx = xs - Math.floor(xs / bw) * bw;
          const mortar = fx < 1.6 || fy < 1.6;
          const i = y * size + x;
          const n = (fine[i] - 0.5) * 0.12 + (big[i] - 0.5) * 0.08;
          const t = tones[row * cols + col];
          const rgb = mortar ? [0.72 + n, 0.69 + n, 0.64 + n] : [t[0] + n, t[1] + n, t[2] + n];
          px.set([clamp255(rgb[0]), clamp255(rgb[1]), clamp255(rgb[2]), 255], i * 4);
        }
      }
    });
  }
  if (kind === 'stone') {
    const bh = 0.36 * pxPerM;
    const rows = Math.round(size / bh);
    // Ashlar: courses of blocks of varying length.
    const joints = Array.from({ length: rows }, () => {
      const xs = [];
      let x = rand() * 40;
      while (x < size) {
        xs.push(x);
        x += (0.5 + rand() * 0.5) * pxPerM;
      }
      return xs;
    });
    const tones = Array.from({ length: rows * 16 }, () => 0.86 + rand() * 0.12);
    return paint(size, (px) => {
      for (let y = 0; y < size; y++) {
        const row = Math.floor(y / bh) % rows;
        const fy = y - Math.floor(y / bh) * bh;
        for (let x = 0; x < size; x++) {
          let k = 0;
          let edge = Infinity;
          joints[row].forEach((jx, j) => {
            edge = Math.min(edge, Math.abs(x - jx));
            if (x >= jx) k = j;
          });
          const joint = edge < 1.5 || fy < 1.5;
          const i = y * size + x;
          const n = (fine[i] - 0.5) * 0.1 + (big[i] - 0.5) * 0.1;
          const t = tones[(row * 16 + k) % tones.length];
          const rgb = joint ? [0.6, 0.57, 0.52] : [0.93 * t + n, 0.88 * t + n, 0.78 * t + n];
          px.set([clamp255(rgb[0]), clamp255(rgb[1]), clamp255(rgb[2]), 255], i * 4);
        }
      }
    });
  }
  const panel = kind === 'concrete' ? 1.5 * pxPerM : 0;
  const strength = kind === 'render' ? 0.05 : kind === 'concrete' ? 0.12 : 0.09;
  return paint(size, (px) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        // Rain streaks: darker vertical runs from the big noise.
        const streak = (big[(x * 7) % size] - 0.5) * 0.06 * (y / size);
        let v = 0.9 + (big[i] - 0.5) * strength + (fine[i] - 0.5) * strength * 0.8 - streak;
        if (panel && ((x % panel) < 1.5 || (y % panel) < 1.5)) v *= 0.72;
        px.set([clamp255(v), clamp255(v * 0.995), clamp255(v * 0.985), 255], i * 4);
      }
    }
  });
}

const textureCache = new Map();
/**
 * Wall material texture for a dynamic style, carrying the style's shader
 * parameters in userData.planxDynamic (read by building_batch.js).
 * @param {string} styleName
 */
export function createDynamicFacadeTexture(styleName) {
  const style = DYNAMIC_FACADE_STYLES[styleName] || DYNAMIC_FACADE_STYLES.Apartment;
  if (!textureCache.has(styleName)) {
    const t = materialTexture(style.material);
    t.userData.planxDynamic = { style: styleName, ...style, tile: MATERIAL_TILE_M[style.material] };
    textureCache.set(styleName, t);
  }
  return textureCache.get(styleName);
}

const linear = (hex) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};
const GROUND_KIND = { residential: 0, shops: 1, lobby: 2 };

/** Uniforms for a dynamic style (see DYNAMIC_FACADE_FRAGMENT). */
export function dynamicFacadeUniforms(params) {
  return {
    uDynA: { value: new THREE.Vector4(params.winW, params.winH, params.sill, params.balcony) },
    uDynB: { value: new THREE.Vector4(GROUND_KIND[params.ground] ?? 0, params.tint, params.shutters ? 1 : 0, params.ribbon ? 1 : 0) },
    // Material texture repeats per bay and per floor (bays ~3.1 m, floors ~3 m).
    uDynMat: { value: new THREE.Vector2(3.1 / params.tile, 3.0 / params.tile) },
    uDynFrame: { value: linear(params.frame) },
    uDynGlass: { value: linear(params.glass) },
    uDynAccent: { value: linear(params.accent) }
  };
}

// Declarations (fragment, after <common>; needs planxHash and vPlanxId).
export const DYNAMIC_FACADE_PARS = `
uniform vec4 uDynA;
uniform vec4 uDynB;
uniform vec2 uDynMat;
uniform vec3 uDynFrame;
uniform vec3 uDynGlass;
uniform vec3 uDynAccent;
float planxDynWall = 1.0;
float planxDynGlass = 0.0;
float planxDynBox(vec2 p, vec2 c, vec2 halfSize) { vec2 d = abs(p - c) - halfSize; return max(d.x, d.y); }
float planxDynFill(float sd, float aa) { return smoothstep(aa, -aa, sd); }
// Hash without sin(): stable for the moderate inputs used here.
float planxDynHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// Thin bars across a coordinate (count per unit), anti-aliased, fading to
// their average coverage once they get finer than a pixel.
float planxDynBars(float x, float count, float width) {
  float t = x * count;
  float w = fwidth(t) + 1e-4;
  float d = abs(fract(t) - 0.5) - (0.5 - width);
  float bars = smoothstep(-w, w, d);
  return mix(bars, width * 2.0, smoothstep(0.35, 0.8, w));
}
`;

// Replaces <map_fragment>: the facade colour of this fragment from the
// bay/floor coordinates (vMapUv), into diffuseColor; planxDynWall marks the
// wall (tinted by the building colour), planxDynGlass the glass.
export const DYNAMIC_FACADE_FRAGMENT = `
vec2 fUv = vMapUv;
vec2 fCell = floor(fUv);
vec2 fLoc = fUv - fCell;
vec2 fW = fwidth(fUv);
float fAA = max(fW.x, fW.y) * 0.8 + 1e-4;
// The id is constant per building; snap it so interpolation noise cannot
// change the hashes from one pixel to the next.
float bSeed = mod(floor(vPlanxId + 0.5), 4096.0) * 1.618 + 0.5;
float bH1 = planxDynHash(vec2(bSeed, 3.1));
float bH2 = planxDynHash(vec2(bSeed, 7.7));
float bH3 = planxDynHash(vec2(bSeed, 11.3));
float cH = planxDynHash(fCell * 1.37 + vec2(bSeed, bSeed * 0.71));
vec3 wallCol = texture2D(map, fUv * uDynMat).rgb;
bool fGround = fCell.y < 0.5;
float ribbon = uDynB.w;
// Window: centred in the bay, proportions varied per building.
float ww = clamp(uDynA.x + (bH1 - 0.5) * 0.12, 0.2, 0.94);
float wh = clamp(uDynA.y + (bH2 - 0.5) * 0.1, 0.3, 0.8);
float sill = uDynA.z;
float door = 0.0;
float shop = 0.0;
// Balconies on upper floors: whole bay columns (a stack per building).
float balcony = (!fGround && planxDynHash(vec2(fCell.x * 2.1 + 0.3, bSeed)) < uDynA.w) ? 1.0 : 0.0;
if (fGround) {
  if (uDynB.x > 1.5) { ww = 0.9; wh = 0.76; sill = 0.03; shop = 1.0; }
  else if (uDynB.x > 0.5) {
    door = step(0.82, planxDynHash(vec2(fCell.x * 1.7 + 5.0, bSeed)));
    ww = mix(0.84, 0.36, door); wh = mix(0.64, 0.72, door); sill = mix(0.07, 0.0, door); shop = 1.0;
  } else {
    door = step(0.8, planxDynHash(vec2(fCell.x * 1.3 + 9.0, bSeed)));
    ww = mix(ww, 0.34, door); wh = mix(wh - 0.06, 0.74, door); sill = mix(sill + 0.06, 0.0, door);
  }
} else if (balcony > 0.5) {
  // A balcony door: full height opening.
  sill = 0.04; wh = 0.72; ww = max(ww, 0.42);
}
vec2 wC = vec2(0.5, sill + wh * 0.5);
vec2 wHalf = vec2(ww, wh) * 0.5;
float opening = planxDynFill(planxDynBox(fLoc, wC, wHalf), fAA);
float frameW = mix(0.035, 0.02, ribbon);
float glassIn = planxDynFill(planxDynBox(fLoc, wC, wHalf - frameW), fAA);
// Mullion and transom on wide windows; shopfronts get slim bars.
float bars = 0.0;
if (ww > 0.5 || shop > 0.5) bars = planxDynFill(abs(fLoc.x - 0.5) - 0.01, fAA);
if (!fGround && wh > 0.5) bars = max(bars, planxDynFill(abs(fLoc.y - (sill + wh * 0.72)) - 0.009, fAA) * step(0.5, ww));
float glass = glassIn * (1.0 - bars);
float frame = opening * (1.0 - glass);
// Glass: sky reflection brighter towards the top, darker room behind,
// the head of the opening in shadow (recess).
float gy = clamp((fLoc.y - (wC.y - wHalf.y)) / max(0.01, wh), 0.0, 1.0);
vec3 glassCol = uDynGlass * (0.65 + 0.7 * cH) * (0.7 + 0.6 * gy);
glassCol *= 1.0 - 0.5 * smoothstep(0.8, 1.0, gy);
if (door > 0.5) glassCol = mix(uDynFrame * 0.35, glassCol, 0.35);
vec3 col = wallCol;
float wallMask = 1.0;
// Ribbon facades: spandrel panels between the window bands.
if (ribbon > 0.5 && !fGround) {
  float spandrel = 1.0 - planxDynFill(abs(fLoc.y - wC.y) - wHalf.y - 0.05, fAA);
  col = mix(col, uDynAccent * (0.9 + 0.2 * bH3), spandrel * 0.85);
  wallMask *= 1.0 - spandrel * 0.85;
}
// Reveal: shadow along the head and one jamb of the opening.
float reveal = planxDynFill(planxDynBox(fLoc, wC + vec2(0.012, 0.016), wHalf + 0.012), fAA) * (1.0 - opening);
col *= 1.0 - 0.35 * reveal;
// Sill or lintel band.
if (shop < 0.5 && door < 0.5) {
  float sillBand = planxDynFill(planxDynBox(fLoc, vec2(0.5, sill - 0.018), vec2(wHalf.x + 0.03, 0.016)), fAA);
  col = mix(col, uDynFrame * 0.92, sillBand);
  wallMask *= 1.0 - sillBand;
}
// Shutters beside the windows.
if (uDynB.z > 0.5 && !fGround && ww < 0.5) {
  float shW = ww * 0.5;
  float sh = planxDynFill(planxDynBox(vec2(abs(fLoc.x - 0.5), fLoc.y), vec2(wHalf.x + shW * 0.5 + 0.01, wC.y), vec2(shW * 0.5, wHalf.y)), fAA);
  float slats = 0.85 + 0.15 * planxDynBars(fLoc.y, 40.0, 0.25);
  col = mix(col, uDynAccent * slats, sh);
  wallMask *= 1.0 - sh;
}
col = mix(col, uDynFrame, frame);
col = mix(col, glassCol, glass);
wallMask *= 1.0 - opening;
// Shop sign band above the shopfronts.
if (shop > 0.5 && uDynB.x < 1.5) {
  float sign = planxDynFill(planxDynBox(fLoc, vec2(0.5, 0.86), vec2(0.46, 0.06)), fAA);
  vec3 signCol = mix(uDynAccent, vec3(0.12, 0.2, 0.32), step(0.5, planxDynHash(vec2(fCell.x + 13.0, bSeed * 3.0))));
  col = mix(col, signCol, sign * (1.0 - door));
  wallMask *= 1.0 - sign * (1.0 - door);
}
// Balcony: slab edge, railing and its shadow on the wall.
if (balcony > 0.5) {
  float slab = planxDynFill(planxDynBox(fLoc, vec2(0.5, 0.02), vec2(0.47, 0.02)), fAA);
  float rail = planxDynFill(planxDynBox(fLoc, vec2(0.5, 0.2), vec2(0.47, 0.16)), fAA);
  float barsV = planxDynBars(fLoc.x, 22.0, 0.12);
  float railTop = planxDynFill(abs(fLoc.y - 0.36) - 0.008, fAA) * planxDynFill(abs(fLoc.x - 0.5) - 0.47, fAA);
  float shadow = planxDynFill(planxDynBox(fLoc, vec2(0.5, 0.97), vec2(0.47, 0.03)), fAA);
  col *= 1.0 - 0.3 * shadow;
  col = mix(col, uDynFrame * 0.55, rail * barsV * 0.7 + railTop);
  col = mix(col, uDynFrame * 0.95, slab);
  wallMask *= 1.0 - max(slab, railTop);
  glass *= 1.0 - rail * barsV * 0.7;
}
// Floor line (string course) on stone and concrete.
if (uDynB.y < 0.6) {
  float course = planxDynFill(abs(fLoc.y) - 0.012, fAA) * (1.0 - opening);
  col *= 1.0 - 0.18 * course;
}
// Far away a bay is a few pixels: fade to the average to avoid shimmer.
float far = smoothstep(0.2, 0.5, max(fW.x, fW.y));
vec3 avg = mix(wallCol, uDynGlass * 0.9, ww * wh * 0.8);
col = mix(col, avg, far);
wallMask = mix(wallMask, 1.0 - ww * wh * 0.8, far);
glass *= 1.0 - far * 0.6;
vec4 sampledDiffuseColor = vec4(col, 1.0);
diffuseColor.rgb *= col;
planxDynWall = wallMask;
planxDynGlass = glass;
`;

// Replaces <color_fragment>: the building colour tints the wall only.
export const DYNAMIC_FACADE_COLOR = `
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
diffuseColor.rgb *= mix(vec3(1.0), vColor, planxDynWall * uDynB.y);
#endif
`;
