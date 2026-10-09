import * as THREE from 'three';
import { buildingPickTargets, updateBuildingLod } from './building_batch.js';
import { updateWind, windActive } from './wind.js';
import { viewFromHash } from './capture.js';
import { t } from './ui_text.js';
import { state } from './core/state.js';
import {
  isPortableMode, scene, camera, renderer, MAX_PIXEL_RATIO, labelRenderer, composer, dofPass, controls,
  walkControls, sun, fitSunShadow, world, islandGroup, buildingGroup, roadGroup, treeGroup, carGroup,
  pedestrianGroup, sidewalkGroup, rc
} from './core/scene.js';
import { settings, savePersistedSettings } from './core/settings.js';
import {
  drawScene, useComposite, renderComposite, RENDER_HEARTBEAT_MS, requestRender, renderCleanFrame,
  _dynPixelRatio, setDynamicPixelRatio
} from './core/render.js';
import { setStatus } from './ui/status.js';
import { layerBuildTimings } from './core/scene_util.js';
import { terrainLocalYAt } from './terrain/terrain.js';
import { loadMosqueCustomizations } from './core/model_store.js';
import { buildScenario } from './layers/zoning.js';
import { computeExposure } from './analysis/exposure.js';
import { checkTimeChange, updateWeather, updateWeatherParticles } from './layers/environment.js';
import { updateMinimapCamera, updateScaleBar } from './ui/minimap.js';
import { scheduleSceneStateSave, hydratePortableSceneState } from './core/scene_state.js';
import { updateDockControls } from './ui/dock_controls.js';
import { setSceneBuildHooks, handleSceneError, rebuildSceneSafe } from './core/scene_build.js';
import {
  renderUploadedModelsList, renderTreePoolList, renderModelTransformControls, renderMosqueCustomizationsList,
  renderTumulusCustomizationsList
} from './ui/model_studio.js';
import {
  tourState, loadTourState, renderTourList, pauseTour, applyTourPlayback, renderTourVideo, initTourUi
} from './ui/tour.js';
import { functionGuiRefs, addGui } from './ui/gui.js';
import { renderBlockCategoryStyleDock, renderFunctionStyleDock, initDockUi } from './ui/docks.js';
import { stopRecording } from './ui/recording.js';
import { applyView } from './ui/views.js';
import { takeScreenshot } from './ui/exports.js';
import { updateTraffic } from './layers/mobility.js';

let _pendingPixelRatio = null;

// Walk mode (pointer lock) and the slingshot game.
let gameScore = 0;
const stoneProjectiles = []; // { mesh, velocity, life }
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let sprintWalk = false;
let crouchWalk = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let prevTime = performance.now();

// Frame loop bookkeeping: last settled composite and frame, minimap and
// scale bar refreshes, and the FPS sample.
let _lastSSAORender = 0;
let _lastFrameRender = 0;
const _loadingEl = document.getElementById('loading');
let _mmLastUpdate = 0;
let _sbLastUpdate = 0;
let _fpsLastSample = 0;
let _fpsFrames = 0;
let _fpsValue = 0;

// Start-up: saved customisations and tour, sun and weather for the saved time.
loadMosqueCustomizations();
loadTourState();
checkTimeChange();
updateWeather();

// Portable build: load and apply the frozen scene snapshot BEFORE the GUI and
// scene are built, so every control and layer reflects the saved state instead
// of bare defaults (settings, styles, Model Studio models, mosque/tumulus overrides).
// Wrapped so a bad/absent snapshot can never block the scene from building.
if (isPortableMode) {
  try {
    await hydratePortableSceneState();
  } catch (err) {
    console.warn('Portable scene snapshot could not be applied; using defaults.', err);
  }
}

addGui();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

const walkBtn = document.getElementById('walk-toggle');
if (walkBtn) {
  walkBtn.addEventListener('click', () => {
    if (!state.isWalkMode) walkControls.lock();
    else walkControls.unlock();
  });
}
walkControls.addEventListener('lock', () => {
  state.isWalkMode = true;
  controls.enabled = false;
  if(walkBtn) walkBtn.classList.add('active');
  document.getElementById('walk-hud')?.classList.remove('hidden');
  const ty = terrainLocalYAt(camera.position.x, camera.position.z);
  camera.position.y = ty + 1.8;
});
walkControls.addEventListener('unlock', () => {
  state.isWalkMode = false;
  controls.enabled = true;
  moveForward = moveBackward = moveLeft = moveRight = false;
  sprintWalk = false;
  crouchWalk = false;
  if(walkBtn) walkBtn.classList.remove('active');
  document.getElementById('walk-hud')?.classList.add('hidden');
  // Also exit game mode if pointer unlocked
  if (state.isGameMode) {
    state.isGameMode = false;
    const gameBtn = document.getElementById('game-toggle');
    if (gameBtn) gameBtn.classList.remove('active');
    const gameHud = document.getElementById('game-hud');
    if (gameHud) gameHud.classList.add('hidden');
  }
});

const gameBtn = document.getElementById('game-toggle');
if (gameBtn) {
  gameBtn.addEventListener('click', () => {
    if (!state.isGameMode) {
      // Enter walk mode first, then game mode
      if (!state.isWalkMode) walkControls.lock();
      state.isGameMode = true;
      gameBtn.classList.add('active');
      const gameHud = document.getElementById('game-hud');
      if (gameHud) gameHud.classList.remove('hidden');
      const scoreEl = document.getElementById('game-score');
      if (scoreEl) scoreEl.textContent = gameScore;
    } else {
      state.isGameMode = false;
      gameBtn.classList.remove('active');
      const gameHud = document.getElementById('game-hud');
      if (gameHud) gameHud.classList.add('hidden');
    }
  });
}

function shootStone() {
  const geo = new THREE.SphereGeometry(0.12, 6, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  mesh.position.copy(camera.position).addScaledVector(dir, 0.5);

  const speed = 28;
  const vel = dir.clone().multiplyScalar(speed);
  vel.y += 2; // slight upward arc

  // Raycast against pedestrians for instant hit detection
  rc.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = rc.intersectObjects(pedestrianGroup.children, true);
  if (hits.length > 0 && hits[0].distance < 40) {
    const hitMesh = hits[0].object;
    gameScore++;
    const scoreEl = document.getElementById('game-score');
    if (scoreEl) scoreEl.textContent = gameScore;

    // Bounce animation: quick scale pulse
    const origScale = hitMesh.scale.clone();
    hitMesh.scale.set(1.5, 0.4, 1.5);
    setTimeout(() => {
      hitMesh.scale.set(0.8, 1.8, 0.8);
      setTimeout(() => hitMesh.scale.copy(origScale), 150);
    }, 100);

    // Show hit feedback
    const fb = document.getElementById('game-feedback');
    if (fb) {
      fb.textContent = t('sapanHit');
      fb.style.opacity = '1';
      setTimeout(() => { fb.style.opacity = '0'; }, 700);
    }
  }

  scene.add(mesh);
  stoneProjectiles.push({ mesh, velocity: vel, life: 1.8 });
}

// Click to shoot in game mode
window.addEventListener('click', (e) => {
  if (!state.isGameMode || !state.isWalkMode) return;
  shootStone();
});

function togglePresentationMode(forceState) {
  const isPresenting = forceState !== undefined 
    ? forceState 
    : !document.body.classList.contains('presentation-mode');
  
  document.body.classList.toggle('presentation-mode', isPresenting);

  let indicator = document.getElementById('scene-state-indicator');
  if (indicator && isPresenting) {
    indicator.textContent = 'Clean Presentation Mode (Press P or Esc to exit)';
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 3000);
  }
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'shortcuts-close') {
    document.getElementById('shortcuts-modal')?.classList.add('hidden');
  }
});

document.addEventListener('keydown', (e) => {
  // Input safety guard for form fields
  const tag = document.activeElement?.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const shortcutsModal = document.getElementById('shortcuts-modal');
  const isModalOpen = shortcutsModal && !shortcutsModal.classList.contains('hidden');

  if ((e.code === 'KeyH' || e.key === '?') && !e.repeat && !state.isWalkMode) {
    e.preventDefault();
    shortcutsModal?.classList.toggle('hidden');
    return;
  }

  if (e.code === 'Escape') {
    if (isModalOpen) { shortcutsModal.classList.add('hidden'); return; }
    if (document.body.classList.contains('presentation-mode')) { togglePresentationMode(false); return; }
    if (state.isWalkMode) { walkControls.unlock(); return; }
    document.querySelectorAll('.dock-panel').forEach(d => d.classList.remove('open'));
    return;
  }

  if (e.code === 'KeyP' && !state.isWalkMode && !isModalOpen) {
    e.preventDefault();
    togglePresentationMode();
    return;
  }

  if (e.code === 'KeyL' && !state.isWalkMode && !isModalOpen) {
    e.preventDefault();
    document.getElementById('layer-dock')?.classList.toggle('open');
    return;
  }

  if (e.code === 'KeyS' && !state.isWalkMode && !isModalOpen && !e.ctrlKey) {
    e.preventDefault();
    document.getElementById('scene-dock')?.classList.toggle('open');
    return;
  }

  if (e.code === 'Space' && !e.ctrlKey && !state.isWalkMode && !isModalOpen) {
    e.preventDefault();
    settings.autoTime = !settings.autoTime;
    checkTimeChange();
    updateDockControls();
    return;
  }

  // W enters walk mode from orbit mode; inside walk mode it remains forward movement.
  if (e.code === 'KeyW' && !e.repeat && !state.isWalkMode) {
    walkControls.lock();
    return;
  }
  // Ctrl+Space = stop recording from anywhere (including pointer-lock)
  if (e.code === 'Space' && e.ctrlKey) {
    stopRecording();
    return;
  }
  if (!state.isWalkMode) return;
  switch (e.code) {
    case 'ArrowUp':  case 'KeyW': moveForward  = true; break;
    case 'ArrowLeft':  case 'KeyA': moveLeft  = true; break;
    case 'ArrowDown':  case 'KeyS': moveBackward = true; break;
    case 'ArrowRight': case 'KeyD': moveRight = true; break;
    case 'ShiftLeft': case 'ShiftRight': sprintWalk = true; break;
    case 'KeyC': crouchWalk = true; break;
  }
});
document.addEventListener('keyup', (e) => {
  if (!state.isWalkMode) return;
  switch (e.code) {
    case 'ArrowUp':  case 'KeyW': moveForward  = false; break;
    case 'ArrowLeft':  case 'KeyA': moveLeft  = false; break;
    case 'ArrowDown':  case 'KeyS': moveBackward = false; break;
    case 'ArrowRight': case 'KeyD': moveRight = false; break;
    case 'ShiftLeft': case 'ShiftRight': sprintWalk = false; break;
    case 'KeyC': crouchWalk = false; break;
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (state.videoExporting || state.xrActive) return;
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  
  if (state.isWalkMode) {
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    
    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize(); // consistent speed
    
    const wSpd = 92.0 * settings.walkSpeed * (sprintWalk ? 1.85 : 1.0) * (crouchWalk ? 0.45 : 1.0);
    if (moveForward || moveBackward) velocity.z -= direction.z * wSpd * delta;
    if (moveLeft || moveRight) velocity.x -= direction.x * wSpd * delta;
    
    walkControls.moveRight(-velocity.x * delta);
    walkControls.moveForward(-velocity.z * delta);
    
    const ty = terrainLocalYAt(camera.position.x, camera.position.z);
    const eyeHeight = crouchWalk ? 1.18 : 1.72;
    camera.position.y += ((ty + eyeHeight) - camera.position.y) * Math.min(1, delta * 12);
  } else {
    controls.update();
  }
  prevTime = time;

  updateWeatherParticles();
  updateTraffic(time, delta);

  // Stone projectiles (slingshot game)
  for (let i = stoneProjectiles.length - 1; i >= 0; i--) {
    const s = stoneProjectiles[i];
    s.mesh.position.addScaledVector(s.velocity, delta);
    s.velocity.y -= 9.8 * delta; // gravity arc
    s.life -= delta;
    if (s.life <= 0) {
      scene.remove(s.mesh);
      stoneProjectiles.splice(i, 1);
    }
  }
  
  // Auto-orbit (only in non-walk mode)
  if (settings.autoOrbit && !state.isWalkMode) {
    controls.autoRotate = true;
    controls.autoRotateSpeed = settings.autoOrbitSpeed;
  } else {
    controls.autoRotate = false;
  }

  // Auto time-lapse (solar animation)
  if (settings.autoTime) {
    settings.timeOfDay = (settings.timeOfDay + settings.autoTimeSpeed * delta) % 24;
    checkTimeChange();
  }

  // Fly-to animation
  if (state.flyT < 1.0) {
    state.flyT = Math.min(state.flyT + delta * 1.0, 1.0);
    const ease = 1 - Math.pow(1 - state.flyT, 3);
    camera.position.lerpVectors(state.flyOrigin, state.flyTarget, ease);
    if (state.flyControlsTarget) controls.target.lerp(state.flyControlsTarget, ease * 0.12);
  }

  applyTourPlayback();

  // Settle: run the full composite (AO, MSAA, bloom) only once the camera has been still 300ms
  // → smooth orbit at 60fps, quality rendering when static
  const _now = performance.now();
  const _camMoving = (_now - state.lastCameraMove) < 300;
  const _windOn = windActive() && treeGroup.visible && treeGroup.children.length > 0;
  const _hasAnim = state.isWalkMode || state.cars.length > 0 || state.bikes.length > 0 || state.pedestrians.length > 0
    || settings.weather !== 'Clear' || stoneProjectiles.length > 0 || state.flyT < 1.0
    || settings.autoOrbit || settings.autoTime || tourState.playing || _windOn;
  if (_windOn) updateWind(_now / 1000);
  // The opaque loading overlay hides the scene while it is being built:
  // drawing behind it only competes with the build (and its workers).
  if (_loadingEl && _loadingEl.style.display !== 'none' && _loadingEl.style.opacity !== '0') return;
  const _useComposer = useComposite();
  updateBuildingLod(buildingGroup, camera);
  // Walking moves the camera without orbit-control events; refit the shadow
  // box once the walker has moved a few metres.
  if (state.isWalkMode && sun.target.position.distanceToSquared(camera.position) > 25 + Math.pow(camera.position.y - sun.target.position.y, 2)) {
    sun.shadow.needsUpdate = true;
  }
  if (sun.shadow.needsUpdate) fitSunShadow();
  if (state.isRecording || _hasAnim || _camMoving || _now < state.renderKeepAliveUntil) {
    if (_pendingPixelRatio !== null) setDynamicPixelRatio(_pendingPixelRatio);
    _pendingPixelRatio = null;
    renderer.info.reset();
    drawScene();
    _lastFrameRender = _now;
    state.composerSettled = false;
  } else if (_useComposer && !state.composerSettled) {
    setDynamicPixelRatio(MAX_PIXEL_RATIO);
    _pendingPixelRatio = null;
    renderer.info.reset();
    renderComposite();
    _lastSSAORender = _now;
    _lastFrameRender = _now;
    state.composerSettled = true;
  } else if (_now - _lastFrameRender > RENDER_HEARTBEAT_MS) {
    setDynamicPixelRatio(MAX_PIXEL_RATIO);
    _pendingPixelRatio = null;
    renderer.info.reset();
    if (_useComposer) renderComposite(); else drawScene();
    _lastFrameRender = _now;
    _fpsLastSample = _now;
    return;
  } else {
    // Idle: nothing to draw, and the compass/minimap only follow the camera.
    if (_fpsFrames || _fpsValue) {
      _fpsFrames = 0;
      _fpsValue = 0;
      const chip = document.getElementById('fps-chip');
      if (chip) {
        chip.textContent = 'idle';
        chip.classList.remove('warn', 'bad');
      }
    }
    _fpsLastSample = _now;
    return;
  }

  // Compass
  const compassCanvas = document.getElementById('compass-canvas');
  if (compassCanvas) {
    const ctx = compassCanvas.getContext('2d');
    const cDir = new THREE.Vector3();
    camera.getWorldDirection(cDir);
    const ang = Math.atan2(cDir.x, cDir.z);
    ctx.clearRect(0, 0, 48, 48);
    ctx.save();
    ctx.translate(24, 24);
    ctx.rotate(-ang);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(4, 2); ctx.lineTo(-4, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(4, -2); ctx.lineTo(-4, -2); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = 'bold 9px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 24, 10);

    // Sun azimuth indicator on the compass ring
    if (state.solar.elevationDeg > -3) {
      const sunAzRad = THREE.MathUtils.degToRad(state.solar.azimuthDeg);
      const ringR = 19;
      // Compass already rotated by camera angle (-ang). We want sun's true bearing,
      // so add the camera angle back so the sun marker shows world-space azimuth.
      const drawAng = sunAzRad - ang;
      const sx = Math.sin(drawAng) * ringR + 24;
      const sy = -Math.cos(drawAng) * ringR + 24;
      const elevNorm = Math.max(0, Math.min(1, state.solar.elevationDeg / 75));
      const sunRadius = 3.0 + elevNorm * 1.5;
      ctx.fillStyle = elevNorm > 0.4 ? '#fde68a' : '#f59e0b';
      ctx.strokeStyle = 'rgba(180,120,0,0.85)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, sunRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Minimap + scale bar (throttled ~30fps)
  if (time - _mmLastUpdate > 33) {
    _mmLastUpdate = time;
    const mmWrap = document.getElementById('minimap-wrap');
    if (mmWrap && !mmWrap.classList.contains('collapsed')) updateMinimapCamera();
    if (time - _sbLastUpdate > 300) { _sbLastUpdate = time; updateScaleBar(); }
  }

  // FPS HUD (sample once per second so the number is readable)
  _fpsFrames++;
  if (time - _fpsLastSample > 1000) {
    _fpsValue = Math.round((_fpsFrames * 1000) / (time - _fpsLastSample));
    _fpsFrames = 0;
    _fpsLastSample = time;
    // Applied right before the next draw: resizing clears the canvas.
    if (!state.isRecording) {
      if (_fpsValue < 40) _pendingPixelRatio = _dynPixelRatio - 0.25;
      else if (_fpsValue > 55) _pendingPixelRatio = _dynPixelRatio + 0.25;
    }
    const chip = document.getElementById('fps-chip');
    if (chip) {
      chip.textContent = `${_fpsValue} fps`;
      chip.classList.toggle('warn', _fpsValue < 45 && _fpsValue >= 25);
      chip.classList.toggle('bad', _fpsValue < 25);
    }
  }
}

// Performance probe for benchmarks and the ?perf=1 overlay. Read-only apart
// from timeRender(), which renders synchronously to measure frame cost.
window.__planxPerf = {
  // (typeof guards keep this probe usable when pasted into older builds for A/B runs.)
  timings() {
    return typeof layerBuildTimings === 'undefined' ? {} : { ...layerBuildTimings };
  },
  // Static triangle and mesh counts per top-level scene group.
  breakdown() {
    const out = {};
    const tris = (g) => {
      if (!g) return 0;
      const n = g.index ? g.index.count : (g.attributes.position?.count || 0);
      return n / 3;
    };
    for (const root of [...world.children, ...scene.children.filter((c) => c !== world)]) {
      let t = 0;
      let m = 0;
      root.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        m++;
        t += tris(o.geometry) * (o.isInstancedMesh ? o.count : 1);
      });
      if (!m) continue;
      const name = root.name || [buildingGroup, 'buildings', state.terrainMesh, 'terrain', treeGroup, 'trees', roadGroup, 'roads', islandGroup, 'blocks', sidewalkGroup, 'sidewalks', carGroup, 'cars', pedestrianGroup, 'pedestrians'].reduce((acc, v, i, arr) => (i % 2 === 0 && v === root ? arr[i + 1] : acc), null) || root.type + root.id;
      out[name] = { meshes: m, ktris: Math.round(t / 1000) };
    }
    return out;
  },
  info() {
    let meshes = 0;
    scene.traverse((o) => { if (o.isMesh) meshes++; });
    return {
      fps: _fpsValue,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      programs: renderer.info.programs?.length || 0,
      pixelRatio: renderer.getPixelRatio(),
      meshes
    };
  },
  timeRender(frames = 10) {
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    if (typeof updateBuildingLod === 'function') updateBuildingLod(buildingGroup, camera);
    renderer.render(scene, camera);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      renderer.info.reset();
      renderer.render(scene, camera);
    }
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return (performance.now() - t0) / frames;
  },
  // Average cost of a building pick (hover/click raycast) over a fixed grid of
  // screen points; the first pass includes any lazy acceleration setup.
  timePick(grid = 8) {
    const targets = typeof buildingPickTargets === 'function' ? buildingPickTargets(buildingGroup) : buildingGroup.children;
    const run = () => {
      let hits = 0;
      const t0 = performance.now();
      for (let i = 0; i < grid; i++) {
        for (let j = 0; j < grid; j++) {
          rc.setFromCamera(new THREE.Vector2((i + 0.5) / grid * 2 - 1, (j + 0.5) / grid * 2 - 1), camera);
          if (rc.intersectObjects(targets).length) hits++;
        }
      }
      return { ms: (performance.now() - t0) / (grid * grid), hits };
    };
    const cold = run();
    const warm = run();
    return { coldMs: cold.ms, warmMs: warm.ms, hits: warm.hits };
  },
  // Average synchronous frame cost over a full orbit around the current target.
  timeOrbit(steps = 8) {
    const start = camera.position.clone();
    const offset = new THREE.Vector3();
    let total = 0;
    for (let i = 0; i < steps; i++) {
      offset.copy(start).sub(controls.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), (i / steps) * Math.PI * 2);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      total += this.timeRender(2);
    }
    camera.position.copy(start);
    camera.lookAt(controls.target);
    return total / steps;
  },
  // Run an exposure analysis ('sun' or 'svf') and report its timing.
  async exposure(mode = 'sun', eye = null) {
    const t0 = performance.now();
    await computeExposure(mode, eye ? new THREE.Vector3(...eye) : null);
    return { ms: Math.round(performance.now() - t0), status: document.getElementById('dem-status')?.innerText || '' };
  },
  // One clean frame of the 3D canvas as a PNG data URL (no UI): visual tests.
  capture() {
    setDynamicPixelRatio(MAX_PIXEL_RATIO);
    sun.shadow.needsUpdate = true;
    updateBuildingLod(buildingGroup, camera);
    renderCleanFrame();
    return renderer.domElement.toDataURL('image/png');
  },
  // Depth-of-field state of the last settled frame.
  dof() {
    const u = dofPass.uniforms;
    return { enabled: dofPass.enabled, focus: u.focus.value, near: u.nearClip.value, far: u.farClip.value, aperture: u.aperture.value, maxblur: u.maxblur.value, target: camera.position.distanceTo(controls.target) };
  },
  // Cost of one settled post-processed frame (AO, bloom, output) at the
  // current view, against a plain render.
  timeComposer(frames = 4) {
    if (typeof composer === 'undefined') return null;
    const gl = renderer.getContext();
    const px = new Uint8Array(4);
    composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) composer.render();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { composerMs: (performance.now() - t0) / frames, plainMs: this.timeRender(frames) };
  }
};

// ?perf=1 shows a small live readout of window.__planxPerf.info().
if (new URLSearchParams(location.search).get('perf') === '1') {
  const hud = document.createElement('pre');
  hud.id = 'planx-perf-hud';
  hud.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;'
    + 'font:11px/1.35 ui-monospace,monospace;color:#e2e8f0;background:rgba(15,23,42,0.82);'
    + 'border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(hud);
  setInterval(() => {
    const i = window.__planxPerf.info();
    hud.textContent = `fps ${_fpsValue || 'idle'}  px ${i.pixelRatio}\n`
      + `calls ${i.calls}  tris ${(i.triangles / 1000).toFixed(0)}k\n`
      + `meshes ${i.meshes}  geo ${i.geometries}  tex ${i.textures}  prog ${i.programs}`;
  }, 500);
}

function updateHtmlLang() {
  document.documentElement.lang = 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = t(key);
    if (value !== key) el.innerText = value;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const value = t(key);
    if (value !== key) el.setAttribute('title', value);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = t(key);
    if (value !== key) el.setAttribute('placeholder', value);
  });
  const scenePill = document.getElementById('scene-state');
  if (scenePill?.dataset.sceneI18n) scenePill.textContent = t(scenePill.dataset.sceneI18n);
  renderFunctionStyleDock();
  renderTourList();
  // Re-render Model Studio's dynamic panels so their labels follow the language.
  const studioDock = document.getElementById('model-studio-dock');
  if (studioDock && !studioDock.classList.contains('hidden')) {
    if (typeof renderUploadedModelsList === 'function') renderUploadedModelsList();
    if (typeof renderTreePoolList === 'function') renderTreePoolList();
    if (typeof renderModelTransformControls === 'function') renderModelTransformControls();
    if (typeof renderMosqueCustomizationsList === 'function') renderMosqueCustomizationsList();
    if (typeof renderTumulusCustomizationsList === 'function') renderTumulusCustomizationsList();
  }
}

const panelToggleBtn = document.getElementById('panel-toggle');
if (panelToggleBtn) {
  panelToggleBtn.addEventListener('click', () => {
    const mainPanel = document.getElementById('main-panel');
    if (mainPanel) mainPanel.classList.toggle('collapsed');
  });
}

// Initialize UI text
updateHtmlLang();

window.addEventListener('error', (event) => {
  handleSceneError(event?.error || event?.message || new Error('Scene error'));
});
window.addEventListener('unhandledrejection', (event) => {
  handleSceneError(event?.reason || new Error('Unhandled scene promise rejection'));
});

setSceneBuildHooks({
  refreshUi() {
    updateDockControls();
    renderBlockCategoryStyleDock();
    renderFunctionStyleDock();
    renderMosqueCustomizationsList();
    renderTumulusCustomizationsList();
  },
  applyInitialView: () => applyView(viewFromHash(location.hash))
});

rebuildSceneSafe().then(() => {
  if (functionGuiRefs) functionGuiRefs.refreshFunctionGui();
  // Seed the portable snapshot once per session so "tune nothing, just export"
  // still freezes the current scene + Model Studio models. No-op in portable mode.
  scheduleSceneStateSave({ includeModels: true });
});
animate();

// --- WebXR (VR headsets): street-level walk with teleport ---
import('./xr.js').then(({ setupXR }) => setupXR({
  renderer,
  scene,
  camera,
  standAt: () => {
    const t = controls.target;
    const dir = new THREE.Vector3().subVectors(t, camera.position);
    return {
      position: new THREE.Vector3(t.x, terrainLocalYAt(t.x, t.z) + 0.05, t.z),
      heading: Math.atan2(-dir.x, -dir.z)
    };
  },
  groundTargets: () => [state.terrainMesh, islandGroup, roadGroup, sidewalkGroup, ...buildingPickTargets(buildingGroup)].filter(Boolean),
  drawFrame: () => {
    updateBuildingLod(buildingGroup, camera);
    renderer.render(scene, camera);
  },
  onStart: () => {
    state.xrActive = true;
    if (tourState.playing) pauseTour();
    controls.enabled = false;
  },
  onEnd: () => {
    state.xrActive = false;
    controls.enabled = !state.isWalkMode;
    controls.update();
    sun.shadow.needsUpdate = true;
    requestRender();
  }
})).catch((err) => console.warn('WebXR setup skipped', err));
document.getElementById('tour-video')?.addEventListener('click', () => {
  renderTourVideo().catch((err) => setStatus(`Tour video failed: ${err?.message || err}`, true));
});

// Scenario view buttons and the split divider.
document.querySelectorAll('[data-scenario-view]').forEach((btn) => {
  btn.addEventListener('click', () => {
    settings.scenarioView = btn.dataset.scenarioView;
    savePersistedSettings();
    buildScenario();
    requestRender();
  });
});
(() => {
  const divider = document.getElementById('split-divider');
  if (!divider) return;
  let dragging = false;
  divider.addEventListener('pointerdown', (e) => {
    dragging = true;
    divider.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  });
  divider.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.splitFraction = Math.min(0.95, Math.max(0.05, e.clientX / window.innerWidth));
    divider.style.left = `${state.splitFraction * 100}%`;
    requestRender();
  });
  const stop = () => { dragging = false; };
  divider.addEventListener('pointerup', stop);
  divider.addEventListener('pointercancel', stop);
})();

const btnScreenshot = document.getElementById('btn-screenshot');
if (btnScreenshot) btnScreenshot.addEventListener('click', takeScreenshot);

// --- FOV ---
const fovSlider = document.getElementById('fov-slider');
const fovVal   = document.getElementById('fov-val');
if (fovSlider) {
  fovSlider.value = settings.fov;
  fovSlider.addEventListener('input', () => {
    settings.fov = parseInt(fovSlider.value);
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();
    savePersistedSettings();
    if (fovVal) fovVal.textContent = settings.fov + '°';
  });
}

// --- Walk Speed ---
const walkSpeedSlider = document.getElementById('walk-speed-slider');
const walkSpeedVal   = document.getElementById('walk-speed-val');
if (walkSpeedSlider) {
  walkSpeedSlider.value = settings.walkSpeed;
  walkSpeedSlider.addEventListener('input', () => {
    settings.walkSpeed = parseFloat(walkSpeedSlider.value);
    savePersistedSettings();
    if (walkSpeedVal) walkSpeedVal.textContent = settings.walkSpeed.toFixed(1) + 'x';
  });
}

// --- Auto-orbit ---
// Minimap toggle on click
const mmWrapEl = document.getElementById('minimap-wrap');
if (mmWrapEl) {
  document.getElementById('minimap-header')?.addEventListener('click', () => {
    mmWrapEl.classList.toggle('collapsed');
  });
}

const autoOrbitBtn = document.getElementById('btn-auto-orbit');
if (autoOrbitBtn) {
  autoOrbitBtn.addEventListener('click', () => {
    settings.autoOrbit = !settings.autoOrbit;
    autoOrbitBtn.classList.toggle('active', settings.autoOrbit);
  });
}

initDockUi();
initTourUi();
