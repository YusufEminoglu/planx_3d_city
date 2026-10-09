// Narrative tours: camera keyframes with captions and settings, playback,
// JSON export, and frame-by-frame MP4 rendering (video_export.js).
import * as THREE from 'three';
import { updateBuildingLod } from '../building_batch.js';
import { t } from '../ui_text.js';
import { state } from '../core/state.js';
import {
  isPortableMode, camera, renderer, composer, controls, sun, fitSunShadow, buildingGroup
} from '../core/scene.js';
import { settings } from '../core/settings.js';
import { requestRender, renderCleanFrame } from '../core/render.js';
import { setStatus } from './status.js';
import { viewerMode } from '../core/data.js';
import { checkTimeChange } from '../layers/environment.js';
import { updateDockControls } from './dock_controls.js';
import { rebuildScene } from '../core/scene_build.js';

export const tourState = {
  keyframes: [],
  duration: 18,
  loop: false,
  playing: false,
  currentTime: 0,
  startedAt: 0,
  startTime: 0
};
let selectedTourIndex = -1;

export function loadTourState() {
  if (isPortableMode) return;
  try {
    const raw = localStorage.getItem('planx_3d_city_tour');
    if (!raw) return;
    applyTourData(JSON.parse(raw), false);
  } catch (err) {
    console.warn('Could not restore PlanX tour', err);
  }
}

function applyTourData(data, persist = true) {
  tourState.keyframes = Array.isArray(data?.keyframes) ? data.keyframes : [];
  tourState.duration = Number(data?.duration) || tourState.duration || 18;
  tourState.loop = !!data?.loop;
  selectedTourIndex = tourState.keyframes.length ? 0 : -1;
  if (persist) saveTourState();
  updateTourControls();
  renderTourList();
}

async function loadBundledTourStateIfAvailable() {
  if (tourState.keyframes.length) return false;
  try {
    const r = await fetch('../data/planx_tour.json', { cache: 'no-store' });
    if (!r.ok) return false;
    const data = await r.json();
    applyTourData(data, true);
    setStatus(t('tourLoaded'));
    return true;
  } catch (err) {
    console.warn('Bundled PlanX tour could not be loaded', err);
    return false;
  }
}

function saveTourState() {
  if (isPortableMode) return;
  try {
    localStorage.setItem('planx_3d_city_tour', JSON.stringify({
      keyframes: tourState.keyframes,
      duration: tourState.duration,
      loop: tourState.loop
    }));
  } catch (err) {
    console.warn('Could not save PlanX tour', err);
  }
}

const TOUR_SETTING_KEYS = [
  'showIslands', 'islandTransparency', 'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture',
  'showCars', 'showRoads', 'showSidewalks', 'showPedestrianPaths', 'showCrosswalks', 'showPedestrians',
  'showBikeLanes', 'showBikes', 'bikeLaneWidth', 'bikeLaneColor', 'bikeDensity', 'bikeSpeed',
  'roadColorMode', 'roadColor', 'sidewalkColor', 'showWindPlumes', 'windDirectionDeg', 'windPlumeDistance',
  'showTerrainTexture', 'showTerrainSides'
];

function vectorToPlain(v) {
  return { x: v.x, y: v.y, z: v.z };
}

function plainToVector(v) {
  return new THREE.Vector3(Number(v?.x) || 0, Number(v?.y) || 0, Number(v?.z) || 0);
}

function captureTourFrame() {
  const sceneSettings = {};
  TOUR_SETTING_KEYS.forEach((key) => { sceneSettings[key] = settings[key]; });
  return {
    camera: vectorToPlain(camera.position),
    target: vectorToPlain(controls.target),
    timeOfDay: settings.timeOfDay,
    settings: sceneSettings,
    caption: document.getElementById('tour-caption')?.value?.trim() || `Keyframe ${tourState.keyframes.length + 1}`
  };
}

function applyTourFrame(frame, rebuild = true) {
  if (!frame) return;
  if (frame.settings) Object.assign(settings, frame.settings);
  if (Number.isFinite(frame.timeOfDay)) settings.timeOfDay = frame.timeOfDay;
  camera.position.copy(plainToVector(frame.camera));
  controls.target.copy(plainToVector(frame.target));
  camera.lookAt(controls.target);
  checkTimeChange();
  updateDockControls();
  if (rebuild) rebuildScene();
}

export function renderTourList() {
  const list = document.getElementById('tour-list');
  if (!list) return;
  list.innerHTML = tourState.keyframes.map((frame, index) => (
    `<div class="tour-item ${index === selectedTourIndex ? 'active' : ''}" data-tour-index="${index}">
      <strong>${index + 1}. ${frame.caption || 'Keyframe'}</strong><br>
      <span>${Number(frame.timeOfDay || 0).toFixed(1)}h - ${frame.settings?.roadColorMode || 'Default'}</span>
    </div>`
  )).join('') || `<div class="tour-item">${t('tourEmpty')}</div>`;
  list.querySelectorAll('[data-tour-index]').forEach((item) => {
    item.addEventListener('click', () => {
      selectedTourIndex = Number(item.dataset.tourIndex);
      const frame = tourState.keyframes[selectedTourIndex];
      const input = document.getElementById('tour-caption');
      if (input) input.value = frame.caption || '';
      applyTourFrame(frame, true);
      renderTourList();
    });
  });
}

function updateTourControls() {
  document.querySelectorAll('[data-tour-setting]').forEach((el) => {
    const key = el.dataset.tourSetting;
    if (!(key in tourState)) return;
    if (el.type === 'checkbox') el.checked = !!tourState[key];
    else el.value = tourState[key];
  });
}

function addTourKeyframe() {
  tourState.keyframes.push(captureTourFrame());
  selectedTourIndex = tourState.keyframes.length - 1;
  saveTourState();
  renderTourList();
}

function updateTourKeyframe() {
  if (selectedTourIndex < 0 || selectedTourIndex >= tourState.keyframes.length) return;
  tourState.keyframes[selectedTourIndex] = captureTourFrame();
  saveTourState();
  renderTourList();
}

function deleteTourKeyframe() {
  if (selectedTourIndex < 0 || selectedTourIndex >= tourState.keyframes.length) return;
  tourState.keyframes.splice(selectedTourIndex, 1);
  selectedTourIndex = Math.min(selectedTourIndex, tourState.keyframes.length - 1);
  saveTourState();
  renderTourList();
}

function playTour() {
  if (tourState.keyframes.length < 2) return;
  settings.autoOrbit = false;
  tourState.playing = true;
  tourState.startTime = performance.now() - tourState.currentTime * 1000;
  controls.enabled = false;
}

export function pauseTour() {
  tourState.playing = false;
  controls.enabled = !state.isWalkMode;
  document.getElementById('tour-caption-overlay')?.classList.add('hidden');
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function applyTourPlayback() {
  if (!tourState.playing || tourState.keyframes.length < 2) return;
  const duration = Math.max(1, Number(tourState.duration) || 18);
  tourState.currentTime = (performance.now() - tourState.startTime) / 1000;
  if (tourState.currentTime > duration) {
    if (tourState.loop) {
      tourState.startTime = performance.now();
      tourState.currentTime = 0;
    } else {
      pauseTour();
      tourState.currentTime = duration;
    }
  }
  const active = applyTourAt(tourState.currentTime);
  const caption = document.getElementById('tour-caption-overlay');
  if (caption) {
    caption.textContent = active?.caption || '';
    caption.classList.toggle('hidden', !active?.caption);
  }
}

// The tour state at `seconds` (camera, target, time of day, keyframe
// settings); returns the keyframe whose caption and settings apply.
function applyTourAt(seconds) {
  const frames = tourState.keyframes;
  if (frames.length < 2) return null;
  const duration = Math.max(1, Number(tourState.duration) || 18);
  const totalSegments = frames.length - 1;
  const progress = Math.min(1, Math.max(0, seconds / duration));
  const segmentFloat = progress * totalSegments;
  const idx = Math.min(totalSegments - 1, Math.floor(segmentFloat));
  const localT = easeInOutCubic(segmentFloat - idx);
  const a = frames[idx];
  const b = frames[idx + 1];
  camera.position.lerpVectors(plainToVector(a.camera), plainToVector(b.camera), localT);
  controls.target.lerpVectors(plainToVector(a.target), plainToVector(b.target), localT);
  camera.lookAt(controls.target);
  settings.timeOfDay = (Number(a.timeOfDay) || 0) + ((Number(b.timeOfDay) || 0) - (Number(a.timeOfDay) || 0)) * localT;
  const active = localT < 0.5 ? a : b;
  if (active.settings) Object.assign(settings, active.settings);
  checkTimeChange();
  return active;
}

// --- Tour video (MP4): every frame rendered at its exact tour time ---
export async function renderTourVideo() {
  if (tourState.keyframes.length < 2) {
    setStatus('Tour video: add at least two keyframes first.', true);
    return;
  }
  const { encodeVideo, videoExportSupported } = await import('../video_export.js');
  if (!videoExportSupported()) {
    setStatus('Tour video needs a browser with WebCodecs (Chrome, Edge, recent Firefox). The webm recorder in the camera panel still works.', true);
    return;
  }
  const preset = document.getElementById('tour-video-size')?.value || '1080';
  const [width, height] = preset === '2160' ? [3840, 2160] : (preset === '720' ? [1280, 720] : [1920, 1080]);
  const fps = 30;
  const duration = Math.max(1, Number(tourState.duration) || 18);
  const frameCount = Math.round(duration * fps);
  if (tourState.playing) pauseTour();
  // Render at the video size off screen: the canvas keeps its CSS size.
  const saved = {
    ratio: renderer.getPixelRatio(),
    size: renderer.getSize(new THREE.Vector2()),
    aspect: camera.aspect,
    position: camera.position.clone(),
    target: controls.target.clone(),
    timeOfDay: settings.timeOfDay
  };
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  state.videoExporting = true;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const t0 = performance.now();
    const { blob, codec } = await encodeVideo({
      width, height, fps, frameCount,
      drawFrame: (i) => {
        const active = applyTourAt(i / fps);
        fitSunShadow();
        sun.shadow.needsUpdate = true;
        updateBuildingLod(buildingGroup, camera);
        renderCleanFrame();
        ctx.drawImage(renderer.domElement, 0, 0, width, height);
        if (active?.caption) drawVideoCaption(ctx, active.caption, width, height);
        return out;
      },
      onProgress: (f) => setStatus(`Tour video ${width} x ${height}: ${Math.round(f * 100)}%`)
    });
    const link = document.createElement('a');
    link.download = `planx_3d_city_tour_${height}p.mp4`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 30000);
    setStatus(`Tour video saved: ${frameCount} frames, ${(blob.size / 1048576).toFixed(1)} MB, ${codec}, ${((performance.now() - t0) / 1000).toFixed(0)} s.`);
  } catch (err) {
    console.warn('tour video failed', err);
    setStatus(`Tour video failed: ${err?.message || err}`, true);
  } finally {
    renderer.setPixelRatio(saved.ratio);
    renderer.setSize(saved.size.x, saved.size.y, false);
    composer.setPixelRatio(saved.ratio);
    composer.setSize(saved.size.x, saved.size.y);
    camera.aspect = saved.aspect;
    camera.updateProjectionMatrix();
    camera.position.copy(saved.position);
    controls.target.copy(saved.target);
    settings.timeOfDay = saved.timeOfDay;
    checkTimeChange();
    state.videoExporting = false;
    sun.shadow.needsUpdate = true;
    requestRender();
  }
}

function drawVideoCaption(ctx, text, width, height) {
  const size = Math.round(height * 0.032);
  ctx.save();
  ctx.font = `600 ${size}px Montserrat, 'Segoe UI', sans-serif`;
  const pad = Math.round(size * 0.6);
  const w = Math.min(width * 0.8, ctx.measureText(text).width + pad * 2);
  const x = Math.round(width * 0.04);
  const y = Math.round(height * 0.9) - size - pad;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, size + pad * 2, size * 0.4);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + pad, y + pad + size / 2, w - pad * 2);
  ctx.restore();
}

function exportTourJson() {
  const payload = {
    version: 'planx-tour/v2',
    exportedAt: new Date().toISOString(),
    project: state.projectManifest?.project || null,
    manifestVersion: state.projectManifest?.version || null,
    mode: state.projectManifest?.mode || viewerMode(),
    ...tourState
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'planx_tour.json';
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

export function initTourUi() {
  updateTourControls();
  renderTourList();
  loadBundledTourStateIfAvailable().then((loaded) => {
    if (loaded) {
      updateTourControls();
      renderTourList();
    }
  });
  document.getElementById('tour-add')?.addEventListener('click', addTourKeyframe);
  document.getElementById('tour-update')?.addEventListener('click', updateTourKeyframe);
  document.getElementById('tour-delete')?.addEventListener('click', deleteTourKeyframe);
  document.getElementById('tour-play')?.addEventListener('click', playTour);
  document.getElementById('tour-pause')?.addEventListener('click', pauseTour);
  document.getElementById('tour-export')?.addEventListener('click', exportTourJson);
  document.getElementById('tour-import')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    applyTourData(data, true);
  });
  document.querySelectorAll('[data-tour-setting]').forEach((el) => {
    const handler = () => {
      const key = el.dataset.tourSetting;
      tourState[key] = el.type === 'checkbox' ? el.checked : Number(el.value);
      saveTourState();
    };
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', handler);
  });
}
