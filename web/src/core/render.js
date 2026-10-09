// Drawing frames: on-demand render requests, the plain frame, the settled
// post-processed composite (AO, depth of field, bloom) and the split
// scenario view.
import * as THREE from 'three';
import { state } from './state.js';
import {
  scene, camera, renderer, aoPass, composer, DOF_STRENGTH, dofPass, controls, sun, buildingGroup, zoningGroup,
  scenarioGroup, scenarioGroupB, MAX_PIXEL_RATIO, MIN_PIXEL_RATIO
} from './scene.js';
import { settings } from './settings.js';

// Scenario views: 'Massing' shows the scenario instead of the buildings,
// 'Split' shows existing buildings left of the divider (state.splitFraction)
// and the scenario right of it (two scissored draws; shadows are redrawn for
// each side).
const _splitSize = new THREE.Vector2();
function scenarioViewActive() {
  return settings.scenarioView !== 'Off' && scenarioGroup.children.length > 0;
}

function renderScenarioView() {
  const size = renderer.getSize(_splitSize);
  const split = settings.scenarioView === 'Split' || settings.scenarioView === 'SplitAB';
  const x = split ? Math.round(size.x * state.splitFraction) : 0;
  const showBuildings = buildingGroup.visible;
  const showZoning = zoningGroup.visible;
  renderer.setScissorTest(true);
  if (x > 0) {
    // Left: existing buildings, or scenario B.
    const leftB = settings.scenarioView === 'SplitAB';
    scenarioGroup.visible = false;
    scenarioGroupB.visible = leftB;
    buildingGroup.visible = leftB ? false : showBuildings;
    zoningGroup.visible = leftB ? false : showZoning;
    sun.shadow.needsUpdate = true;
    renderer.setScissor(0, 0, x, size.y);
    renderer.render(scene, camera);
  }
  buildingGroup.visible = false;
  zoningGroup.visible = false;
  scenarioGroupB.visible = false;
  scenarioGroup.visible = true;
  sun.shadow.needsUpdate = true;
  renderer.setScissor(x, 0, size.x - x, size.y);
  renderer.render(scene, camera);
  renderer.setScissorTest(false);
  buildingGroup.visible = showBuildings;
  zoningGroup.visible = showZoning;
}

// One frame of the scene without post-processing.
export function drawScene() {
  if (scenarioViewActive()) renderScenarioView();
  else renderer.render(scene, camera);
}

export function useComposite() {
  return settings.enableSSAO || settings.depthOfField;
}

// The settled frame: AO and depth of field as set.
const _dofDir = new THREE.Vector3();
export function renderComposite() {
  if (scenarioViewActive()) {
    // The split view is drawn without the composite (AO/DoF per side would
    // need two composers).
    renderScenarioView();
    return;
  }
  aoPass.enabled = !!settings.enableSSAO;
  dofPass.enabled = !!settings.depthOfField;
  if (dofPass.enabled) {
    // The camera range changes with the scene size: keep depth decoding in step.
    dofPass.uniforms.nearClip.value = camera.near;
    dofPass.uniforms.farClip.value = camera.far;
    dofPass.uniforms.aspect.value = camera.aspect;
    // Focus on the screen centre: where the view direction meets the ground
    // at the orbit target's height (the target itself can be off-centre).
    camera.getWorldDirection(_dofDir);
    const drop = controls.target.y - camera.position.y;
    const along = _dofDir.y < -1e-3 ? drop / _dofDir.y : -1;
    const focus = along > 0 ? along : camera.position.distanceTo(controls.target);
    dofPass.uniforms.focus.value = focus;
    // Blur by relative depth, so the effect looks alike at street level and
    // over the whole city: full blur at half the focus distance off-focus.
    dofPass.uniforms.aperture.value = DOF_STRENGTH / Math.max(1, focus);
  }
  composer.render();
}

// On-demand rendering. A frame is drawn while something moves (camera,
// traffic, weather, tours, fly-to, time-lapse) or shortly after any input or
// scene change; otherwise the last frame stays on screen and the GPU idles.
// The AO/bloom composite is drawn once when the view settles, and a slow
// heartbeat repaints anything that changed without going through here.
export const RENDER_HEARTBEAT_MS = 1000;

export function requestRender(ms = 600) {
  state.renderKeepAliveUntil = Math.max(state.renderKeepAliveUntil, performance.now() + ms);
  state.composerSettled = false;
}
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'input', 'change', 'click', 'resize']) {
  window.addEventListener(type, () => requestRender(), { passive: true, capture: true });
}
// Settings edits can move, hide or restyle shadow casters.
for (const type of ['input', 'change']) {
  window.addEventListener(type, () => { sun.shadow.needsUpdate = true; }, { passive: true, capture: true });
}

// --- Screenshot ---
export function renderCleanFrame() {
  if (useComposite()) renderComposite(); else drawScene();
}

export let _dynPixelRatio = MAX_PIXEL_RATIO;

// Callers render right after this, in the same task: resizing the canvas
// clears it, and a frame composited in between would flash blank.
export function setDynamicPixelRatio(ratio) {
  const next = Math.max(MIN_PIXEL_RATIO, Math.min(MAX_PIXEL_RATIO, ratio));
  if (Math.abs(next - _dynPixelRatio) < 0.01) return;
  _dynPixelRatio = next;
  renderer.setPixelRatio(next);
  composer.setPixelRatio(next);
}
