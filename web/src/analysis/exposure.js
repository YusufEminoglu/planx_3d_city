// Exposure analyses on the GPU (exposure_analysis.js): sun hours over a
// day, sky view factor and viewsheds, drawn as a coloured drape over
// streets, squares and roofs, with a legend.
import * as THREE from 'three';
import { ExposureAnalysis, skyDirections, sunPathDirections } from '../exposure_analysis.js';
import { solarPosition, compassDirection } from '../geo.js';
import { state } from '../core/state.js';
import {
  scene, renderer, world, islandGroup, buildingGroup, treeGroup, carGroup, bikeGroup, pedestrianGroup,
  windPlumeGroup, roiBoundaryGroup, zoningGroup, scenarioGroup, scenarioGroupB
} from '../core/scene.js';
import { settings } from '../core/settings.js';
import { requestRender } from '../core/render.js';
import { setStatus } from '../ui/status.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

/* Compute a cumulative shadow heatmap across the scene:
 * sample N hours of solar position, raycast from each grid point toward the sun,
 * count how many samples are blocked by buildings/trees/blocks. Score 0 (always
 * sun) .. 1 (always shaded) drives a colour overlay quad above the terrain.
 * Useful for solar access screening of plans. */
// --- Exposure analysis (GPU): direct sun hours or sky view factor ---
// Every surface seen from above (streets, squares, roofs) is analysed at
// about 1.5 m resolution; the result is draped over the scene with a legend.
let exposureAnalysis = null;
let exposureRunning = false;
const EXPOSURE_RAMP = [
  [0.0, [0.27, 0.0, 0.33]],
  [0.25, [0.23, 0.32, 0.55]],
  [0.5, [0.13, 0.57, 0.55]],
  [0.75, [0.37, 0.79, 0.38]],
  [1.0, [0.99, 0.91, 0.14]]
];

function exposureColor(t, out) {
  const v = Math.max(0, Math.min(1, t));
  for (let i = 1; i < EXPOSURE_RAMP.length; i++) {
    const [t1, c1] = EXPOSURE_RAMP[i];
    if (v <= t1) {
      const [t0, c0] = EXPOSURE_RAMP[i - 1];
      const f = (v - t0) / (t1 - t0);
      for (let k = 0; k < 3; k++) out[k] = c0[k] + (c1[k] - c0[k]) * f;
      return out;
    }
  }
  return out;
}

function exposureArea() {
  const box = new THREE.Box3();
  for (const g of [state.terrainMesh, buildingGroup, treeGroup, islandGroup]) if (g) box.expandByObject(g);
  const w = state.bounds.maxX - state.bounds.minX;
  const d = state.bounds.maxY - state.bounds.minY;
  return {
    minX: -w / 2, maxX: w / 2, minZ: -d / 2, maxZ: d / 2,
    minY: Number.isFinite(box.min.y) ? box.min.y : -50,
    maxY: Number.isFinite(box.max.y) ? box.max.y : 200
  };
}

// Hide everything that is not built surface while the depth passes run:
// the sky, moving traffic, transparent overlays.
function withAnalysisVisibility(fn) {
  const hidden = [];
  const hide = (o) => {
    if (o && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  };
  for (const c of scene.children) if (c !== world) hide(c);
  for (const g of [carGroup, bikeGroup, pedestrianGroup, windPlumeGroup, roiBoundaryGroup, zoningGroup, scenarioGroup, scenarioGroupB, state.shadowHeatmapMesh]) hide(g);
  return Promise.resolve()
    .then(fn)
    .finally(() => { for (const o of hidden) o.visible = true; });
}

export async function computeExposure(mode = 'sun', eye = null) {
  if (exposureRunning) return;
  if (!state.bounds || !state.terrainMesh) {
    setStatus('Analysis needs a loaded scene.', true);
    return;
  }
  exposureRunning = true;
  removeShadowHeatmap();
  const dayOfYear = Math.max(1, Math.min(365, settings.dayOfYear || 172));
  const latitude = settings.latitude == null ? 39 : settings.latitude;
  const directions = mode === 'viewshed' ? [] : (mode === 'svf'
    ? skyDirections(8, 16)
    : sunPathDirections(solarPosition, compassDirection, dayOfYear, latitude, { stepMinutes: 15 }));
  if (mode === 'sun' && !directions.length) {
    setStatus('Sun hours: the sun does not rise on this day at this latitude.', true);
    exposureRunning = false;
    return;
  }
  const label = mode === 'viewshed' ? 'Viewshed' : (mode === 'svf' ? 'Sky view factor' : 'Sun hours');
  const maxDistance = Math.max(50, Number(settings.viewshedRadius) || 500);
  try {
    setStatus(`${label}: preparing...`);
    await new Promise((r) => setTimeout(r, 0));
    if (!exposureAnalysis) exposureAnalysis = new ExposureAnalysis(renderer);
    const area = exposureArea();
    const span = Math.max(area.maxX - area.minX, area.maxZ - area.minZ);
    const resolution = Math.min(2048, Math.max(512, Math.ceil(span / 1.5)));
    const t0 = performance.now();
    const result = await withAnalysisVisibility(() => exposureAnalysis.run({
      scene, area, directions, resolution, eye, maxDistance,
      onProgress: (f) => setStatus(`${label}: ${Math.round(f * 100)}%`)
    }));
    showExposureOverlay(result, mode, { dayOfYear, latitude, directions: directions.length || 6, eye, maxDistance });
    setStatus(`${label} ready: ${result.size} x ${result.size} grid, ${((performance.now() - t0) / 1000).toFixed(1)} s.`);
  } catch (err) {
    console.warn('exposure analysis failed', err);
    setStatus(`${label} failed: ${err?.message || err}`, true);
  } finally {
    exposureRunning = false;
    requestRender();
  }
}

function showExposureOverlay(result, mode, info) {
  const { size, area, values, coverage, heights } = result;
  // Scale: hours of direct sun (0 .. longest exposure), or SVF 0..1.
  let maxValue = 0;
  for (let i = 0; i < values.length; i++) if (coverage[i] > 0 && values[i] > maxValue) maxValue = values[i];
  const scaleMax = mode === 'sun' ? Math.max(0.25, maxValue) : 1;
  const data = new Uint8Array(size * size * 4);
  const rgb = [0, 0, 0];
  for (let y = 0; y < size; y++) {
    // DataTexture rows start at v = 0 (south); result row 0 is north.
    const dst = (size - 1 - y) * size;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const o = (dst + x) * 4;
      if (!(coverage[i] > 0)) continue;
      if (mode === 'viewshed') {
        // Seen from the observer: green; hidden within the radius: dark.
        const seen = values[i] > 0;
        rgb[0] = seen ? 0.13 : 0.2;
        rgb[1] = seen ? 0.85 : 0.05;
        rgb[2] = seen ? 0.37 : 0.3;
      } else {
        exposureColor(values[i] / scaleMax, rgb);
      }
      data[o] = Math.round(rgb[0] * 255);
      data[o + 1] = Math.round(rgb[1] * 255);
      data[o + 2] = Math.round(rgb[2] * 255);
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  // Drape over the analysed surfaces: one vertex every few texels.
  const seg = Math.min(384, size);
  const w = area.maxX - area.minX;
  const d = area.maxZ - area.minZ;
  const geo = new THREE.PlaneGeometry(w, d, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate((area.minX + area.maxX) / 2, 0, (area.minZ + area.maxZ) / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const tx = Math.min(size - 1, Math.max(0, Math.floor(((x - area.minX) / w) * size)));
    const ty = Math.min(size - 1, Math.max(0, Math.floor(((z - area.minZ) / d) * size)));
    const h = heights[ty * size + tx];
    pos.setY(i, (Number.isFinite(h) ? h : terrainLocalYAt(x, z)) + 0.35);
  }
  // Only surfaces seen from above were analysed: drop the steep triangles the
  // drape would hang down building walls.
  const cell = Math.max(w, d) / seg;
  const index = geo.index.array;
  const kept = [];
  for (let t = 0; t < index.length; t += 3) {
    const ya = pos.getY(index[t]);
    const yb = pos.getY(index[t + 1]);
    const yc = pos.getY(index[t + 2]);
    if (Math.max(ya, yb, yc) - Math.min(ya, yb, yc) <= cell * 1.5) kept.push(index[t], index[t + 1], index[t + 2]);
  }
  geo.setIndex(kept);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  state.shadowHeatmapMesh = new THREE.Mesh(geo, mat);
  state.shadowHeatmapMesh.renderOrder = 100;
  if (info.eye) {
    // Observer marker: a post from the ground to eye height.
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.6, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    post.position.copy(info.eye).add(new THREE.Vector3(0, -0.8, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    head.position.copy(info.eye);
    state.shadowHeatmapMesh.add(post, head);
  }
  world.add(state.shadowHeatmapMesh);
  showExposureLegend(mode, scaleMax, info, result);
}

function showExposureLegend(mode, scaleMax, info, result) {
  let el = document.getElementById('exposure-legend');
  if (!el) {
    el = document.createElement('div');
    el.id = 'exposure-legend';
    document.body.appendChild(el);
  }
  const stops = EXPOSURE_RAMP.map(([t, c]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')}) ${t * 100}%`).join(', ');
  let sum = 0;
  let n = 0;
  for (let i = 0; i < result.values.length; i++) {
    if (result.coverage[i] > 0) {
      sum += result.values[i];
      n++;
    }
  }
  const mean = n ? sum / n : 0;
  const date = new Date(Date.UTC(2025, 0, info.dayOfYear)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (mode === 'viewshed') {
    let seen = 0;
    for (let i = 0; i < result.values.length; i++) if (result.coverage[i] > 0 && result.values[i] > 0) seen++;
    const share = n ? (100 * seen) / n : 0;
    el.innerHTML = `<div class="exposure-title">Viewshed from the marked point (eye 1.6 m, radius ${Math.round(info.maxDistance)} m)</div>`
      + `<div class="exposure-scale"><span><span style="color:#22d95e">■</span> visible ${share.toFixed(0)}%</span><span><span style="color:#330d4d">■</span> hidden ${(100 - share).toFixed(0)}%</span></div>`
      + '<div class="exposure-note">Of the streets, squares and roofs within the radius</div>';
    el.style.display = '';
    return;
  }
  const title = mode === 'svf'
    ? 'Sky view factor (0 = enclosed, 1 = open sky)'
    : `Direct sun, ${date}, lat ${Number(info.latitude).toFixed(1)}° (hours)`;
  const fmt = (v) => (mode === 'svf' ? v.toFixed(2) : v.toFixed(1));
  el.innerHTML = `<div class="exposure-title">${title}</div>`
    + `<div class="exposure-bar" style="background: linear-gradient(90deg, ${stops})"></div>`
    + `<div class="exposure-scale"><span>0</span><span>${fmt(scaleMax / 2)}</span><span>${fmt(scaleMax)}</span></div>`
    + `<div class="exposure-note">Mean ${fmt(mean)} · ${info.directions} ${mode === 'svf' ? 'sky directions' : 'sun positions'} · streets, squares and roofs</div>`;
  el.style.display = '';
}

export function removeShadowHeatmap() {
  const legend = document.getElementById('exposure-legend');
  if (legend) legend.style.display = 'none';
  if (!state.shadowHeatmapMesh) return;
  world.remove(state.shadowHeatmapMesh);
  state.shadowHeatmapMesh.geometry.dispose();
  state.shadowHeatmapMesh.material.map?.dispose();
  state.shadowHeatmapMesh.material.dispose();
  state.shadowHeatmapMesh = null;
}
