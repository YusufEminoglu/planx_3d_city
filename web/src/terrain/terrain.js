// Terrain: the DEM (GeoTIFF) and its sampler, the terrain mesh cut to the
// region of interest with its side skirt, terrain textures (orthophoto,
// base map), flattened block plateaus, and terrainLocalYAt(), the ground
// height every layer stands on.
import * as THREE from 'three';
import { t } from '../ui_text.js';
import {
  LOCAL_X_SIGN, getPolygonRings, geometryBounds, mergeBounds, pointInLocalPolys, pointInRingLocal
} from '../geo.js';
import { createAsphaltTexture } from '../textures.js';
import { state } from '../core/state.js';
import { texLoader, world, terrainSideGroup } from '../core/scene.js';
import { settings } from '../core/settings.js';
import { setStatus } from '../ui/status.js';
import {
  textureFromSet, metersToLocal, localToMeters, fetchWithTimeout, isRasterTextureMode, asFeatureCollection
} from '../core/data.js';
import { clearGroup, isSceneBuildStale } from '../core/scene_util.js';

export const islandPlateauCache = [];
// Uniform-grid index over islandPlateauCache bboxes. terrainLocalYAt runs for
// every vertex of roads, sidewalks and building bases, and scanning every
// block per call made scene builds quadratic in the block count. Rebuilt
// lazily after the cache changes; candidates keep cache order, so the first
// matching plateau wins exactly as with the linear scan.
const PLATEAU_CELL = 64;
let plateauGrid = null;
function invalidatePlateauIndex() { plateauGrid = null; }
function plateauCandidates(localX, localZ) {
  if (!plateauGrid) {
    plateauGrid = new Map();
    for (const cache of islandPlateauCache) {
      const t = cache.transition || 0;
      const x0 = Math.floor((cache.bbox.minX - t) / PLATEAU_CELL);
      const x1 = Math.floor((cache.bbox.maxX + t) / PLATEAU_CELL);
      const z0 = Math.floor((cache.bbox.minZ - t) / PLATEAU_CELL);
      const z1 = Math.floor((cache.bbox.maxZ + t) / PLATEAU_CELL);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = cx * 1048576 + cz;
          let list = plateauGrid.get(key);
          if (!list) plateauGrid.set(key, (list = []));
          list.push(cache);
        }
      }
    }
  }
  return plateauGrid.get(Math.floor(localX / PLATEAU_CELL) * 1048576 + Math.floor(localZ / PLATEAU_CELL));
}

export function demSamplerBounds() {
  if (!state.demSampler) return null;
  if (state.demSampler.flat && state.demSampler.bounds) return { ...state.demSampler.bounds };
  const x0 = state.demSampler.originX;
  const x1 = state.demSampler.originX + state.demSampler.resX * state.demSampler.width;
  const y0 = state.demSampler.originY;
  const y1 = state.demSampler.originY + state.demSampler.resY * state.demSampler.height;
  return {
    minX: Math.min(x0, x1),
    maxX: Math.max(x0, x1),
    minY: Math.min(y0, y1),
    maxY: Math.max(y0, y1)
  };
}

export function deriveVectorBounds(data) {
  const roi = asFeatureCollection(data?.roi, 'ROI');
  if (roi.features.length) return geometryBounds(roi.features);
  const candidates = [
    asFeatureCollection(data?.blocksFc, 'Blocks').features,
    asFeatureCollection(data?.roadsFc, 'Roads').features,
    asFeatureCollection(data?.buildingsFc, 'Buildings').features,
    asFeatureCollection(data?.parcelsFc, 'Parcels').features,
    asFeatureCollection(data?.sidewalks, 'Sidewalks').features,
    asFeatureCollection(data?.pedestrianPaths, 'Pedestrian paths').features
  ]
    .filter((features) => features.length)
    .map((features) => geometryBounds(features))
    .filter(Boolean);
  return candidates.length ? candidates.reduce((acc, b) => acc ? mergeBounds(acc, b) : b, null) : null;
}

function fallbackSceneBounds() {
  return { minX: -500, maxX: 500, minY: -500, maxY: 500 };
}

export function activateFlatTerrainFallback(sourceBounds = null, height = 0) {
  const b = sourceBounds || state.bounds || deriveVectorBounds(state.layerDataCache) || fallbackSceneBounds();
  state.bounds = { ...b };
  state.demSampler = {
    flat: true,
    flatHeight: height,
    bounds: { ...b },
    originX: b.minX,
    originY: b.minY,
    resX: Math.max(1, b.maxX - b.minX),
    resY: Math.max(1, b.maxY - b.minY),
    width: 1,
    height: 1,
    noData: null
  };
  state.terrainHeightStats = { min: height, max: height, avg: height, p02: height, p98: height, median: height, mad: 1 };
  state.demReady = true;
  state.demLoadingStarted = false;
  _lastTerrainY = height;
  setStatus('DEM not found; using a flat presentation plane.');
}

function applyTone(value) {
  let v = value / 255;
  v = (v - 0.5) * settings.terrainTextureContrast + 0.5;
  v *= settings.terrainTextureBrightness;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function terrainTextureRasterOrientation(image) {
  let resolution = null;
  try {
    resolution = image?.getResolution ? image.getResolution() : null;
  } catch (err) {
    resolution = null;
  }
  const resX = Array.isArray(resolution) ? Number(resolution[0]) : NaN;
  const resY = Array.isArray(resolution) ? Number(resolution[1]) : NaN;
  const rasterXSign = Number.isFinite(resX) && resX !== 0 ? Math.sign(resX) : 1;
  const rasterYSign = Number.isFinite(resY) && resY !== 0 ? Math.sign(resY) : -1;
  return {
    mirrorX: rasterXSign !== LOCAL_X_SIGN,
    mirrorY: rasterYSign > 0
  };
}

function geoTiffImageBounds(image) {
  try {
    const b = image?.getBoundingBox ? image.getBoundingBox() : null;
    if (Array.isArray(b) && b.length >= 4 && b.every(Number.isFinite)) {
      return {
        minX: Math.min(b[0], b[2]),
        maxX: Math.max(b[0], b[2]),
        minY: Math.min(b[1], b[3]),
        maxY: Math.max(b[1], b[3])
      };
    }
  } catch (err) {
    // Fall back to origin/resolution below.
  }

  try {
    const origin = image?.getOrigin ? image.getOrigin() : null;
    const resolution = image?.getResolution ? image.getResolution() : null;
    if (Array.isArray(origin) && Array.isArray(resolution)) {
      const x0 = Number(origin[0]);
      const y0 = Number(origin[1]);
      const x1 = x0 + Number(resolution[0]) * image.getWidth();
      const y1 = y0 + Number(resolution[1]) * image.getHeight();
      if ([x0, y0, x1, y1].every(Number.isFinite)) {
        return {
          minX: Math.min(x0, x1),
          maxX: Math.max(x0, x1),
          minY: Math.min(y0, y1),
          maxY: Math.max(y0, y1)
        };
      }
    }
  } catch (err) {
    return null;
  }
  return null;
}

function terrainTexturePixelForProjected(x, y, canvasWidth, canvasHeight) {
  const width = Math.max(1e-6, state.bounds.maxX - state.bounds.minX);
  const depth = Math.max(1e-6, state.bounds.maxY - state.bounds.minY);
  const [localX, localZ] = metersToLocal(x, y);
  const px = ((localX + width * 0.5) / width) * canvasWidth;
  const py = ((depth * 0.5 - localZ) / depth) * canvasHeight;
  return [px, py];
}

function terrainTextureAtlasSize(maxSize = 4096) {
  const width = Math.max(1, state.bounds.maxX - state.bounds.minX);
  const depth = Math.max(1, state.bounds.maxY - state.bounds.minY);
  if (width >= depth) {
    return [maxSize, Math.max(1, Math.round(maxSize * depth / width))];
  }
  return [Math.max(1, Math.round(maxSize * width / depth)), maxSize];
}

function alignTerrainTextureCanvas(sourceCanvas, textureBounds) {
  if (!state.bounds || !textureBounds) return sourceCanvas;
  const terrainWidth = Math.max(1e-6, state.bounds.maxX - state.bounds.minX);
  const terrainDepth = Math.max(1e-6, state.bounds.maxY - state.bounds.minY);
  const texWidth = Math.max(1e-6, textureBounds.maxX - textureBounds.minX);
  const texDepth = Math.max(1e-6, textureBounds.maxY - textureBounds.minY);
  const sameExtent =
    Math.abs(textureBounds.minX - state.bounds.minX) <= terrainWidth * 0.001 &&
    Math.abs(textureBounds.maxX - state.bounds.maxX) <= terrainWidth * 0.001 &&
    Math.abs(textureBounds.minY - state.bounds.minY) <= terrainDepth * 0.001 &&
    Math.abs(textureBounds.maxY - state.bounds.maxY) <= terrainDepth * 0.001;
  if (sameExtent) return sourceCanvas;

  const [atlasW, atlasH] = terrainTextureAtlasSize();
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const ctx = atlas.getContext('2d');
  ctx.fillStyle = settings.terrainOutsideColor || '#edf2ef';
  ctx.fillRect(0, 0, atlasW, atlasH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const [xA, yA] = terrainTexturePixelForProjected(textureBounds.minX, textureBounds.maxY, atlasW, atlasH);
  const [xB, yB] = terrainTexturePixelForProjected(textureBounds.maxX, textureBounds.minY, atlasW, atlasH);
  const dx = Math.min(xA, xB);
  const dy = Math.min(yA, yB);
  const dw = Math.abs(xB - xA);
  const dh = Math.abs(yB - yA);
  if (dw < 1 || dh < 1 || texWidth <= 0 || texDepth <= 0) return sourceCanvas;

  ctx.drawImage(sourceCanvas, dx, dy, dw, dh);
  return atlas;
}

export async function loadTerrainTextureFromGeoTiff() {
  const target = state.projectManifest?.terrainTexture?.target;
  if (!target || !settings.showTerrainTexture) return null;
  const res = await fetchWithTimeout(`../data/${target}`, { cache: 'no-store' }, 30000);
  if (!res.ok) throw new Error(`Terrain texture not found: ${target}`);
  const file = await res.arrayBuffer();
  const tiff = await GeoTIFF.fromArrayBuffer(file);
  const image = await tiff.getImage();
  const w = image.getWidth();
  const h = image.getHeight();
  const maxSize = 4096;
  const scale = Math.min(1, maxSize / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const samples = image.getSamplesPerPixel ? image.getSamplesPerPixel() : 1;
  const raster = await image.readRasters({ interleave: true, width: outW, height: outH });
  const orientation = terrainTextureRasterOrientation(image);
  const textureBounds = geoTiffImageBounds(image);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = outW;
  sourceCanvas.height = outH;
  const ctx = sourceCanvas.getContext('2d');
  const img = ctx.createImageData(outW, outH);
  for (let y = 0; y < outH; y++) {
    const srcY = orientation.mirrorY ? outH - 1 - y : y;
    for (let x = 0; x < outW; x++) {
      const srcX = orientation.mirrorX ? outW - 1 - x : x;
      const src = (srcY * outW + srcX) * samples;
      const dst = (y * outW + x) * 4;
      const gray = raster[src];
      const r = samples >= 3 ? raster[src] : gray;
      const g = samples >= 3 ? raster[src + 1] : gray;
      const b = samples >= 3 ? raster[src + 2] : gray;
      const a = samples >= 4 ? raster[src + 3] : 255;
      img.data[dst] = applyTone(Number(r) || 0);
      img.data[dst + 1] = applyTone(Number(g) || 0);
      img.data[dst + 2] = applyTone(Number(b) || 0);
      img.data[dst + 3] = Number.isFinite(a) ? Math.max(0, Math.min(255, a)) : 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const canvas = alignTerrainTextureCanvas(sourceCanvas, textureBounds);
  const tex = new THREE.CanvasTexture(canvas);
  // The canvas is normalized to the corrected local map axes; terrain UVs use it directly.
  tex.flipY = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function loadBaseMapTexture() {
  const target = state.projectManifest?.baseMapTexture?.target;
  if (!target || !settings.showXyzTiles) return null;
  const texture = await new Promise((resolve, reject) => {
    texLoader.load(`../data/${target}`, resolve, undefined, reject);
  });
  texture.flipY = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function demHeightAtProjected(x, y, fallback = 0) {
  if (!state.demSampler) return fallback;
  if (state.demSampler.flat) return Number.isFinite(state.demSampler.flatHeight) ? state.demSampler.flatHeight : fallback;
  const px = Math.floor((x - state.demSampler.originX) / state.demSampler.resX);
  const py = Math.floor((y - state.demSampler.originY) / state.demSampler.resY);
  if (px < 0 || px >= state.demSampler.width || py < 0 || py >= state.demSampler.height) return fallback;
  const idx = py * state.demSampler.width + px;
  const v = state.demSampler.raster[idx];
  if (!Number.isFinite(v)) return fallback;
  if (state.demSampler.noData !== null && String(v) === String(state.demSampler.noData)) return fallback;
  return v;
}

function demHeightMedianAtProjected(x, y, fallback = null, radius = 1) {
  if (!state.demSampler) return fallback;
  if (state.demSampler.flat) return Number.isFinite(state.demSampler.flatHeight) ? state.demSampler.flatHeight : fallback;
  const px = Math.floor((x - state.demSampler.originX) / state.demSampler.resX);
  const py = Math.floor((y - state.demSampler.originY) / state.demSampler.resY);
  const values = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = px + dx;
      const sy = py + dy;
      if (sx < 0 || sx >= state.demSampler.width || sy < 0 || sy >= state.demSampler.height) continue;
      const v = state.demSampler.raster[sy * state.demSampler.width + sx];
      if (!Number.isFinite(v)) continue;
      if (state.demSampler.noData !== null && String(v) === String(state.demSampler.noData)) continue;
      values.push(v);
    }
  }
  if (!values.length) return fallback;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

// The DEM download is started alongside the vector layers (see rebuildScene),
// and consumed once here; a later reload fetches it again.
let _demPrefetch = null;
export function prefetchProjectDem() {
  if (!_demPrefetch) {
    _demPrefetch = fetchWithTimeout('../data/dem/mydem.tif', { cache: 'no-store' }, 30000)
      .then((res) => (res.ok ? res.arrayBuffer() : null));
    _demPrefetch.catch(() => {}); // surfaced by loadProjectDem
  }
  return _demPrefetch;
}

export async function loadProjectDem() {
  setStatus(t('demLoading'));
  const pending = prefetchProjectDem();
  _demPrefetch = null;
  const file = await pending;
  if (!file) throw new Error('DEM not found');
  const tiff = await GeoTIFF.fromArrayBuffer(file);
  const image = await tiff.getImage();
  const [originXFull, originYFull] = image.getOrigin();
  const [resX, resY] = image.getResolution();
  const wFull = image.getWidth();
  const hFull = image.getHeight();

  let minPx = 0;
  let minPy = 0;
  let maxPx = wFull - 1;
  let maxPy = hFull - 1;
  if (state.bounds) {
    const pxA = Math.floor((state.bounds.minX - originXFull) / resX);
    const pxB = Math.floor((state.bounds.maxX - originXFull) / resX);
    const pyA = Math.floor((state.bounds.minY - originYFull) / resY);
    const pyB = Math.floor((state.bounds.maxY - originYFull) / resY);
    minPx = Math.max(0, Math.min(pxA, pxB) - 20);
    maxPx = Math.min(wFull - 1, Math.max(pxA, pxB) + 20);
    minPy = Math.max(0, Math.min(pyA, pyB) - 20);
    maxPy = Math.min(hFull - 1, Math.max(pyA, pyB) + 20);
  }
    const winMinX = Math.max(0, Math.min(minPx, maxPx));
  const winMaxX = Math.min(wFull - 1, Math.max(minPx, maxPx));
  const winMinY = Math.max(0, Math.min(minPy, maxPy));
  const winMaxY = Math.min(hFull - 1, Math.max(minPy, maxPy));
  const raster = await image.readRasters({
    interleave: true,
    window: [winMinX, winMinY, winMaxX + 1, winMaxY + 1]
  });
  const originX = originXFull + winMinX * resX;
  const originY = originYFull + winMinY * resY;
  state.demSampler = {
    raster,
    originX,
    originY,
    resX,
    resY,
    width: winMaxX - winMinX + 1,
    height: winMaxY - winMinY + 1,
    noData: image.getGDALNoData()
  };
  state.demReady = true;
  setStatus(`${t('demLoaded')} (mydem.tif).`);
}

function createRoiMaskTexture(width, depth) {
  const roi = state.layerDataCache?.roi;
  if (!roi || !roi.features || !roi.features.length) return null;
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, size, size);

  const toPixel = (x, z) => {
    const u = (x + width * 0.5) / width;
    const v = (z + depth * 0.5) / depth;
    return [u * size, v * size];
  };

  ctx.fillStyle = '#ffffff';
  for (const f of roi.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      if (!poly.length) continue;
      ctx.beginPath();
      poly.forEach((ring) => {
        if (!ring || ring.length < 3) return;
        ring.forEach((c, i) => {
          const [lx, lz] = metersToLocal(c[0], c[1]);
          const [px, py] = toPixel(lx, lz);
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
      });
      ctx.fill('evenodd');
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function edgeHeightAt(localX, localZ, fallback) {
  const [wx, wy] = localToMeters(localX, localZ);
  let z = demHeightMedianAtProjected(wx, wy, null, 2);
  if (z === null) z = fallback;
  const lo = Number.isFinite(state.terrainHeightStats.p02) ? state.terrainHeightStats.p02 : fallback - 20;
  const hi = Number.isFinite(state.terrainHeightStats.p98) ? state.terrainHeightStats.p98 : fallback + 20;
  return Math.max(lo, Math.min(hi, z));
}

function smoothSideLineHeights(points, fallbackHeight) {
  const raw = points.map(([x, z]) => edgeHeightAt(x, z, fallbackHeight));
  return raw.map((value, i) => {
    const a = raw[Math.max(0, i - 2)];
    const b = raw[Math.max(0, i - 1)];
    const c = value;
    const d = raw[Math.min(raw.length - 1, i + 1)];
    const e = raw[Math.min(raw.length - 1, i + 2)];
    return (a + b + c * 2 + d + e) / 6;
  });
}

function robustTerrainHeightAtProjected(x, y, fallback) {
  const base = Number.isFinite(fallback) ? fallback : (Number.isFinite(state.terrainHeightStats.avg) ? state.terrainHeightStats.avg : 0);
  let z = demHeightMedianAtProjected(x, y, null, 1);
  if (z === null) z = base;
  const lo = Number.isFinite(state.terrainHeightStats.p02) ? state.terrainHeightStats.p02 : base - 20;
  const hi = Number.isFinite(state.terrainHeightStats.p98) ? state.terrainHeightStats.p98 : base + 20;
  return Math.max(lo, Math.min(hi, z));
}

function terrainHeightStatsFromPositions(pos) {
  const values = [];
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (Number.isFinite(z)) values.push(z);
  }
  if (!values.length) {
    return { min: 0, max: 0, avg: 0, p02: 0, p98: 0, median: 0, mad: 1 };
  }
  values.sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const median = values[Math.floor(values.length / 2)];
  const deviations = values.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
  return {
    min: values[0],
    max: values[values.length - 1],
    avg: sum / values.length,
    p02: values[Math.max(0, Math.floor((values.length - 1) * 0.02))],
    p98: values[Math.min(values.length - 1, Math.floor((values.length - 1) * 0.98))],
    median,
    mad: Math.max(0.5, deviations[Math.floor(deviations.length / 2)] || 1)
  };
}

function smoothTerrainSurface(pos, segments, width, depth) {
  const passes = Math.max(0, Math.min(6, Math.round(Number(settings.terrainSmoothingPasses) || 0)));
  if (!passes) return;
  const strength = Math.max(0, Math.min(0.9, Number(settings.terrainSmoothingStrength) || 0));
  if (strength <= 0) return;

  const cols = segments + 1;
  const rows = segments + 1;
  const count = cols * rows;
  let current = new Float32Array(count);
  for (let i = 0; i < count; i++) current[i] = pos.getZ(i);

  const gridStep = Math.max(width / Math.max(1, segments), depth / Math.max(1, segments));
  const maxSlope = Math.max(0.1, Math.min(3.0, Number(settings.terrainMaxSlope) || 0.75));
  const maxDelta = Math.max(0.5, Math.min(16, gridStep * maxSlope));

  for (let pass = 0; pass < passes; pass++) {
    const next = new Float32Array(count);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = row * cols + col;
        const values = [];
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const rr = row + dy;
          if (rr < 0 || rr >= rows) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const cc = col + dx;
            if (cc < 0 || cc >= cols) continue;
            const v = current[rr * cols + cc];
            if (!Number.isFinite(v)) continue;
            values.push(v);
            sum += v;
            n++;
          }
        }
        if (!values.length) {
          next[idx] = current[idx];
          continue;
        }
        values.sort((a, b) => a - b);
        const med = values[Math.floor(values.length / 2)];
        const mean = sum / n;
        let clamped = current[idx];
        if (clamped > med + maxDelta) clamped = med + maxDelta;
        else if (clamped < med - maxDelta) clamped = med - maxDelta;
        const target = med * 0.62 + mean * 0.25 + clamped * 0.13;
        next[idx] = current[idx] * (1 - strength) + target * strength;
      }
    }
    current = next;
  }

  for (let i = 0; i < count; i++) pos.setZ(i, current[i]);
  pos.needsUpdate = true;
}

function buildTerrainSurfaceCache(pos, segments, width, depth) {
  const values = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) values[i] = pos.getZ(i);
  state.terrainSurfaceCache = {
    values,
    segments,
    cols: segments + 1,
    rows: segments + 1,
    width,
    depth
  };
}

function terrainSurfaceCacheYAt(localX, localZ) {
  const cache = state.terrainSurfaceCache;
  if (!cache) return null;
  const fx = ((localX + cache.width * 0.5) / cache.width) * cache.segments;
  const fz = ((localZ + cache.depth * 0.5) / cache.depth) * cache.segments;
  if (fx < 0 || fz < 0 || fx > cache.segments || fz > cache.segments) return null;
  const c0 = Math.max(0, Math.min(cache.segments, Math.floor(fx)));
  const r0 = Math.max(0, Math.min(cache.segments, Math.floor(fz)));
  const c1 = Math.min(cache.segments, c0 + 1);
  const r1 = Math.min(cache.segments, r0 + 1);
  const tx = fx - c0;
  const tz = fz - r0;
  const z00 = cache.values[r0 * cache.cols + c0];
  const z10 = cache.values[r0 * cache.cols + c1];
  const z01 = cache.values[r1 * cache.cols + c0];
  const z11 = cache.values[r1 * cache.cols + c1];
  if (![z00, z10, z01, z11].every(Number.isFinite)) return null;
  const za = z00 * (1 - tx) + z10 * tx;
  const zb = z01 * (1 - tx) + z11 * tx;
  return za * (1 - tz) + zb * tz;
}

function ringToLocalPolyline(ring, maxStep = 5) {
  const points = [];
  if (!ring || ring.length < 2) return points;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i];
    const b = ring[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const [x, z] = metersToLocal(a[0] + dx * t, a[1] + dy * t);
      points.push([x, z]);
    }
  }
  const last = ring[ring.length - 1];
  const [x, z] = metersToLocal(last[0], last[1]);
  points.push([x, z]);
  return points;
}

function roiSidePolylines() {
  const roi = state.layerDataCache?.roi;
  const lines = [];
  for (const feature of roi?.features || []) {
    for (const poly of getPolygonRings(feature.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      lines.push(ringToLocalPolyline(outer));
    }
  }
  return lines.filter((line) => line.length > 1);
}

function demExtentSidePolylines(width, depth) {
  const samples = Math.max(16, Math.floor(currentTerrainSegments() / 2));
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const north = [];
  const east = [];
  const south = [];
  const west = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    north.push([-halfW + width * t, -halfD]);
    east.push([halfW, -halfD + depth * t]);
    south.push([halfW - width * t, halfD]);
    west.push([-halfW, halfD - depth * t]);
  }
  return [north, east, south, west];
}

function buildTerrainSideSkirt(width, depth, demMin, fallbackHeight) {
  clearGroup(terrainSideGroup);
  if (!settings.showTerrainSides) return;
  const baseY = demMin - Math.max(0, Number(settings.terrainSideDrop) || 0);
  const positions = [];
  const colors = [];
  const indices = [];
  const baseColor = new THREE.Color(settings.terrainSideColor || '#d9fbf5');
  const lowerColor = baseColor.clone().lerp(new THREE.Color(0xffffff), 0.55);

  const addVertex = (x, y, z, color) => {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
    return positions.length / 3 - 1;
  };
  const addStrip = (points) => {
    let prevTop = null;
    let prevBottom = null;
    const topHeights = smoothSideLineHeights(points, fallbackHeight);
    for (let i = 0; i < points.length; i++) {
      const [x, z] = points[i];
      const topY = topHeights[i];
      const top = addVertex(x, topY, z, baseColor);
      const bottom = addVertex(x, baseY, z, lowerColor);
      if (prevTop !== null) {
        indices.push(prevTop, top, prevBottom, top, bottom, prevBottom);
      }
      prevTop = top;
      prevBottom = bottom;
    }
  };

  const roiLines = roiSidePolylines();
  const sideLines = roiLines.length ? roiLines : demExtentSidePolylines(width, depth);
  sideLines.forEach(addStrip);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    transparent: false,
    opacity: 1,
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = -40;
  terrainSideGroup.add(mesh);

  const addBottomPolygon = (rings) => {
    if (!rings || !rings[0] || rings[0].length < 3) return;
    const outer = rings[0].map((coord) => metersToLocal(coord[0], coord[1]));
    const shape = new THREE.Shape();
    outer.forEach(([x, z], idx) => { if (idx === 0) shape.moveTo(x, z); else shape.lineTo(x, z); });
    for (let r = 1; r < rings.length; r++) {
      const holePts = rings[r].map((coord) => metersToLocal(coord[0], coord[1]));
      if (holePts.length < 3) continue;
      const hole = new THREE.Path();
      holePts.forEach(([x, z], idx) => { if (idx === 0) hole.moveTo(x, z); else hole.lineTo(x, z); });
      shape.holes.push(hole);
    }
    const bottomGeo = new THREE.ShapeGeometry(shape);
    const bottomPos = bottomGeo.attributes.position;
    for (let i = 0; i < bottomPos.count; i++) {
      const x = bottomPos.getX(i);
      const z = bottomPos.getY(i);
      bottomPos.setXYZ(i, x, baseY, z);
    }
    bottomGeo.computeVertexNormals();
    const bottomMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      roughness: 0.9,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: true
    });
    const bottomMesh = new THREE.Mesh(bottomGeo, bottomMat);
    bottomMesh.receiveShadow = true;
    bottomMesh.renderOrder = -41;
    terrainSideGroup.add(bottomMesh);
  };

  const roiFeatures = state.layerDataCache?.roi?.features || [];
  if (roiFeatures.length) {
    roiFeatures.forEach((feature) => getPolygonRings(feature.geometry).forEach(addBottomPolygon));
  } else {
    addBottomPolygon([[
      [state.bounds.minX, state.bounds.minY],
      [state.bounds.maxX, state.bounds.minY],
      [state.bounds.maxX, state.bounds.maxY],
      [state.bounds.minX, state.bounds.maxY],
      [state.bounds.minX, state.bounds.minY]
    ]]);
  }
}

function currentTerrainSegments() {
  const v = Number(settings.demMeshQuality || settings.fastTerrainSegments || 120);
  return Math.max(32, Math.min(420, Math.round(v)));
}

function terrainVertexBoundaryBlend(localX, localY, width, depth) {
  const edgeDistance = Math.min(localX + width * 0.5, width * 0.5 - localX, localY + depth * 0.5, depth * 0.5 - localY);
  const band = Math.max(8, Math.min(width, depth) * 0.035);
  if (edgeDistance >= band) return 0;
  return 1 - Math.max(0, edgeDistance) / band;
}

function roiLocalPolygons() {
  const polygons = [];
  for (const feature of state.layerDataCache?.roi?.features || []) {
    for (const poly of getPolygonRings(feature.geometry)) {
      if (!poly?.[0]?.length) continue;
      polygons.push(poly.map((ring) => ring.map((coord) => metersToLocal(coord[0], coord[1]))));
    }
  }
  return polygons;
}

function pointInRoiLocal(x, z, polygons) {
  if (!polygons.length) return true;
  for (const poly of polygons) {
    if (!pointInRingLocal(x, z, poly[0])) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) {
      if (pointInRingLocal(x, z, poly[i])) {
        inHole = true;
        break;
      }
    }
    if (!inHole) return true;
  }
  return false;
}

function limitTerrainBoundarySpikes(pos, segments, width, depth, fallback, roiPolyCache) {
  const cols = segments + 1;
  const rows = segments + 1;
  const count = cols * rows;
  const original = new Float32Array(count);
  const inside = new Uint8Array(count);
  const polygons = roiPolyCache || roiLocalPolygons();
  const hasRoi = polygons.length > 0;
  for (let i = 0; i < count; i++) {
    original[i] = pos.getZ(i);
    inside[i] = pointInRoiLocal(pos.getX(i), -pos.getY(i), polygons) ? 1 : 0;
  }
  const range = Math.max(1, (state.terrainHeightStats.p98 || fallback) - (state.terrainHeightStats.p02 || fallback));
  const riseLimit = Math.max(1.2, Math.min(7.5, range * 0.055));
  const dropLimit = Math.max(1.8, Math.min(10.0, range * 0.080));
  const bboxBand = Math.max(2, Math.ceil(cols * 0.035));
  const radius = 3;

  const medianAround = (row, col) => {
    const values = [];
    for (let dy = -radius; dy <= radius; dy++) {
      const rr = row + dy;
      if (rr < 0 || rr >= rows) continue;
      for (let dx = -radius; dx <= radius; dx++) {
        const cc = col + dx;
        if (cc < 0 || cc >= cols) continue;
        const v = original[rr * cols + cc];
        if (Number.isFinite(v)) values.push(v);
      }
    }
    if (!values.length) return fallback;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      let boundary = row < bboxBand || col < bboxBand || row >= rows - bboxBand || col >= cols - bboxBand;
      if (hasRoi && !boundary) {
        const here = inside[idx];
        boundary =
          inside[Math.max(0, row - 1) * cols + col] !== here ||
          inside[Math.min(rows - 1, row + 1) * cols + col] !== here ||
          inside[row * cols + Math.max(0, col - 1)] !== here ||
          inside[row * cols + Math.min(cols - 1, col + 1)] !== here;
      }
      if (!boundary) continue;
      const z = original[idx];
      const med = medianAround(row, col);
      if (!Number.isFinite(z) || !Number.isFinite(med)) continue;
      if (z > med + riseLimit) {
        pos.setZ(idx, med + riseLimit * 0.30);
      } else if (z < med - dropLimit) {
        pos.setZ(idx, med - dropLimit * 0.50);
      }
    }
  }
  pos.needsUpdate = true;
}

function distanceToRingLocal(x, z, ring) {
  let minD2 = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j][0], az = ring[j][1];
    const bx = ring[i][0], bz = ring[i][1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 0 ? ((x - ax) * dx + (z - az) * dz) / len2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    const px = ax + t * dx, pz = az + t * dz;
    const dxp = x - px, dzp = z - pz;
    const d2 = dxp * dxp + dzp * dzp;
    if (d2 < minD2) minD2 = d2;
  }
  return Math.sqrt(minD2);
}

function islandOpacityValue() {
  const transparency = Math.max(0, Math.min(0.95, Number(settings.islandTransparency) || 0));
  return Math.max(0.05, 1 - transparency);
}

export function applyIslandMaterialVisibility(material) {
  const opacity = islandOpacityValue();
  material.opacity = opacity;
  material.transparent = opacity < 0.999;
  material.depthWrite = opacity >= 0.999;
  return material;
}

function shouldApplyIslandPlateaus(blocksFc) {
  if (!settings.flattenIslands || !blocksFc?.features?.length) return false;
  return !!(settings.showIslands || settings.showBuildings || settings.showHardscape || settings.showTrees || settings.showFurniture);
}

function applyIslandPlateaus(pos, segments, width, depth, blocksFc, transitionM) {
  islandPlateauCache.length = 0;
  invalidatePlateauIndex();
  if (!blocksFc?.features?.length) return;
  const count = pos.count;

  for (const feature of blocksFc.features) {
    const rings = getPolygonRings(feature.geometry);
    if (!rings.length) continue;
    const localPolys = rings.map((poly) => poly.map((ring) => ring.map((c) => metersToLocal(c[0], c[1]))));

    let bboxMinX = Infinity, bboxMaxX = -Infinity, bboxMinZ = Infinity, bboxMaxZ = -Infinity;
    for (const localRings of localPolys) {
      for (const r of localRings) {
        for (let p = 0; p < r.length; p++) {
          const px = r[p][0];
          const pz = r[p][1];
          if (px < bboxMinX) bboxMinX = px;
          if (px > bboxMaxX) bboxMaxX = px;
          if (pz < bboxMinZ) bboxMinZ = pz;
          if (pz > bboxMaxZ) bboxMaxZ = pz;
        }
      }
    }
    if (!Number.isFinite(bboxMinX)) continue;

    const insideIdx = [];
    const heights = [];
    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i);
      const lz = -pos.getY(i);
      if (lx < bboxMinX || lx > bboxMaxX || lz < bboxMinZ || lz > bboxMaxZ) continue;
      if (pointInLocalPolys(lx, lz, localPolys)) {
        insideIdx.push(i);
        heights.push(pos.getZ(i));
      }
    }
    if (!heights.length) continue;
    heights.sort((a, b) => a - b);
    const plateauY = heights[Math.floor(heights.length / 2)];

    for (let k = 0; k < insideIdx.length; k++) {
      pos.setZ(insideIdx[k], plateauY);
    }

    if (transitionM > 0) {
      const expMinX = bboxMinX - transitionM;
      const expMaxX = bboxMaxX + transitionM;
      const expMinZ = bboxMinZ - transitionM;
      const expMaxZ = bboxMaxZ + transitionM;
      for (let i = 0; i < count; i++) {
        const lx = pos.getX(i);
        const lz = -pos.getY(i);
        if (lx < expMinX || lx > expMaxX || lz < expMinZ || lz > expMaxZ) continue;
        if (pointInLocalPolys(lx, lz, localPolys)) continue;
        let minDist = Infinity;
        for (const localRings of localPolys) {
          for (const r of localRings) {
            const d = distanceToRingLocal(lx, lz, r);
            if (d < minDist) minDist = d;
          }
        }
        if (minDist < transitionM) {
          let t = 1 - minDist / transitionM;
          t = t * t * (3 - 2 * t);
          const z = pos.getZ(i);
          pos.setZ(i, z * (1 - t) + plateauY * t);
        }
      }
    }

    invalidatePlateauIndex();
    islandPlateauCache.push({
      feature,
      localRings: localPolys,
      plateauY,
      bbox: { minX: bboxMinX, maxX: bboxMaxX, minZ: bboxMinZ, maxZ: bboxMaxZ },
      transition: transitionM
    });
  }

  pos.needsUpdate = true;
}

export async function buildTerrain(blocksFc, buildToken = state.sceneBuildToken) {
  const width = state.bounds.maxX - state.bounds.minX;
  const depth = state.bounds.maxY - state.bounds.minY;
  const segments = currentTerrainSegments();
  const geo = new THREE.PlaneGeometry(width, depth, segments, segments);
  const pos = geo.attributes.position;
  let zMin = Infinity;
  let zMax = -Infinity;

  let sumZ = 0;
  let countZ = 0;
  const validHeights = [];

  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const [wx, wy] = localToMeters(lx, -ly);
    const z = demHeightAtProjected(wx, wy, null);
    if (z !== null) {
      zMin = Math.min(zMin, z);
      zMax = Math.max(zMax, z);
      sumZ += z;
      countZ++;
      validHeights.push(z);
    }
  }

  const avgZ = countZ > 0 ? sumZ / countZ : 0;
  if (zMin === Infinity) { zMin = avgZ; zMax = avgZ; }
  validHeights.sort((a, b) => a - b);
  const percentile = (p, fallback) => validHeights.length ? validHeights[Math.max(0, Math.min(validHeights.length - 1, Math.floor((validHeights.length - 1) * p)))] : fallback;
  const medianZ = validHeights.length ? validHeights[Math.floor(validHeights.length / 2)] : avgZ;
  let madZ = 1;
  if (validHeights.length) {
    const deviations = validHeights.map((v) => Math.abs(v - medianZ));
    deviations.sort((a, b) => a - b);
    madZ = Math.max(0.5, deviations[Math.floor(deviations.length / 2)] || 1);
  }
  state.terrainHeightStats = {
    min: zMin,
    max: zMax,
    avg: avgZ,
    p02: percentile(0.02, zMin),
    p98: percentile(0.98, zMax),
    median: medianZ,
    mad: madZ
  };
  const lowFloor = medianZ - 3 * madZ;

  const roiPolyCache = roiLocalPolygons();
  const hasRoiCache = roiPolyCache.length > 0;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const [wx, wy] = localToMeters(lx, -ly);
    let z = robustTerrainHeightAtProjected(wx, wy, avgZ);
    if (z === null) z = avgZ;
    if (hasRoiCache && !pointInRoiLocal(lx, -ly, roiPolyCache)) {
      const outsideZ = demHeightMedianAtProjected(wx, wy, avgZ, 3);
      z = Number.isFinite(outsideZ) ? outsideZ : avgZ;
    }
    if (z < lowFloor) {
      const repaired = demHeightMedianAtProjected(wx, wy, lowFloor, 3);
      z = Number.isFinite(repaired) && repaired >= lowFloor ? repaired : lowFloor;
    }
    const edgeBlend = terrainVertexBoundaryBlend(lx, ly, width, depth);
    if (edgeBlend > 0) {
      const smoothZ = demHeightMedianAtProjected(wx, wy, z, 3);
      z = z * (1 - edgeBlend) + smoothZ * edgeBlend;
    }
    pos.setZ(i, z);
  }
  limitTerrainBoundarySpikes(pos, segments, width, depth, avgZ, roiPolyCache);
  smoothTerrainSurface(pos, segments, width, depth);
  if (shouldApplyIslandPlateaus(blocksFc)) {
    applyIslandPlateaus(pos, segments, width, depth, blocksFc, settings.islandPlateauTransition);
  } else {
    islandPlateauCache.length = 0;
    invalidatePlateauIndex();
  }
  const finalStats = terrainHeightStatsFromPositions(pos);
  state.terrainHeightStats = finalStats;
  zMin = finalStats.min;
  zMax = finalStats.max;
  buildTerrainSurfaceCache(pos, segments, width, depth);
  geo.computeVertexNormals();
  const useTopoTint = settings.terrainAnalysisMode && settings.terrainAnalysisMode !== 'Texture';
  if (useTopoTint) {
    const colors = [];
    const normals = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      let color;
      if (settings.terrainAnalysisMode === 'Slope tint') {
        const steep = 1 - Math.max(0, Math.min(1, normals.getZ(i)));
        color = new THREE.Color().setHSL(0.33 - steep * 0.33, 0.72, 0.46 + steep * 0.10);
      } else {
        const tZ = (z - zMin) / Math.max(1e-6, zMax - zMin);
        color = new THREE.Color().setHSL(0.58 - tZ * 0.45, 0.62, 0.42 + tZ * 0.18);
      }
      colors.push(color.r, color.g, color.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  const useBaseMapTexture = settings.showXyzTiles && state.baseMapTexture;
  const useRasterTexture = !useBaseMapTexture && isRasterTextureMode() && settings.showTerrainTexture && state.terrainTexture;
  const groundTex = useBaseMapTexture
    ? state.baseMapTexture
    : (useRasterTexture
      ? state.terrainTexture
    : (settings.pavementStyle === 'Asphalt'
      ? createAsphaltTexture()
      : await textureFromSet('pavement', settings.pavementStyle,
        width / Math.max(2, settings.terrainTileMeters || 60),
        depth / Math.max(2, settings.terrainTileMeters || 60))));
  if (isSceneBuildStale(buildToken)) {
    geo.dispose();
    return false;
  }
  const terrainOpacity = useRasterTexture ? settings.terrainTextureOpacity : 1;
  const roiMaskTexture = createRoiMaskTexture(width, depth);
  const clipTerrainToRoi = !settings.showOutsideRoiTerrain && !!roiMaskTexture;
  const maskTextureToRoi = settings.showOutsideRoiTerrain && !useTopoTint && !!roiMaskTexture && !!groundTex;
  const materialOptions = {
    color: maskTextureToRoi ? new THREE.Color(settings.terrainOutsideColor || '#edf2ef') : 0xffffff,
    map: useTopoTint || maskTextureToRoi ? null : groundTex,
    alphaMap: clipTerrainToRoi ? roiMaskTexture : null,
    alphaTest: clipTerrainToRoi ? 0.02 : 0,
    vertexColors: useTopoTint,
    transparent: clipTerrainToRoi || (!maskTextureToRoi && terrainOpacity < 1),
    opacity: maskTextureToRoi ? 1 : terrainOpacity,
    roughness: (useRasterTexture || useBaseMapTexture) ? 0.82 : 0.95,
    metalness: 0.02,
    depthWrite: true
  };
  const mat = new THREE.MeshStandardMaterial(materialOptions);
  state.terrainMesh = new THREE.Mesh(geo, mat);
  state.terrainMesh.rotation.x = -Math.PI / 2;
  state.terrainMesh.receiveShadow = true;
  state.terrainMesh.renderOrder = -30;
  world.add(state.terrainMesh);
  if (maskTextureToRoi) {
    const overlayMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      alphaMap: roiMaskTexture,
      alphaTest: 0.02,
      transparent: true,
      opacity: terrainOpacity,
      roughness: (useRasterTexture || useBaseMapTexture) ? 0.82 : 0.95,
      metalness: 0.02,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    state.terrainOverlayMesh = new THREE.Mesh(geo.clone(), overlayMat);
    state.terrainOverlayMesh.rotation.x = -Math.PI / 2;
    state.terrainOverlayMesh.receiveShadow = false;
    state.terrainOverlayMesh.renderOrder = -29;
    world.add(state.terrainOverlayMesh);
  }
  buildTerrainSideSkirt(width, depth, zMin, finalStats.avg);
  _lastTerrainY = finalStats.avg;   // stable terrain height for the fallback path
  const terrainLabel = state.demSampler?.flat ? 'Flat terrain plane' : 'mydem.tif';
  setStatus(`${t('demLoaded')} (${terrainLabel}). Z: ${zMin.toFixed(1)} - ${zMax.toFixed(1)} m`);
  return true;
}

/* terrainLocalYAt: reads the height straight from the DEM.
 * No raycasting: it uses the same source as demHeightAtProjected, so it does
 * not depend on the terrain mesh's segment resolution. */
let _lastTerrainY = 0;
export function terrainLocalYAt(localX, localZ) {
  if (islandPlateauCache.length) {
    for (const cache of plateauCandidates(localX, localZ) || []) {
      const t = cache.transition || 0;
      if (localX < cache.bbox.minX - t || localX > cache.bbox.maxX + t) continue;
      if (localZ < cache.bbox.minZ - t || localZ > cache.bbox.maxZ + t) continue;
      if (pointInLocalPolys(localX, localZ, cache.localRings)) {
        return cache.plateauY;
      }
    }
  }
  const cachedY = terrainSurfaceCacheYAt(localX, localZ);
  if (cachedY !== null) {
    return cachedY;
  }
  if (!state.demSampler || state.demSampler.flat) return _lastTerrainY;
  const [wx, wy] = localToMeters(localX, localZ);
  const z = robustTerrainHeightAtProjected(wx, wy, null);
  if (z !== null) {
    return z;
  }
  return _lastTerrainY;
}
