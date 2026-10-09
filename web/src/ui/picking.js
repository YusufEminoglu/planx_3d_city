// Picking buildings: hover highlight with a tooltip, a detail card on
// click, fly-to on double click, and the viewshed observer pick.
import * as THREE from 'three';
import { buildingHitData, buildingHitKey, buildingPickTargets, setHoveredBuildingId } from '../building_batch.js';
import { t } from '../ui_text.js';
import { parseNumberProp } from '../props.js';
import { state } from '../core/state.js';
import { camera, renderer, islandGroup, buildingGroup, rc } from '../core/scene.js';
import { buildingFunctionValue, getFunctionIcon } from '../core/settings.js';
import { setStatus } from './status.js';
import { buildingLevelsRaw } from '../core/data.js';
import { computeExposure } from '../analysis/exposure.js';
import { reportViewerPick } from './qgis_link.js';

// --- Hover / highlight ---
const _hovEmissive = new THREE.Color();
let _hovEmissiveIntensity = 0;

// Building hover highlight helpers
function _unhoverBuilding() {
  if (state.hoveredBuilding === null) return;
  if (typeof state.hoveredBuilding === 'number') {
    setHoveredBuildingId(-1);
    state.hoveredBuilding = null;
    return;
  }
  const mat = Array.isArray(state.hoveredBuilding.material) ? state.hoveredBuilding.material[1] : state.hoveredBuilding.material;
  mat.emissive.copy(_hovEmissive);
  mat.emissiveIntensity = _hovEmissiveIntensity;
  state.hoveredBuilding = null;
}
function _doHoverBuilding(hit) {
  const key = buildingHitKey(hit);
  if (key === state.hoveredBuilding) return;
  _unhoverBuilding();
  if (typeof key === 'number') {
    if (key < 0) return;
    state.hoveredBuilding = key;
    setHoveredBuildingId(key);
    return;
  }
  const mesh = key;
  state.hoveredBuilding = mesh;
  const mat = Array.isArray(mesh.material) ? mesh.material[1] : mesh.material;
  _hovEmissive.copy(mat.emissive);
  _hovEmissiveIntensity = mat.emissiveIntensity;
  mat.emissive.setHex(0x1a5c44);
  mat.emissiveIntensity = 1.4;
}

// Hover tooltip (DOM-based, no CSS2DRenderer overhead)
const hoverTip = document.getElementById('bldg-hover-tip');
let _hoverThrottle = 0;
window.addEventListener('mousemove', (e) => {
  if (state.isWalkMode || state.isGameMode) { if (hoverTip) hoverTip.style.display = 'none'; _unhoverBuilding(); return; }
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) {
    if (hoverTip) hoverTip.style.display = 'none'; _unhoverBuilding(); return;
  }
  const now = performance.now();
  if (now - _hoverThrottle < 40) return;
  _hoverThrottle = now;

  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingPickTargets(buildingGroup));

  if (!hits.length) {
    _unhoverBuilding();
    if (hoverTip) hoverTip.style.display = 'none';
    return;
  }
  _doHoverBuilding(hits[0]);
  if (hoverTip) {
    const p = buildingHitData(hits[0]);
    const fn = String(buildingFunctionValue(p));
    const icon = getFunctionIcon(fn);
    const floorVal = buildingLevelsRaw(p);
    const floors = floorVal != null ? `${floorVal} ${t('buildingFloors').toLowerCase()}` : '-';
    hoverTip.innerHTML = `<div class="tooltip-title">${icon} ${fn.slice(0, 26)}</div><div class="tooltip-row"><span>${t('buildingFloors')}</span><span>${floors}</span></div>`;
    hoverTip.style.display = 'block';
    const tx = Math.min(e.clientX + 16, innerWidth - 200);
    const ty = Math.max(e.clientY - 60, 8);
    hoverTip.style.left = tx + 'px';
    hoverTip.style.top = ty + 'px';
  }
});
window.addEventListener('mouseleave', () => { _unhoverBuilding(); if (hoverTip) hoverTip.style.display = 'none'; });

// Click: show full detail panel
const detailTip = document.getElementById('bldg-detail-tip');
let _detailOpen = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.viewshedPicking) {
    state.viewshedPicking = false;
    document.body.classList.remove('picking-point');
    setStatus('Viewshed cancelled.');
  }
});
window.addEventListener('click', (e) => {
  if (!state.viewshedPicking || e.target !== renderer.domElement) return;
  e.stopImmediatePropagation();
  state.viewshedPicking = false;
  document.body.classList.remove('picking-point');
  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const targets = [...buildingPickTargets(buildingGroup), state.terrainMesh, islandGroup].filter(Boolean);
  const hit = rc.intersectObjects(targets, true)[0];
  if (!hit) {
    setStatus('Viewshed: no surface under the cursor.', true);
    return;
  }
  computeExposure('viewshed', hit.point.clone().add(new THREE.Vector3(0, 1.6, 0)));
}, { capture: true });

window.addEventListener('click', (e) => {
  if (state.isWalkMode || state.isGameMode) return;
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) return;
  if (e.target.closest('#bldg-detail-tip')) return;

  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingPickTargets(buildingGroup));

  if (!hits.length) {
    if (detailTip) { detailTip.style.display = 'none'; _detailOpen = false; }
    return;
  }
  const p = buildingHitData(hits[0]);
  const hitKey = buildingHitKey(hits[0]);
  if (typeof hitKey === 'number' && hitKey >= 0) reportViewerPick(hitKey);
  const icon = getFunctionIcon(String(buildingFunctionValue(p)));
  const areaStr = p.aream2 ? `${parseFloat(p.aream2).toFixed(0)} m²` : '-';
  const siteCoverage = parseNumberProp(p, ['site_coverage', 'coverage_ratio', 'coverage'], null);
  const floorAreaRatio = parseNumberProp(p, ['far', 'floor_area_ratio', 'fsi'], null);
  const calcFootprintArea = parseNumberProp(p, ['planx_calc_footprint_area', 'footprint_area'], null);
  const calcFloorArea = parseNumberProp(p, ['planx_calc_floor_area', 'floor_area', 'gross_area'], null);
  const calcPopulation = parseNumberProp(p, ['planx_calc_population', 'population'], null);
  const calcDwellings = parseNumberProp(p, ['planx_calc_dwellings', 'dwellings'], null);
  const calcVehicles = parseNumberProp(p, ['planx_calc_vehicles', 'vehicle', 'cars'], null);
  const styleRows = [
    ['Color', p.planx_color || p.color],
    ['Facade', p.planx_facade],
    ['Roof', p.planx_roof_shape],
    ['Roof texture', p.planx_roof_texture],
  ].filter(([, value]) => value);
  if (detailTip) {
    detailTip.innerHTML = `
      <div class="tooltip-title">${icon} ${t('buildingInfo')} <span class="tip-close" onclick="this.closest('#bldg-detail-tip').style.display='none'">✕</span></div>
      <div class="tooltip-row"><span>${t('buildingFunction')}</span><span>${String(buildingFunctionValue(p)).slice(0, 24)}</span></div>
      <div class="tooltip-row"><span>${t('buildingFloors')}</span><span>${buildingLevelsRaw(p) ?? '-'}</span></div>
      ${siteCoverage != null ? `<div class="tooltip-row"><span>Site coverage</span><span>${siteCoverage}</span></div>` : ''}
      ${floorAreaRatio != null ? `<div class="tooltip-row"><span>FAR</span><span>${floorAreaRatio}</span></div>` : ''}
      <div class="tooltip-row"><span>Footprint area</span><span>${areaStr}</span></div>
      ${calcFootprintArea ? `<div class="tooltip-row"><span>Calculated footprint</span><span>${calcFootprintArea.toFixed(0)} m²</span></div>` : ''}
      ${calcFloorArea ? `<div class="tooltip-row"><span>Gross floor area</span><span>${calcFloorArea.toFixed(0)} m²</span></div>` : ''}
      ${calcPopulation !== null ? `<div class="tooltip-row"><span>Estimated population</span><span>${calcPopulation.toFixed(0)}</span></div>` : ''}
      ${calcDwellings !== null ? `<div class="tooltip-row"><span>Estimated dwellings</span><span>${calcDwellings.toFixed(0)}</span></div>` : ''}
      ${calcVehicles !== null ? `<div class="tooltip-row"><span>Estimated vehicles</span><span>${calcVehicles.toFixed(0)}</span></div>` : ''}
      ${styleRows.map(([label, value]) => `<div class="tooltip-row"><span>${label}</span><span>${value}</span></div>`).join('')}
    `;
    detailTip.style.display = 'block';
    _detailOpen = true;
  }
});

// Double-click: fly camera to building
window.addEventListener('dblclick', (e) => {
  if (state.isWalkMode || state.isGameMode) return;
  if (e.target.closest('#ui-container') || e.target.closest('.lil-gui') || e.target.closest('#recording-container')) return;
  const mouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(mouse, camera);
  const hits = rc.intersectObjects(buildingPickTargets(buildingGroup));
  if (!hits.length) return;
  const pt = hits[0].point.clone();
  const dir = camera.position.clone().sub(pt).normalize();
  state.flyOrigin = camera.position.clone();
  state.flyTarget = pt.clone().addScaledVector(dir, 70).add(new THREE.Vector3(0, 25, 0));
  state.flyControlsTarget = pt.clone();
  state.flyT = 0;
  state.lastCameraMove = performance.now();
});
