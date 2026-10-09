// Buildings: extruded footprints with roofs and facades, built in workers and
// merged into tiles (building_batch.js), with labels, function colours and
// the footprint index used for picking and QGIS selection sync.
import * as THREE from 'three';
import { BUILDING_TILE_SIZE, addBuildingBuckets, setHoveredBuildingId } from '../building_batch.js';
import { buildBuildingsParallel, lastBuildWorkers } from '../building_workers.js';
import { textureSets, FACADE_RECIPES } from '../catalog.js';
import { getPolygonRings, polygonAreaGeo } from '../geo.js';
import { propFirst, normalizeHexColor, presetValue, roofShapeValue, parseNumberProp } from '../props.js';
import { createRoofPresetTexture } from '../textures.js';
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
  // Per-building texture scale cache keyed by (facade_type + floor_count)
  const facadeScaleCache = {};
  const scaledFacadeTexture = (facadeKey, texLevels, texHeight, scale) => {
    const key = `${facadeKey}_${texLevels}_${texHeight.toFixed(2)}_${scale.toFixed(2)}`;
    if (!facadeScaleCache[key]) {
      const base = facadeCache[facadeKey];
      if (base) {
        const recipe = (typeof FACADE_RECIPES !== 'undefined') ? FACADE_RECIPES[facadeKey] : null;
        const textureFloorRows = facadeTextureFloorRows(facadeKey, recipe?.floorRows || 10);
        const repeatV = Math.max(0.025, Math.min(3.0, texLevels / textureFloorRows / scale));
        const t = base.clone();
        t.repeat.set(0.5 / scale, repeatV);
        t.needsUpdate = true;
        facadeScaleCache[key] = t;
      }
    }
    return facadeScaleCache[key] || facadeCache[facadeKey];
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
  const wallLook = (tex, color) => ({
    id: lookFor(`wall|${texId(tex)}`, () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72, side: THREE.DoubleSide }), { kind: 'wall', ...solid }),
    color: linear(color),
    uv: uvTransform(tex)
  });
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
  const footprintLook = (color) => ({
    id: lookFor('footprint', () => new THREE.MeshStandardMaterial({ roughness: 0.82, side: THREE.DoubleSide }), { kind: 'other', castShadow: false, receiveShadow: true, renderOrder: 34 }),
    color: linear(color),
    uv: null
  });

  const mode = settings.buildingMode === 'Footprint only'
    ? 'footprint'
    : (settings.buildingMode === 'Extruded + roof' ? 'extrude+roof' : 'extrude');
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
    const featureColor = normalizeHexColor(propFirst(props, ['planx_color', 'color']), fnStyle.color);
    const selectedFacadeRaw = presetValue(propFirst(props, ['planx_facade', 'planx_texture', 'facade']), textureSets.facade, fnStyle.facade);
    const selectedFacade = normalizeFacadeKey(selectedFacadeRaw);
    const featureFacade = resolveFacadeForLevels(selectedFacade, levels);
    const featureFacadeScale = Math.max(1, Math.min(8, parseNumberProp(props, ['planx_facade_scale', 'facade_scale'], fnStyle.facadeScale)));
    const featureRoofTexture = presetValue(propFirst(props, ['planx_roof_texture', 'roof_texture']), textureSets.roof, fnStyle.roofTexture);
    const featureRoofShape = roofShapeValue(roofShapeValue(propFirst(props, ['planx_roof_shape', 'roof_shape']), fnStyle.roofShape), 'Pyramid');
    const featureRoofHeight = parseNumberProp(props, ['planx_roof_height', 'roof_height'], fnStyle.roofHeight);
    const featureRoofColor = normalizeHexColor(propFirst(props, ['planx_roof_color', 'roof_color']), fnStyle.roofColor);

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
      state.buildingFootprints[rid] = footprintIndexEntry(poly);
      records.push({
        ...(f.properties || {}),
        planx_calc_footprint_area: footprintArea,
        planx_calc_floor_area: floorArea,
        planx_calc_dwellings: dwellings,
        planx_calc_population: population,
        planx_calc_vehicles: vehicles
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

      if (!facadeCache[featureFacade]) {
        facadeCache[featureFacade] = await textureFromSet('facade', featureFacade, 0.5 / featureFacadeScale, 0.5 / featureFacadeScale);
        if (isSceneBuildStale(buildToken)) return;
      }
      const facadeTex = scaledFacadeTexture(featureFacade, levels, height, featureFacadeScale);
      if (!roofTextureCache[featureRoofTexture]) {
        roofTextureCache[featureRoofTexture] = createRoofPresetTexture(featureRoofTexture);
      }
      const featureRoofTex = roofTextureCache[featureRoofTexture];
      const podiumHeight = (levels > 2 && featureSetback > 0) ? featureFloorHeight : 0;

      spec.height = height;
      spec.levels = levels;
      spec.floorHeight = featureFloorHeight;
      spec.podiumHeight = podiumHeight;
      spec.setback = featureSetback;
      spec.ledges = settings.showLedges ? { projection: settings.ledgeProjection } : null;
      spec.roof = mode === 'extrude+roof' ? { shape: featureRoofShape, height: featureRoofHeight } : null;
      spec.looks = {
        wall: wallLook(facadeTex, featureColor),
        // Caps take the roof material unless a separate roof mesh covers them.
        cap: mode === 'extrude+roof' ? null : capLook(featureRoofTex, featureRoofColor),
        roof: mode === 'extrude+roof' ? roofLook(featureRoofTex, featureRoofColor) : null,
        slab: slabLook
      };
      if (podiumHeight > 0) {
        let podiumFacadeTex = facadeTex;
        if (settings.showStorefronts) {
          const storefrontFacade = resolveFacadeForLevels(selectedFacade, 1);
          if (!facadeCache[storefrontFacade]) {
            facadeCache[storefrontFacade] = await textureFromSet('facade', storefrontFacade, 0.5 / featureFacadeScale, 0.5 / featureFacadeScale);
          }
          podiumFacadeTex = facadeCache[storefrontFacade] || facadeTex;
        }
        spec.looks.podiumWall = wallLook(podiumFacadeTex, featureColor);
        spec.looks.towerWall = wallLook(scaledFacadeTexture(featureFacade, Math.max(1, levels - 1), height - podiumHeight, featureFacadeScale) || facadeTex, featureColor);
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
