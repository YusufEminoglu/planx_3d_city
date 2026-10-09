// View links: the camera and time of day in the URL (#view=...), applied
// on load and when the hash changes.
import * as THREE from 'three';
import { hashWithView, viewFromHash } from '../capture.js';
import { state } from '../core/state.js';
import { camera, controls, sun } from '../core/scene.js';
import { settings } from '../core/settings.js';
import { requestRender } from '../core/render.js';
import { setStatus } from './status.js';
import { updateTimeOfDay } from '../core/daylight.js';

// --- View links: the camera in the URL hash ---
function currentView() {
  return {
    position: camera.position.toArray(),
    target: controls.target.toArray(),
    fov: camera.fov,
    timeOfDay: settings.timeOfDay
  };
}

export function applyView(view, { fly = false } = {}) {
  if (!view) return;
  if (view.fov !== camera.fov) {
    camera.fov = view.fov;
    settings.fov = view.fov;
    camera.updateProjectionMatrix();
  }
  if (Number.isFinite(view.timeOfDay) && view.timeOfDay !== settings.timeOfDay) {
    settings.timeOfDay = view.timeOfDay;
    updateTimeOfDay();
  }
  if (fly) {
    state.flyOrigin = camera.position.clone();
    state.flyTarget = new THREE.Vector3(...view.position);
    state.flyControlsTarget = new THREE.Vector3(...view.target);
    state.flyT = 0;
  } else {
    camera.position.set(...view.position);
    controls.target.set(...view.target);
    controls.update();
  }
  state.lastCameraMove = performance.now();
  sun.shadow.needsUpdate = true;
  requestRender();
}

async function copyViewLink() {
  const hash = hashWithView(location.hash, currentView());
  history.replaceState(null, '', hash);
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('View link copied.');
  } catch {
    window.prompt('Copy this view link:', url);
  }
}

window.addEventListener('hashchange', () => applyView(viewFromHash(location.hash), { fly: true }));
document.getElementById('btn-copy-view')?.addEventListener('click', copyViewLink);
