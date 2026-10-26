// Buildings: extruded footprints with roofs and facades, built in workers and
// merged into tiles (building_batch.js), with labels, function colours and
// the footprint index used for picking and QGIS selection sync.
import * as THREE from 'three';
import { BUILDING_TILE_SIZE, addBuildingBuckets, setHoveredBuildingId, estimateWindowGrid } from '../building_batch.js';
import { resolveBuildingMassing } from '../building_geometry.js';
import { buildBuildingsParallel, lastBuildWorkers } from '../building_workers.js';
import { textureSets } from '../catalog.js';
import { getPolygonRings, polygonAreaGeo } from '../geo.js';
import { propFirst, normalizeHexColor, presetValue, roofShapeValue, parseNumberProp } from '../props.js';
import { createRoofPresetTexture } from '../textures.js';
import { DYNAMIC_FACADE_STYLES, autoFacadeName, dynamicStyleOfToken } from '../facade_dynamic.js';
import { state } from '../core/state.js';
import { buildingGroup, LAYER, buildingFunctionMaterials } from '../core/scene.js';
import {
  FACADE_TEXTURE_SCALE_MULTIPLIER, normalizeFacadeKey, resolveFacadeForLevels, facadeTextureFloorRows,
  namesWithMapping, buildingFunctionValue, settings, ensureFunctionBuildingStyle
} from '../core/settings.js';
import { textureFromSet, metersToLocal, buildingLevels, isRasterTextureMode } from '../core/data.js';
import { clearGroup, isSceneBuildStale, layerBuildTimings } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

export function estimateBuildingFeatureMetrics(feature) {
  const props = feature?.properties || {};
  const levels = buildingLevels(props);
  let footprint = parseNumberProp(props, ['footprint_area', 'aream2'], null);
  if (!footprint) {
    const outer = getPolygonRings(feature.geometry)?.[0]?.[0];
    footprint = polygonAreaGeo(outer);
  }
  const floorArea = parseNumberProp(props, namesWithMapping('building_floor_area_field', ['floor_area', 'gross_area']), footprint * levels);
  const dwellings = parseNumberProp(props, namesWithMapping('building_dwelling_field', ['dwelling', 'dwellings']), Math.max(1, Math.round(floorArea / 115)));
  const population = parseNumberProp(props, namesWithMapping('building_population_field', ['population', 'pop']), Math.round(dwellings * 3.1));
  const vehicles = parseNumberProp(props, namesWithMapping('building_vehicle_field', ['vehicle', 'cars']), Math.round(dwellings * 0.7));
  return { footprint, floorArea, dwellings, population, vehicles };
}

export function buildingGroundOffset() {
  return isRasterTextureMode() ? 0.08 : LAYER.content + 0.03;
}

export function buildingBaseYForOuterRing(outer) {
  const samples = [];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const coord of outer || []) {
    if (!coord || coord.length < 2) continue;
    sx += coord[0];
    sy += coord[1];
    n++;
    const [x, z] = metersToLocal(coord[0], coord[1]);
    samples.push(terrainLocalYAt(x, z));
  }
  if (n > 0) {
    const [cx, cz] = metersToLocal(sx / n, sy / n);
    samples.push(terrainLocalYAt(cx, cz));
  }
  const valid = samples.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const groundOffset = buildingGroundOffset();
  if (!valid.length) return terrainLocalYAt(0, 0) + groundOffset;
  const mid = valid[Math.floor(valid.length / 2)];
  const high = valid[Math.max(0, Math.ceil(valid.length * 0.72) - 1)];
  return Math.max(mid, high - 0.35) + groundOffset;
}

export function buildingHeightFromProps(props, levels, floorHeight = settings.floorHeight) {
  const explicit = parseNumberProp(props || {}, ['planx_height', 'height', 'building_height'], null);
  if (explicit !== null && explicit > 0) return explicit;
  return levels * Math.max(2.4, Math.min(6, Number(floorHeight) || settings.floorHeight));
}

export async function buildBuildingLayer(buildingsFc, buildToken = state.sceneBuildToken) {
  clearGroup(buildingGroup);
  buildingFunctionMaterials.clear();
  if (!buildingsFc?.features?.length) return;

  const functions = [...new Set(buildingsFc.features.map((f) => String(buildingFunctionValue(f.properties || {}))))];

  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i];
    ensureFunctionBuildingStyle(fn, i);
  }

  const roofTex = createRoofPresetTexture(settings.roofTexture);
  const roofTextureCache = { [settings.roofTexture]: roofTex };
  const facadeCache = {};
  for (const fn of functions) {
    const style = ensureFunctionBuildingStyle(fn, functions.indexOf(fn));
    const key = normalizeFacadeKey(style.facade);
    if (!facadeCache[key]) {
      const scale = Math.max(1, Math.min(8, Number(style.facadeScale) || FACADE_TEXTURE_SCALE_MULTIPLIER));
      facadeCache[key] = await textureFromSet('facade', key, 0.55 / scale, 0.55 / scale);
      if (isSceneBuildStale(buildToken)) return;
    }
  }
  // Walls carry facade coordinates in bays and floors (prismGeometry):
  // a photo facade is laid out with one window column per bay and one
  // window row per floor, from its known floor rows and estimated grid.
  // Dynamic facades draw their windows on that grid in the shader.
  const facadeLayouts = new Map();
  const facadeLayout = (key, tex) => {
    if (!facadeLayouts.has(key)) {
      let grid = null;
      let uv = null;
      if (tex && !tex.userData?.planxDynamic) {
        const est = estimateWindowGrid(tex);
        const cols = Math.max(1, est.grid[0]);
        const rows = Math.max(1, facadeTextureFloorRows(key, est.grid[1]));
        const offset = est.offset;
        grid = { ...est, grid: [cols, rows], offset };
        uv = Array.from(new THREE.Matrix3().set(1 / cols, 0, offset[0] / cols, 0, 1 / rows, offset[1] / rows, 0, 0, 1).elements);
      }
      facadeLayouts.set(key, { grid, uv });
    }
    return facadeLayouts.get(key);
  };
  const facadeTexture = async (key) => {
    if (!facadeCache[key]) facadeCache[key] = await textureFromSet('facade', key, 1, 1);
    return facadeCache[key];
  };

  // Geometry is built from plain specs (in workers when available) and merged
  // per (look, tile). A look is one template material per distinct
  // appearance; each building's colour and texture transform travel with its
  // spec and end up in vertex colours and UVs.
  const looks = [];
  const lookIds = new Map();
  const lookFor = (key, makeMaterial, flags) => {
    if (!lookIds.has(key)) {
      lookIds.set(key, looks.length);
      looks.push({ material: makeMaterial(), ...flags });
    }
    return lookIds.get(key);
  };
  const linear = (hex) => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  const uvTransform = (tex) => {
    if (!tex) return null;
    if (tex.matrixAutoUpdate) tex.updateMatrix();
    return Array.from(tex.matrix.elements);
  };
  const texId = (tex) => (tex ? tex.source.uuid : '-');
  const solid = { castShadow: true, receiveShadow: true, renderOrder: 0 };
  const wallLook = (key, tex, color) => {
    const layout = facadeLayout(key, tex);
    return {
      id: lookFor(`wall|${texId(tex)}`, () => {
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, side: THREE.DoubleSide });
        if (layout.grid) mat.userData.planxWindowGrid = layout.grid;
        return mat;
      }, { kind: 'wall', ...solid }),
      color: linear(color),
      uv: layout.uv
    };
  };
  const capLook = (tex, color) => ({
    id: lookFor(`cap|${texId(tex)}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }), { kind: 'other', ...solid }),
    color: linear(color),
    uv: uvTransform(tex)
  });
  const roofLook = (tex, color) => ({
    id: lookFor(`roof|${texId(tex)}`, () => new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    }), { kind: 'other', castShadow: true, receiveShadow: false, renderOrder: 36 }),
    color: linear(color),
    uv: uvTransform(tex)
  });
  const slabLook = {
    id: lookFor('slab', () => new THREE.MeshStandardMaterial({ roughness: 0.85, side: THREE.DoubleSide }), { kind: 'slab', ...solid }),
    color: linear(0xe2e8f0),
    uv: null
  };
  // Untextured details: parapets in the wall colour, a stone plinth and
  // rooftop plant (its pieces carry their own colours).
  const detail = { kind: 'detail', castShadow: true, receiveShadow: true, renderOrder: 0 };
  const trimLook = (color) => ({
    id: lookFor('trim', () => new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }), detail),
    color: linear(color),
    uv: null
  });
  const plinthLook = (color) => ({
    id: lookFor('plinth', () => new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), detail),
    color: linear(color),
    uv: null
  });
  const plantLook = {
    id: lookFor('plant', () => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.15, side: THREE.DoubleSide }), detail),
    color: [0.5, 0.5, 0.5],
    uv: null
  };
  // Terraces and flat roof decks are gravel ballast, not roof tiles.
  const terraceTex = createRoofPresetTexture('Gravel');
  const footprintLook = (color) => ({
    id: lookFor('footprint', () => new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.DoubleSide }), { kind: 'other', castShadow: false, receiveShadow: true, renderOrder: 34 }),
    color: linear(color),
    uv: null
  });

  const globalBuildingMode = settings.buildingMode || 'Auto Smart Massing';
  const specs = [];
  const records = [];
  state.buildingFootprints = [];

  for (const f of buildingsFc.features) {
    const props = f.properties || {};
    const fn = String(buildingFunctionValue(props));
    const fnIndex = Math.max(0, functions.indexOf(fn));
    const fnStyle = ensureFunctionBuildingStyle(fn, fnIndex);
    const levels = buildingLevels(f.properties);
    const featureFloorHeight = parseNumberProp(props, ['planx_floor_height', 'floor_height'], fnStyle.floorHeight);
    const height = buildingHeightFromProps(props, levels, featureFloorHeight);
    const featureSetback = fnStyle.setbackEnabled !== false ? Math.max(0, Number(settings.buildingSetback) || 0) : 0;
    const explicitColor = propFirst(props, ['planx_color', 'color']);
    const featureColor = normalizeHexColor(explicitColor, fnStyle.color);
    const selectedFacadeRaw = presetValue(propFirst(props, ['planx_facade', 'planx_texture', 'facade']), textureSets.facade, fnStyle.facade);
    let selectedFacade = normalizeFacadeKey(selectedFacadeRaw);
    // Auto by function: each building wears the facade of its function and
    // height (homes the apartment photo facades, others the dynamic style of
    // their type), unless the feature names one.
    const explicitFacade = propFirst(props, ['planx_facade', 'planx_texture', 'facade']);
    if (settings.facadeMode !== 'Function styles' && !explicitFacade) {
      selectedFacade = autoFacadeName(fn, levels, records.length);
    }
    const featureFacade = resolveFacadeForLevels(selectedFacade, levels);
    const featureFacadeScale = Math.max(1, Math.min(8, parseNumberProp(props, ['planx_facade_scale', 'facade_scale'], fnStyle.facadeScale)));
    const featureRoofTexture = presetValue(propFirst(props, ['planx_roof_texture', 'roof_texture']), textureSets.roof, fnStyle.roofTexture);
    const featureRoofShape = roofShapeValue(roofShapeValue(propFirst(props, ['planx_roof_shape', 'roof_shape']), fnStyle.roofShape), 'Pyramid');
    const featureRoofHeight = parseNumberProp(props, ['planx_roof_height', 'roof_height'], fnStyle.roofHeight);
    const featureRoofColor = normalizeHexColor(propFirst(props, ['planx_roof_color', 'roof_color']), fnStyle.roofColor);
    const explicitMassing = propFirst(props, ['planx_massing', 'massing']);
    const preferredMassing = explicitMassing || (globalBuildingMode !== 'Auto Smart Massing' ? globalBuildingMode : (fnStyle.massing || globalBuildingMode));

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const rings = poly.map((ring) => (ring || []).map((c) => (c && c.length >= 2 ? metersToLocal(c[0], c[1]) : c)));
      let cx = 0;
      let cz = 0;
      for (const [x, z] of rings[0]) { cx += x; cz += z; }
      cx /= rings[0].length;
      cz /= rings[0].length;

      const baseY = buildingBaseYForOuterRing(outer);
      const footprintArea = parseNumberProp(props, ['footprint_area', 'aream2'], polygonAreaGeo(outer));
      const floorArea = parseNumberProp(props, namesWithMapping('building_floor_area_field', ['floor_area', 'gross_area']), footprintArea * levels);
      const dwellings = parseNumberProp(props, namesWithMapping('building_dwelling_field', ['dwelling', 'dwellings']), Math.max(1, Math.round(floorArea / 115)));
      const population = parseNumberProp(props, ['population', 'pop'], Math.round(dwellings * 3.1));
      const vehicles = parseNumberProp(props, ['vehicle', 'cars'], Math.round(dwellings * 0.7));
      const rid = records.length;
      const mode = resolveBuildingMassing(preferredMassing, {
        levels,
        footprintArea,
        functionName: fn,
        hasHoles: rings.length > 1,
        seed: rid
      });
      state.buildingFootprints[rid] = footprintIndexEntry(poly);
      records.push({
        ...(f.properties || {}),
        planx_calc_footprint_area: footprintArea,
        planx_calc_floor_area: floorArea,
        planx_calc_dwellings: dwellings,
        planx_calc_population: population,
        planx_calc_vehicles: vehicles,
        planx_calc_massing: mode
      });
      const spec = {
        rid,
        tile: `${Math.floor(cx / BUILDING_TILE_SIZE)}:${Math.floor(cz / BUILDING_TILE_SIZE)}`,
        centre: [cx, cz],
        rings,
        baseY,
        mode
      };

      if (mode === 'footprint') {
        spec.looks = { footprint: footprintLook(featureColor) };
        specs.push(spec);
        continue;
      }

      const facadeTex = await facadeTexture(featureFacade);
      if (isSceneBuildStale(buildToken)) return;
      const dynamicStyle = DYNAMIC_FACADE_STYLES[dynamicStyleOfToken(textureSets.facade[featureFacade])];
      if (!roofTextureCache[featureRoofTexture]) {
        roofTextureCache[featureRoofTexture] = createRoofPresetTexture(featureRoofTexture);
      }
      const featureRoofTex = roofTextureCache[featureRoofTexture];
      const podiumHeight = (levels > 2 && featureSetback > 0) ? featureFloorHeight : 0;
      const hasRoof = mode !== 'extrude';

      // Neighbours of one function are not painted from one bucket: vary the
      // shade a little per building (unless its colour is given explicitly).
      const wallColor = explicitColor ? featureColor : jitterColor(featureColor, rid);
      spec.height = height;
      spec.levels = levels;
      // Bay width: the style's, scaled by the facade scale setting.
      spec.bay = (dynamicStyle?.bay || 3.1) * Math.max(0.6, Math.min(1.6, featureFacadeScale / FACADE_TEXTURE_SCALE_MULTIPLIER));
      spec.solar = levels <= 10 && /resid|konut|house|apart|dwell|mesken/i.test(fn);
      spec.floorHeight = featureFloorHeight;
      spec.podiumHeight = podiumHeight;
      spec.setback = featureSetback;
      spec.ledges = settings.showLedges ? { projection: settings.ledgeProjection } : null;
      spec.roof = hasRoof ? { shape: featureRoofShape, height: featureRoofHeight } : null;
      spec.looks = {
        wall: wallLook(featureFacade, facadeTex, wallColor),
        // Terraces and flat roof decks (caps) are gravel; the roof keeps its texture.
        cap: (mode === 'extrude+roof' && podiumHeight === 0) ? null : capLook(terraceTex, '#a9a69d'),
        roof: hasRoof ? roofLook(featureRoofTex, featureRoofColor) : null,
        slab: slabLook,
        trim: settings.showRoofDetails !== false ? trimLook(mixHex(wallColor, '#e7e2d8', 0.35)) : null,
        plinth: settings.showRoofDetails !== false ? plinthLook(mixHex(wallColor, '#4f4b46', 0.7)) : null,
        plant: settings.showRoofDetails !== false ? plantLook : null
      };
      if (podiumHeight > 0 || mode === 'podium' || mode === 'stepped' || mode === 'cantilever' || mode === 'penthouse') {
        let podiumFacade = featureFacade;
        if (settings.showStorefronts) podiumFacade = resolveFacadeForLevels(selectedFacade, 1);
        const podiumFacadeTex = (await facadeTexture(podiumFacade)) || facadeTex;
        spec.looks.podiumWall = wallLook(podiumFacade, podiumFacadeTex, wallColor);
        spec.looks.towerWall = spec.looks.wall;
      }
      specs.push(spec);
    }
  }
  if (isSceneBuildStale(buildToken)) return;

  const tGeometry = performance.now();
  const buckets = await buildBuildingsParallel(specs, looks.map((l) => ({ hasMap: !!l.material.map })));
  layerBuildTimings['Buildings: geometry'] = Math.round(performance.now() - tGeometry);
  layerBuildTimings['Buildings: workers'] = lastBuildWorkers;
  if (!isSceneBuildStale(buildToken)) {
    state.hoveredBuilding = null;
    setHoveredBuildingId(-1);
    addBuildingBuckets(buildingGroup, buckets, looks, records, { isNight: (state.solar.elevationDeg ?? 30) < -3 });
  }
  // Templates were cloned into the shared materials; their textures stay.
  for (const look of looks) look.material.dispose();
}

function mixHex(a, b, t) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

// Deterministic small shade and warmth change per building.
function jitterColor(hex, seed) {
  const h = Math.abs(Math.sin(seed * 12.9898 + 4.1414) * 43758.5453) % 1;
  const k = Math.abs(Math.sin(seed * 78.233 + 1.618) * 24634.6345) % 1;
  const c = new THREE.Color(hex);
  c.offsetHSL((k - 0.5) * 0.025, (h - 0.5) * 0.08, (h - 0.5) * 0.09);
  return `#${c.getHexString()}`;
}

// --- QGIS <-> viewer selection sync (only with the PlanX local server) ---
function footprintIndexEntry(poly) {
  const outer = (poly?.[0] || []).filter((c) => c && c.length >= 2);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, sx = 0, sy = 0;
  for (const [x, y] of outer) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    sx += x;
    sy += y;
  }
  return { rings: poly, minX, minY, maxX, maxY, cx: sx / Math.max(1, outer.length), cy: sy / Math.max(1, outer.length) };
}
