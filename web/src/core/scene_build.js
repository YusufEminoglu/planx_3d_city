// Building the scene: loads the data once, then (re)builds every layer for
// the current settings, timing each one; stale builds stop when a newer one
// starts.
import { batchStaticGroup } from '../mesh_merge.js';
import { t } from '../ui_text.js';
import { state } from './state.js';
import {
  scene, sun, atmosphere, world, islandGroup, parcelGroup, hardscapeGroup, buildingGroup, roadGroup, treeGroup,
  mosqueGroup, tumulusGroup, carGroup, bikeLaneGroup, bikeGroup, furnitureGroup, pedestrianGroup,
  sidewalkGroup, pedestrianPathGroup, crosswalkGroup, terrainSideGroup, windPlumeGroup, fenceGroup,
  waterlineGroup, zoningGroup
} from './scene.js';
import { buildingFunctionValue, settings, getFunctionIcon } from './settings.js';
import { requestRender } from './render.js';
import { setStatus } from '../ui/status.js';
import {
  buildingLevels, loadGeoJson, loadManifest, applyManifestDefaults, isRasterTextureMode, manifestRequiresInput,
  asFeatureCollection
} from './data.js';
import { clearGroup, isSceneBuildStale, layerBuildTimings, runLayerBuild } from './scene_util.js';
import {
  demSamplerBounds, deriveVectorBounds, activateFlatTerrainFallback, loadTerrainTextureFromGeoTiff,
  loadBaseMapTexture, prefetchProjectDem, loadProjectDem, buildTerrain
} from '../terrain/terrain.js';
import { ensureUploadedModelsLoaded, loadGltfModel } from './model_store.js';
import {
  buildFencesLayer, buildWaterlinesLayer, buildIslandLayer, buildParcelLayer, buildHardscapeLayer
} from '../layers/ground.js';
import { buildTreeLayer } from '../layers/trees.js';
import { buildMosqueLayer, buildTumulusLayer } from '../layers/landmarks.js';
import { buildFurnitureLayer } from '../layers/furniture.js';
import { buildBuildingLayer } from '../layers/buildings.js';
import { buildZoningEnvelopesLayer, buildScenario } from '../layers/zoning.js';
import {
  buildBikeLaneLayer, buildRoadsAndTraffic, buildPedestrianLayer, buildSidewalkLayer, buildPedestrianPathLayer,
  buildCrosswalkLayer
} from '../layers/mobility.js';
import { buildWindPlumeLayer } from '../layers/emissions.js';
import { updateDashboard } from '../ui/dashboard.js';
import { rebuildMinimapBg } from '../ui/minimap.js';

function hideLoadingOverlay(delay = 450) {
  const loading = document.getElementById('loading');
  if (!loading) return;
  loading.style.opacity = 0;
  requestRender(delay + 300); // rendering resumes as the overlay fades
  setTimeout(() => { loading.style.display = 'none'; }, delay);
}

// The viewer UI hooks into scene builds: refreshUi() after every build
// (docks, style lists), applyInitialView() once, after the first.
const sceneBuildHooks = { refreshUi() {}, applyInitialView() {} };
export function setSceneBuildHooks(hooks) {
  Object.assign(sceneBuildHooks, hooks);
}

export async function rebuildScene() {
  const buildToken = ++state.sceneBuildToken;
  const tScene = performance.now();
  await ensureUploadedModelsLoaded();
  const loadingText = document.getElementById('loading-text');
  loadingText.innerText = t('loadingData');
  setSceneState('sceneLoading');

  if (!state.layerDataCache) {
    loadingText.innerText = t('sceneGeojson') + '...';
    if (!state.demReady && !state.demLoadingStarted) prefetchProjectDem();
    state.projectManifest = await loadManifest();
    applyManifestDefaults();
    // Fetch every base layer at once; they are independent files.
    const [blocksFc, buildingsFc, roadsFc, treesFc, lights, benches, bins, busstops, fences, waterlines, mosques, tumulus, roi] = await Promise.all([
      loadGeoJson('../data/vector/myblocks.geojson', { required: manifestRequiresInput('blocks'), label: 'Blocks' }),
      loadGeoJson('../data/vector/mybuildings.geojson', { required: manifestRequiresInput('buildings'), label: 'Buildings' }),
      loadGeoJson('../data/vector/myroads.geojson', { required: manifestRequiresInput('roads'), label: 'Roads' }),
      loadGeoJson('../data/vector/mytrees.geojson', { label: 'Trees' }),
      loadGeoJson('../data/vector/mylights.geojson', { label: 'Lights' }),
      loadGeoJson('../data/vector/mybenches.geojson', { label: 'Benches' }),
      loadGeoJson('../data/vector/mytrashbins.geojson', { label: 'Trash bins' }),
      loadGeoJson('../data/vector/mybusstops.geojson', { label: 'Bus stops' }),
      loadGeoJson('../data/vector/myfences.geojson', { label: 'Fences' }),
      loadGeoJson('../data/vector/mywaterlines.geojson', { label: 'Water lines' }),
      loadGeoJson('../data/vector/mymosques.geojson', { label: 'Mosques' }),
      loadGeoJson('../data/vector/mytumulus.geojson', { label: 'Tumulus' }),
      loadGeoJson('../data/vector/roi.geojson', { required: manifestRequiresInput('roi'), label: 'ROI' })
    ]);
    state.layerDataCache = {
       blocksFc: asFeatureCollection(blocksFc, 'Blocks'),
       buildingsFc: asFeatureCollection(buildingsFc, 'Buildings'),
       roadsFc: asFeatureCollection(roadsFc, 'Roads'),
       treesFc: asFeatureCollection(treesFc, 'Trees'),
       mosques: asFeatureCollection(mosques, 'Mosques'),
       tumulus: asFeatureCollection(tumulus, 'Tumulus'),
       parcelsFc: null,
       hardscape: null,
       sidewalks: null,
       pedestrianPaths: null,
       bikeLanes: null,
       fences: asFeatureCollection(fences, 'Fences'),
       waterlines: asFeatureCollection(waterlines, 'Water lines'),
       furniture: {
         lights: asFeatureCollection(lights, 'Lights'),
         benches: asFeatureCollection(benches, 'Benches'),
         bins: asFeatureCollection(bins, 'Trash bins'),
         busstops: asFeatureCollection(busstops, 'Bus stops')
       },
       roi: asFeatureCollection(roi, 'ROI')
    };
  }
  if (isSceneBuildStale(buildToken)) return;
  // Layers that are only needed when their toggle is on, fetched in parallel.
  const lazyLayers = [];
  const lazyLayer = (needed, cacheKey, file, label, options = {}) => {
    if (!needed || state.layerDataCache[cacheKey]) return;
    lazyLayers.push(loadGeoJson(`../data/vector/${file}`, { label, ...options }).then((data) => {
      state.layerDataCache[cacheKey] = asFeatureCollection(data, label);
    }));
  };
  lazyLayer(settings.showParcels, 'parcelsFc', 'myparcels.geojson', 'Parcels', { required: manifestRequiresInput('parcels') });
  lazyLayer(settings.showHardscape || settings.showWindPlumes, 'hardscape', 'myhardscape.geojson', 'Hardscape');
  lazyLayer(settings.showSidewalks, 'sidewalks', 'mysidewalks.geojson', 'Sidewalks');
  lazyLayer(settings.showPedestrianPaths, 'pedestrianPaths', 'mypedestrian_paths.geojson', 'Pedestrian paths');
  lazyLayer(settings.showBikeLanes || settings.showBikes, 'bikeLanes', 'mybikelanes.geojson', 'Bike lanes');
  lazyLayer(settings.showFences, 'fences', 'myfences.geojson', 'Fences');
  lazyLayer(settings.showWaterlines, 'waterlines', 'mywaterlines.geojson', 'Water lines');
  await Promise.all(lazyLayers);
  if (isSceneBuildStale(buildToken)) return;
  
  const blocksFc = asFeatureCollection(state.layerDataCache.blocksFc, 'Blocks');
  const buildingsFc = asFeatureCollection(state.layerDataCache.buildingsFc, 'Buildings');
  const roadsFc = asFeatureCollection(state.layerDataCache.roadsFc, 'Roads');
  const treesFc = asFeatureCollection(state.layerDataCache.treesFc, 'Trees');
  const mosques = asFeatureCollection(state.layerDataCache.mosques, 'Mosques');
  const tumulus = asFeatureCollection(state.layerDataCache.tumulus, 'Tumulus');
  const parcelsFc = state.layerDataCache.parcelsFc ? asFeatureCollection(state.layerDataCache.parcelsFc, 'Parcels') : null;
  const hardscape = state.layerDataCache.hardscape ? asFeatureCollection(state.layerDataCache.hardscape, 'Hardscape') : null;
  const sidewalks = state.layerDataCache.sidewalks ? asFeatureCollection(state.layerDataCache.sidewalks, 'Sidewalks') : null;
  const pedestrianPaths = state.layerDataCache.pedestrianPaths ? asFeatureCollection(state.layerDataCache.pedestrianPaths, 'Pedestrian paths') : null;
  const bikeLanes = state.layerDataCache.bikeLanes ? asFeatureCollection(state.layerDataCache.bikeLanes, 'Bike lanes') : null;
  const fences = state.layerDataCache.fences ? asFeatureCollection(state.layerDataCache.fences, 'Fences') : null;
  const waterlines = state.layerDataCache.waterlines ? asFeatureCollection(state.layerDataCache.waterlines, 'Water lines') : null;
  Object.assign(state.layerDataCache, { blocksFc, buildingsFc, roadsFc, treesFc, parcelsFc, hardscape, sidewalks, pedestrianPaths, bikeLanes, fences, waterlines, mosques, tumulus });
  layerBuildTimings['Load: data'] = Math.round(performance.now() - tScene);
  updateDashboard(state.layerDataCache);

  // Calculate and update stats
  const statDiv = document.getElementById('stats-content');
  if (statDiv) {
    const blockCount = blocksFc.features.length;
    const parcelCount = parcelsFc ? parcelsFc.features.length : '-';
    const bldCount = buildingsFc.features.length;
    let totalFloors = 0;
    const funcMap = {};
    buildingsFc.features.forEach(f => {
       const fn = buildingFunctionValue(f.properties || {});
       funcMap[fn] = (funcMap[fn] || 0) + 1;
       totalFloors += buildingLevels(f.properties);
    });
    const avgFlr = (bldCount > 0 ? (totalFloors / bldCount).toFixed(1) : 0);
    
    let html = `<div class="stat-row"><span>${t('statBld')}</span><span class="stat-val">${bldCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statBlock')}</span><span class="stat-val">${blockCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statFlr')}</span><span class="stat-val">${avgFlr}</span></div>`;
    if (parcelsFc) html += `<div class="stat-row"><span>${t('statParcel')}</span><span class="stat-val">${parcelCount}</span></div>`;
    const topFuncs = Object.entries(funcMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
    topFuncs.forEach(([k, v]) => {
      const icon = getFunctionIcon(k);
      html += `<div class="stat-row stat-func"><span>${icon} ${k.slice(0, 20)}</span><span class="stat-val">${v}</span></div>`;
    });
    statDiv.innerHTML = html;
  }

  const vectorBounds = deriveVectorBounds(state.layerDataCache);
  state.bounds = vectorBounds || (state.demReady ? demSamplerBounds() : null);
  if (isSceneBuildStale(buildToken)) return;

  if (!state.demReady && !state.demLoadingStarted) {
    state.demLoadingStarted = true;
    loadingText.innerText = t('sceneDem') + '...';
    setSceneState('sceneDem');
    loadProjectDem()
      .then(() => rebuildSceneSafe())
      .catch((err) => {
        if (isSceneBuildStale(buildToken)) return;
        const demMissing = String(err?.message || err).includes('DEM not found');
        if (demMissing) console.info('DEM not found; using flat terrain fallback.');
        else console.warn('DEM could not be loaded; using flat terrain fallback:', err);
        activateFlatTerrainFallback(vectorBounds || state.bounds);
        rebuildSceneSafe();
      });
    return;
  }
  if (!state.demReady) return;
  if (!state.bounds) {
    setStatus('No vector bounds or DEM extent found; using fallback terrain bounds.');
    state.bounds = { minX: -500, maxX: 500, minY: -500, maxY: 500 };
  }
  if (isSceneBuildStale(buildToken)) return;
  state.centerX = (state.bounds.minX + state.bounds.maxX) / 2;
  state.centerY = (state.bounds.minY + state.bounds.maxY) / 2;
  if (state.terrainMesh) {
    world.remove(state.terrainMesh);
    state.terrainMesh.geometry.dispose();
    state.terrainMesh.material.dispose();
    state.terrainMesh = null;
  }
  if (state.terrainOverlayMesh) {
    world.remove(state.terrainOverlayMesh);
    state.terrainOverlayMesh.geometry.dispose();
    state.terrainOverlayMesh.material.dispose();
    state.terrainOverlayMesh = null;
  }
  state.terrainSurfaceCache = null;
  clearGroup(terrainSideGroup);
  if (isRasterTextureMode() && settings.showTerrainTexture && !state.terrainTexture) {
    try {
      loadingText.innerText = t('scenePlanTexture') + '...';
      setSceneState('scenePlanTexture');
      state.terrainTexture = await loadTerrainTextureFromGeoTiff();
    } catch (err) {
      console.warn('Plan texture could not be loaded; continuing with pavement.', err);
      setStatus(t('planTextureFail'));
    }
  }
  if (settings.showXyzTiles && state.projectManifest?.baseMapTexture && !state.baseMapTexture) {
    try {
      loadingText.innerText = t('sceneBasemap') + '...';
      setSceneState('sceneBasemap');
      state.baseMapTexture = await loadBaseMapTexture();
    } catch (err) {
      console.warn('QGIS basemap texture could not be loaded; continuing with the ground texture.', err);
      setStatus(t('basemapFail'));
    }
  }
  loadingText.innerText = t('sceneTerrain') + '...';
  setSceneState('sceneTerrain');
  const tTerrain = performance.now();
  const terrainBuilt = await buildTerrain(blocksFc, buildToken);
  layerBuildTimings.Terrain = Math.round(performance.now() - tTerrain);
  if (!terrainBuilt || isSceneBuildStale(buildToken)) return;

  loadingText.innerText = t('processing');
  setSceneState('sceneLayers');

  let mosqueModel = null;
  if (settings.showMosques) {
    if (!state.cachedDefaultMosqueModel) {
      state.cachedDefaultMosqueModel = await loadGltfModel('../assets/models/mosque.glb');
    }
    mosqueModel = state.cachedDefaultMosqueModel;
  }
  let treeModel = null;
  if (settings.showTrees && (settings.treeRenderMode === 'Model-based' || settings.activeTreeModel !== 'default')) {
    if (!state.cachedDefaultTreeModel) {
      state.cachedDefaultTreeModel = await loadGltfModel('../assets/models/tree.glb');
    }
    treeModel = state.cachedDefaultTreeModel;
  }
  // Tumulus has no bundled GLB; the default is a procedural mound built on demand.
  // An optional ../assets/models/tumulus.glb is used automatically if present.
  let tumulusModel = null;
  if (settings.showTumulus && settings.activeTumulusModel === 'default') {
    if (state.cachedDefaultTumulusModel === null) {
      state.cachedDefaultTumulusModel = await loadGltfModel('../assets/models/tumulus.glb');
    }
    tumulusModel = state.cachedDefaultTumulusModel;
  }
  if (settings.showIslands && (!isRasterTextureMode() || blocksFc.features.length)) {
    await runLayerBuild('Blocks', () => buildIslandLayer(blocksFc, buildToken), () => clearGroup(islandGroup));
  } else {
    clearGroup(islandGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showParcels && parcelsFc) {
    await runLayerBuild('Parcels', () => buildParcelLayer(parcelsFc), () => clearGroup(parcelGroup));
  } else {
    clearGroup(parcelGroup);
  }
  if (settings.showHardscape && hardscape) {
    await runLayerBuild('Hardscape', () => buildHardscapeLayer(hardscape, buildToken), () => clearGroup(hardscapeGroup));
  } else {
    clearGroup(hardscapeGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  await runLayerBuild('Wind plume', () => buildWindPlumeLayer(), () => clearGroup(windPlumeGroup));
  if (settings.showBuildings) {
    await runLayerBuild('Buildings', () => buildBuildingLayer(buildingsFc, buildToken), () => clearGroup(buildingGroup));
  } else {
    clearGroup(buildingGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showZoningEnvelopes && settings.showBuildings && buildingsFc) {
    await runLayerBuild('Zoning Envelopes', () => buildZoningEnvelopesLayer(buildingsFc), () => clearGroup(zoningGroup));
  } else {
    clearGroup(zoningGroup);
  }
  if (isSceneBuildStale(buildToken)) return;
  await runLayerBuild('Roads', () => buildRoadsAndTraffic(roadsFc, buildToken), () => {
    clearGroup(roadGroup);
    clearGroup(carGroup);
    clearGroup(pedestrianGroup);
  });
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showBikeLanes || settings.showBikes) {
    await runLayerBuild('Bike lanes', () => buildBikeLaneLayer(bikeLanes, buildToken), () => {
      clearGroup(bikeLaneGroup);
      clearGroup(bikeGroup);
      state.bikeLaneCurves = [];
      state.bikes = [];
    });
  } else {
    clearGroup(bikeLaneGroup);
    clearGroup(bikeGroup);
    state.bikeLaneCurves = [];
    state.bikes = [];
  }
  if (isSceneBuildStale(buildToken)) return;
  if (settings.showSidewalks) {
    await runLayerBuild('Sidewalks', () => buildSidewalkLayer(roadsFc, sidewalks, buildToken), () => clearGroup(sidewalkGroup));
  } else {
    clearGroup(sidewalkGroup);
  }
  if (settings.showPedestrianPaths) {
    await runLayerBuild('Pedestrian paths', () => buildPedestrianPathLayer(pedestrianPaths, buildToken), () => { clearGroup(pedestrianPathGroup); state.pedestrianPathCurves = []; });
  } else {
    clearGroup(pedestrianPathGroup);
    state.pedestrianPathCurves = [];
  }
  if (settings.showCrosswalks) {
    await runLayerBuild('Crosswalks', () => buildCrosswalkLayer(roadsFc), () => clearGroup(crosswalkGroup));
  } else {
    clearGroup(crosswalkGroup);
  }
  await runLayerBuild('Pedestrians', () => buildPedestrianLayer(), () => clearGroup(pedestrianGroup));
  if (settings.showTrees) {
    await runLayerBuild('Trees', () => buildTreeLayer(treesFc, treeModel), () => clearGroup(treeGroup));
  } else {
    clearGroup(treeGroup);
  }
  if (settings.showMosques) {
    await runLayerBuild('Mosques', () => buildMosqueLayer(mosques, mosqueModel), () => clearGroup(mosqueGroup));
  } else {
    clearGroup(mosqueGroup);
  }
  if (settings.showTumulus) {
    await runLayerBuild('Tumulus', () => buildTumulusLayer(tumulus, tumulusModel), () => clearGroup(tumulusGroup));
  } else {
    clearGroup(tumulusGroup);
  }
  if (settings.showFurniture) {
    await runLayerBuild('Street furniture', () => buildFurnitureLayer(), () => clearGroup(furnitureGroup));
  } else {
    clearGroup(furnitureGroup);
  }
  if (settings.showFences && fences) {
    await runLayerBuild('Fences', () => buildFencesLayer(fences), () => clearGroup(fenceGroup));
  } else {
    clearGroup(fenceGroup);
  }
  if (settings.showWaterlines && waterlines) {
    await runLayerBuild('Water lines', () => buildWaterlinesLayer(waterlines), () => clearGroup(waterlineGroup));
  } else {
    clearGroup(waterlineGroup);
  }
  // Static layers are never edited per mesh after this point: merge them.
  const tStatic = performance.now();
  for (const g of [islandGroup, parcelGroup, hardscapeGroup, roadGroup, bikeLaneGroup, sidewalkGroup,
    pedestrianPathGroup, crosswalkGroup, fenceGroup, waterlineGroup]) {
    batchStaticGroup(g);
  }
  layerBuildTimings['Static: batch'] = Math.round(performance.now() - tStatic);
  const tUi = performance.now();
  rebuildMinimapBg();
  layerBuildTimings['UI: minimap'] = Math.round(performance.now() - tUi);
  sceneBuildHooks.refreshUi();
  updateDashboard(state.layerDataCache);
  layerBuildTimings['UI: total'] = Math.round(performance.now() - tUi);
  layerBuildTimings['Scene: total'] = Math.round(performance.now() - tScene);
  setSceneState('sceneReady');
  if (settings.scenarioView !== 'Off') buildScenario();
  if (!state.initialViewApplied) {
    state.initialViewApplied = true;
    sceneBuildHooks.applyInitialView();
  }

  hideLoadingOverlay();
}

export function handleSceneError(err) {
  console.error(err);
  setStatus(err?.message || t('demFail'));
  setSceneState(err?.message || 'Scene error', 'warn');
  hideLoadingOverlay(0);
}

export function rebuildSceneSafe() {
  return rebuildScene().catch((err) => {
    handleSceneError(err);
  });
}

function setSceneState(textOrKey, kind = 'ok') {
  requestRender();
  if (textOrKey === 'sceneReady') atmosphere.applyEnvironmentIntensity(scene, settings.atmosphere);
  // Layers were added or removed: the shadow map (autoUpdate off) is stale.
  sun.shadow.needsUpdate = true;
  const pill = document.getElementById('scene-state');
  if (!pill) return;
  const translated = t(textOrKey);
  if (translated !== textOrKey) pill.dataset.sceneI18n = textOrKey;
  else delete pill.dataset.sceneI18n;
  const text = translated !== textOrKey ? translated : textOrKey;
  pill.textContent = text;
  pill.style.background = kind === 'warn' ? '#fef3c7' : '#dff7ef';
  pill.style.color = kind === 'warn' ? '#92400e' : '#0f766e';
}
