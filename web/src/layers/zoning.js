// Zoning: allowed envelopes drawn from the zoning layer, and what-if
// scenarios (coverage, FAR, height, setback) as massing per plot, compared
// with the existing buildings.
import * as THREE from 'three';
import { insetShapeFromRings, shapeFromRings } from '../building_geometry.js';
import { capacityChange, plotCapacity, pointInRings, polygonArea, scenarioTotals } from '../zoning_scenario.js';
import { getPolygonRings } from '../geo.js';
import { parseNumberProp } from '../props.js';
import { state } from '../core/state.js';
import { sun, zoningGroup, scenarioGroup, scenarioGroupB, LAYER } from '../core/scene.js';
import { functionColorState, buildingFunctionValue, settings, ensureFunctionBuildingStyle } from '../core/settings.js';
import { requestRender } from '../core/render.js';
import { buildingLevels } from '../core/data.js';
import { clearGroup, toLocalRings, shapeFromLocalPolygon, shapeFromInsetPolygon } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';
import { estimateBuildingFeatureMetrics, buildingBaseYForOuterRing, buildingHeightFromProps } from './buildings.js';

export function buildZoningEnvelopesLayer(buildingsFc) {
  clearGroup(zoningGroup);
  if (!settings.showZoningEnvelopes || !buildingsFc?.features?.length) return;

  const zoningHeight = settings.zoningMaxHeight;
  const zoningSetbackVal = settings.zoningSetback;
  const highlight = settings.highlightViolations;

  for (const f of buildingsFc.features) {
    const props = f.properties || {};
    const levels = buildingLevels(props);
    const fn = String(buildingFunctionValue(props));
    const fnIndex = Math.max(0, Object.keys(functionColorState).indexOf(fn));
    const fnStyle = ensureFunctionBuildingStyle(fn, fnIndex);
    const featureFloorHeight = parseNumberProp(props, ['planx_floor_height', 'floor_height'], fnStyle.floorHeight);
    const height = buildingHeightFromProps(props, levels, featureFloorHeight);

    const featureSetback = fnStyle.setbackEnabled !== false ? Math.max(0, Number(settings.buildingSetback) || 0) : 0;

    // One envelope per polygon part. (This used to pass the list of parts
    // where one part's rings were expected, so no envelope was ever built.)
    for (const poly of getPolygonRings(f.geometry)) {
    const outer = poly?.[0];
    if (!outer || outer.length < 3) continue;

    const baseY = buildingBaseYForOuterRing(outer);

    const zoningShape = zoningSetbackVal > 0 ? shapeFromInsetPolygon(poly, zoningSetbackVal) : shapeFromLocalPolygon(poly);
    if (!zoningShape) continue;

    const extrude = new THREE.ExtrudeGeometry(zoningShape, { depth: zoningHeight, bevelEnabled: false });
    extrude.rotateX(Math.PI / 2);
    extrude.computeBoundingBox();
    const minY = extrude.boundingBox ? extrude.boundingBox.min.y : 0;
    if (minY !== 0) extrude.translate(0, -minY, 0);

    const heightViolation = height > zoningHeight;
    const setbackViolation = zoningSetbackVal > 0 && featureSetback < zoningSetbackVal && levels > 2;
    const violated = highlight && (heightViolation || setbackViolation);

    const envelopeColor = violated ? 0xef4444 : 0x10b981;

    const matFilled = new THREE.MeshBasicMaterial({
      color: envelopeColor,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    const envelopeMesh = new THREE.Mesh(extrude, matFilled);
    envelopeMesh.position.y = baseY;

    const edges = new THREE.EdgesGeometry(extrude);
    const lineMat = new THREE.LineBasicMaterial({
      color: envelopeColor,
      transparent: true,
      opacity: 0.6
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    envelopeMesh.add(wireframe);

    zoningGroup.add(envelopeMesh);
    }
  }
}

// --- Zoning scenarios: what the rules would allow, plot by plot ---
// Plots are parcels when the export has them, otherwise blocks. Each plot
// gets a massing volume: its setback outline, shrunk to the site coverage,
// as many floors as FAR and maximum height allow, coloured by how that
// capacity compares with the buildings standing on the plot.
const SCENARIO_COLORS = { gain: 0x3b82f6, loss: 0xf97316, same: 0x94a3b8, none: 0x94a3b8 };
let scenarioResult = null;

function shapeArea(shape) {
  let a = Math.abs(THREE.ShapeUtils.area(shape.getPoints()));
  for (const h of shape.holes) a -= Math.abs(THREE.ShapeUtils.area(h.getPoints()));
  return Math.max(0, a);
}

function scaleShape(shape, k) {
  const pts = shape.getPoints();
  let cx = 0;
  let cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= pts.length;
  cy /= pts.length;
  const sc = (p) => new THREE.Vector2(cx + (p.x - cx) * k, cy + (p.y - cy) * k);
  const out = new THREE.Shape(pts.map(sc));
  for (const h of shape.holes) out.holes.push(new THREE.Path(h.getPoints().map(sc)));
  return out;
}

function scenarioRules(which) {
  const b = which === 'B';
  return {
    coverage: b ? settings.zoningBCoverage : settings.zoningCoverage,
    far: b ? settings.zoningBFar : settings.zoningFar,
    maxHeight: b ? settings.zoningBMaxHeight : settings.zoningMaxHeight,
    setback: b ? settings.zoningBSetback : settings.zoningSetback,
    floorHeight: settings.floorHeight
  };
}

export function buildScenario() {
  clearGroup(scenarioGroup);
  clearGroup(scenarioGroupB);
  scenarioResult = null;
  if (settings.scenarioView === 'Off' || !state.layerDataCache) {
    updateScenarioUi();
    return;
  }
  const a = buildScenarioMassing(scenarioGroup, scenarioRules('A'));
  const b = settings.scenarioView === 'SplitAB' ? buildScenarioMassing(scenarioGroupB, scenarioRules('B')) : null;
  scenarioResult = { totals: a.totals, totalsB: b?.totals || null, usingParcels: a.usingParcels };
  updateScenarioUi();
  sun.shadow.needsUpdate = true;
  requestRender();
}

function buildScenarioMassing(group, rules) {
  const data = state.layerDataCache;
  const usingParcels = !!data.parcelsFc?.features?.length;
  const plotsFc = usingParcels ? data.parcelsFc : data.blocksFc;
  // Existing buildings by their footprint centre (projected metres).
  const buildings = [];
  let existingPopulation = 0;
  for (const f of data.buildingsFc?.features || []) {
    const outer = getPolygonRings(f.geometry)?.[0]?.[0];
    if (!outer?.length) continue;
    let x = 0;
    let y = 0;
    for (const c of outer) { x += c[0]; y += c[1]; }
    const m = estimateBuildingFeatureMetrics(f);
    buildings.push({ x: x / outer.length, y: y / outer.length, gfa: m.floorArea || 0, footprint: m.footprint || 0, population: m.population || 0, used: false });
    existingPopulation += m.population || 0;
  }
  const plots = [];
  const materials = {};
  const matFor = (key) => (materials[key] ||= new THREE.MeshStandardMaterial({ color: SCENARIO_COLORS[key], roughness: 0.85 }));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.35 });
  for (const f of plotsFc?.features || []) {
    for (const rings of getPolygonRings(f.geometry)) {
      const outer = rings?.[0];
      if (!outer || outer.length < 3) continue;
      const area = polygonArea(rings);
      if (area < 20) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of outer) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      let existingGfa = 0;
      let existingFootprint = 0;
      for (const b of buildings) {
        if (b.used || b.x < minX || b.x > maxX || b.y < minY || b.y > maxY) continue;
        if (!pointInRings(b.x, b.y, rings)) continue;
        b.used = true;
        existingGfa += b.gfa;
        existingFootprint += b.footprint;
      }
      const localRings = toLocalRings(rings);
      const buildable = rules.setback > 0
        ? insetShapeFromRings(localRings, rules.setback)
        : shapeFromRings(localRings);
      const buildableArea = buildable ? shapeArea(buildable) : 0;
      const capacity = plotCapacity(area, buildableArea, rules);
      plots.push({ area, existingGfa, existingFootprint, capacity });
      if (!buildable || capacity.gfa <= 0) continue;
      const k = Math.sqrt(Math.min(1, capacity.footprint / Math.max(1e-6, buildableArea)));
      const shape = k < 0.999 ? scaleShape(buildable, k) : buildable;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: capacity.height, bevelEnabled: false });
      geo.rotateX(Math.PI / 2);
      geo.computeBoundingBox();
      geo.translate(0, -geo.boundingBox.min.y, 0);
      const c = new THREE.Vector3();
      geo.boundingBox.getCenter(c);
      const mesh = new THREE.Mesh(geo, matFor(capacityChange(existingGfa, capacity.gfa)));
      mesh.position.y = terrainLocalYAt(c.x, c.z) + LAYER.content;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { planxScenario: true, ...capacity, existingGfa, plotArea: area };
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat));
      group.add(mesh);
    }
  }
  return { totals: scenarioTotals(plots, existingPopulation), usingParcels };
}

function updateScenarioUi() {
  const box = document.getElementById('scenario-summary');
  const divider = document.getElementById('split-divider');
  const split = (settings.scenarioView === 'Split' || settings.scenarioView === 'SplitAB') && scenarioResult;
  if (divider) {
    divider.style.display = split ? '' : 'none';
    divider.style.left = `${state.splitFraction * 100}%`;
    const left = divider.querySelector('.split-left');
    const right = divider.querySelector('.split-right');
    if (left) left.textContent = settings.scenarioView === 'SplitAB' ? 'Scenario B' : 'Existing';
    if (right) right.textContent = 'Scenario A';
  }
  document.querySelectorAll('[data-scenario-view]').forEach((b) => b.classList.toggle('active', b.dataset.scenarioView === settings.scenarioView));
  if (!box) return;
  if (!scenarioResult) {
    box.innerHTML = '';
    return;
  }
  const t = scenarioResult.totals;
  const tb = scenarioResult.totalsB;
  const n = (v) => Math.round(v).toLocaleString('en-US');
  const d = (v) => `${v >= 0 ? '+' : ''}${n(v)}`;
  const col = (fn) => `<td>${fn(t)}</td>${tb ? `<td>${fn(tb)}</td>` : ''}`;
  box.innerHTML = `<table class="scenario-table">`
    + `<tr><th></th><th>Existing</th><th>${tb ? 'A' : 'Scenario'}</th>${tb ? '<th>B</th>' : ''}</tr>`
    + `<tr><td>Floor area (m²)</td><td>${n(t.existingGfa)}</td>${col((x) => n(x.gfa))}</tr>`
    + `<tr><td>FAR</td><td>${t.existingFar.toFixed(2)}</td>${col((x) => x.far.toFixed(2))}</tr>`
    + `<tr><td>Site coverage</td><td>${(t.existingCoverage * 100).toFixed(0)}%</td>${col((x) => `${(x.coverage * 100).toFixed(0)}%`)}</tr>`
    + (t.population !== null ? `<tr><td>Population (est.)</td><td>${n(t.existingPopulation)}</td>${col((x) => n(x.population))}</tr>` : '')
    + `</table><p class="dock-note">${t.plots} ${scenarioResult.usingParcels ? 'parcels' : 'blocks'} · change ${d(t.gfaChange)} m² · `
    + `<span style="color:#3b82f6">■</span> more capacity <span style="color:#f97316">■</span> less <span style="color:#94a3b8">■</span> similar</p>`;
}
