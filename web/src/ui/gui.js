// The advanced settings panel (lil-gui), with per-function building styles.
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { t } from '../ui_text.js';
import { ROOF_SHAPE_OPTIONS, textureSets } from '../catalog.js';
import { state } from '../core/state.js';
import {
  functionColorState, functionFacadeState, uniqueAssetVariants, settings, ensureFunctionBuildingStyle,
  syncLegacyFunctionStyle, saveFunctionBuildingStyles
} from '../core/settings.js';
import { requestRender } from '../core/render.js';
import { updateTimeOfDay } from '../core/daylight.js';
import { syncWind } from '../layers/trees.js';
import { checkTimeChange, updateWeather } from '../layers/environment.js';
import { rebuildScene } from '../core/scene_build.js';

export let globalGui = null;
export let functionGuiRefs = null;

export function addGui() {
  if (globalGui) globalGui.destroy();
  globalGui = new GUI({ title: t('guiTitle') });

  const env = globalGui.addFolder(t('env'));
  env.add(settings, 'fogDensity', 0.0001, 0.002, 0.0001).name(t('fog')).onChange(checkTimeChange);

  const fx = globalGui.addFolder(t('fxFolder'));
  fx.add(settings, 'timeOfDay', 0, 24, 0.1).name(t('timeOfDay')).onChange(checkTimeChange);
  fx.add(settings, 'autoTime').name(t('autoTime'));
  fx.add(settings, 'autoTimeSpeed', 0.5, 8, 0.5).name(t('autoTimeSpd'));
  fx.add(settings, 'weather', ['Clear', 'Rain', 'Snow']).name(t('weather')).onChange(updateWeather);
  fx.add(settings, 'enableSSAO').name(t('sSsa'));
  fx.add(settings, 'enableBloom').name(t('sBloom')).onChange(checkTimeChange);
  fx.add(settings, 'atmosphere', ['Cinematic', 'Clean']).name('Atmosphere').onChange(checkTimeChange);
  fx.add(settings, 'depthOfField').name('Depth of field').onChange(() => requestRender());
  fx.add(settings, 'treeWind').name('Wind sway (trees)').onChange(() => { syncWind(); requestRender(); });

  const terrain = globalGui.addFolder(t('terrain'));
  terrain.add(settings, 'showTerrainTexture').name('Plan texture').onChange(rebuildScene);
  terrain.add(settings, 'showOutsideRoiTerrain').name(t('lblOutsideRoiTerrain')).onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureOpacity', 0.1, 1.0, 0.05).name('Texture opacity').onChange(rebuildScene);
  terrain.add(settings, 'terrainTextureBrightness', 0.5, 1.5, 0.05).name('Texture brightness').onChange(() => { state.terrainTexture = null; rebuildScene(); });
  terrain.add(settings, 'terrainTextureContrast', 0.5, 1.8, 0.05).name('Texture contrast').onChange(() => { state.terrainTexture = null; rebuildScene(); });
  terrain.addColor(settings, 'terrainOutsideColor').name('Outside ROI color').onChange(rebuildScene);
  terrain.add(settings, 'showTerrainSides').name('Build sides').onChange(rebuildScene);
  terrain.add(settings, 'terrainSideDrop', 0, 40, 0.5).name('Side drop from DEM min').onChange(rebuildScene);
  terrain.addColor(settings, 'terrainSideColor').name('Side color').onChange(rebuildScene);
  terrain.add(settings, 'demMeshQuality', 48, 360, 8).name('DEM mesh quality').onChange(rebuildScene);
  terrain.add(settings, 'terrainSmoothingPasses', 0, 5, 1).name('DEM smooth passes').onChange(rebuildScene);
  terrain.add(settings, 'terrainSmoothingStrength', 0, 0.9, 0.05).name('DEM smooth strength').onChange(rebuildScene);
  terrain.add(settings, 'terrainMaxSlope', 0.1, 3.0, 0.05).name('DEM max slope').onChange(rebuildScene);
  terrain.add(settings, 'terrainAnalysisMode', ['Texture', 'Elevation tint', 'Slope tint']).name('Topography view').onChange(rebuildScene);
  terrain.add(settings, 'flattenIslands').name(t('flattenIslands')).onChange(rebuildScene);
  terrain.add(settings, 'islandPlateauTransition', 0, 20, 1).name(t('islandPlateauTransition')).onChange(rebuildScene);
  terrain.add(settings, 'dayOfYear', 1, 365, 1).name(t('dayOfYear')).onChange(updateTimeOfDay);
  terrain.add(settings, 'latitude', -60, 60, 0.5).name(t('latitude')).onChange(updateTimeOfDay);
  terrain.add(settings, 'pavementStyle', Object.keys(textureSets.pavement)).name(t('pavement')).onChange(rebuildScene);
  terrain.add(settings, 'showHardscape').name(t('showHardscape')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeStyle', Object.keys(textureSets.hardscape)).name(t('hardTex')).onChange(rebuildScene);
  terrain.add(settings, 'hardscapeHeight', 0.0, 2.0, 0.05).name(t('hardH')).onChange(rebuildScene);
  terrain.add(settings, 'showIslands').name(t('lblBlocks')).onChange(rebuildScene);
  terrain.addColor(settings, 'islandColor').name(t('islCol')).onChange(rebuildScene);
  terrain.add(settings, 'islandTexture', Object.keys(textureSets.island)).name(t('islTex')).onChange(rebuildScene);
  terrain.add(settings, 'islandTransparency', 0, 0.95, 0.05).name(t('lblIslandTransparency')).onChange(rebuildScene);
  terrain.addColor(settings, 'parkColor').name(t('parkCol')).onChange(rebuildScene);
  terrain.add(settings, 'parkTexture', Object.keys(textureSets.island)).name(t('parkTex')).onChange(rebuildScene);
  terrain.addColor(settings, 'sportColor').name(t('sportCol')).onChange(rebuildScene);

  const parcels = globalGui.addFolder(t('parcels'));
  parcels.add(settings, 'showParcels').name(t('showParcels')).onChange(rebuildScene);
  parcels.addColor(settings, 'parcelBoundaryColor').name(t('boundCol')).onChange(rebuildScene);
  parcels.add(settings, 'parcelBoundaryOpacity', 0.05, 1.0, 0.01).name(t('boundOp')).onChange(rebuildScene);

  const bld = globalGui.addFolder(t('bld'));
  bld.add(settings, 'buildingMode', ['Footprint only', 'Extruded', 'Extruded + roof']).name('Building mode').onChange(rebuildScene);
  bld.add(settings, 'facadeTextureScale', 1.0, 8.0, 0.05).name('Facade scale').onChange(rebuildScene);
  bld.add(settings, 'floorHeight', 2.5, 5.0, 0.05).name(t('floorH')).onChange(rebuildScene);
  bld.add(settings, 'roofShape', ROOF_SHAPE_OPTIONS).name(t('roofShape')).onChange(rebuildScene);
  bld.add(settings, 'roofHeight', 0.5, 6.0, 0.1).name(t('roofH')).onChange(rebuildScene);
  bld.add(settings, 'roofTexture', Object.keys(textureSets.roof)).name(t('roofTex')).onChange(rebuildScene);

  const roads = globalGui.addFolder(t('roads'));
  roads.add(settings, 'roadStyle', Object.keys(textureSets.road)).name('Asphalt Style').onChange(rebuildScene);
  roads.add(settings, 'showCars').name(t('showCars')).onChange(rebuildScene);
  roads.add(settings, 'carDensity', 0.0, 1.0, 0.1).name(t('carDensity')).onChange(rebuildScene);
  roads.add(settings, 'showRoads').name(t('showRoads')).onChange(rebuildScene);
  roads.add(settings, 'roadColorMode', ['Default', 'Amenity distance', 'Access / traffic']).name('Road analysis').onChange(rebuildScene);
  roads.addColor(settings, 'roadColor').name(t('roadCol')).onChange(rebuildScene);
  roads.addColor(settings, 'sidewalkColor').name(t('sidewalkCol')).onChange(rebuildScene);
  roads.add(settings, 'roadWidth', 5.0, 20.0, 0.5).name(t('roadW')).onChange(rebuildScene);
  roads.add(settings, 'trafficSpeed', 0, 5, 0.1).name(t('trafficSpd'));
  roads.add(settings, 'showSidewalks').name(t('showSidewalks')).onChange(rebuildScene);
  roads.add(settings, 'showPedestrianPaths').name(t('showPedestrianPaths')).onChange(rebuildScene);
  roads.add(settings, 'showCrosswalks').name(t('showCrosswalks')).onChange(rebuildScene);
  roads.add(settings, 'showPedestrians').onChange(rebuildScene);
  roads.add(settings, 'pedestrianDensity', 0.0, 1.0, 0.1).name(t('pedDensity')).onChange(rebuildScene);

  const bikeFolder = globalGui.addFolder(t('dockBike'));
  bikeFolder.add(settings, 'showBikeLanes').name(t('lblBikeLanes')).onChange(rebuildScene);
  bikeFolder.add(settings, 'bikeLaneWidth', 1.5, 5.0, 0.1).name(t('lblBikeLaneWidth')).onChange(rebuildScene);
  bikeFolder.addColor(settings, 'bikeLaneColor').name(t('lblBikeLaneColor')).onChange(rebuildScene);
  bikeFolder.add(settings, 'showBikes').name(t('lblBikes')).onChange(rebuildScene);
  bikeFolder.add(settings, 'bikeDensity', 0.0, 0.4, 0.02).name(t('lblBikeDensity')).onChange(rebuildScene);
  bikeFolder.add(settings, 'bikeSpeed', 0, 3, 0.1).name(t('lblBikeSpeed'));

  const analysis = globalGui.addFolder('Plan Analysis');
  analysis.add(settings, 'showWindPlumes').name('Wind plume risk').onChange(rebuildScene);
  analysis.add(settings, 'windDirectionDeg', 0, 359, 1).name('Wind direction').onChange(rebuildScene);
  analysis.add(settings, 'windPlumeDistance', 40, 600, 10).name('Plume distance').onChange(rebuildScene);
  
  const sfGroup = globalGui.addFolder(t('sfFolder'));
  sfGroup.add(settings, 'showLights').name(t('sfLights')).onChange(rebuildScene);
  sfGroup.add(settings, 'lightStyle', uniqueAssetVariants('lights', ['Modern Arc', 'Classic Post', 'Dual Head', 'Slim Post'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBenches').name(t('sfBenches')).onChange(rebuildScene);
  sfGroup.add(settings, 'benchStyle', uniqueAssetVariants('benches', ['Wood Plank', 'Concrete Slab', 'Curved Metal'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBins').name(t('sfBins')).onChange(rebuildScene);
  sfGroup.add(settings, 'binStyle', uniqueAssetVariants('bins', ['Square Box', 'Cylinder', 'Dual Recycle'])).onChange(rebuildScene);
  sfGroup.add(settings, 'showBusStops').name(t('sfStops')).onChange(rebuildScene);
  sfGroup.add(settings, 'stopStyle', uniqueAssetVariants('busstops', ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin'])).onChange(rebuildScene);

  const style = globalGui.addFolder(t('funcCol'));
  const facade = globalGui.addFolder(t('funcFac'));
  const refreshFunctionGui = async () => {
    const styleCtrls = [...style.controllers];
    styleCtrls.forEach((c) => c.destroy());
    const facadeCtrls = [...facade.controllers];
    facadeCtrls.forEach((c) => c.destroy());
    const keys = Object.keys(functionColorState);
    keys.forEach((k) => {
      ensureFunctionBuildingStyle(k);
      style.addColor(functionColorState, k).name(k.slice(0, 16)).onFinishChange(() => {
        syncLegacyFunctionStyle(k);
        saveFunctionBuildingStyles();
        rebuildScene();
      });
      facade.add(functionFacadeState, k, uniqueAssetVariants('facades', Object.keys(textureSets.facade)).filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value))).name(k.slice(0, 16)).onFinishChange(() => {
        syncLegacyFunctionStyle(k);
        saveFunctionBuildingStyles();
        rebuildScene();
      });
    });
  };

  functionGuiRefs = { refreshFunctionGui };
  if (Object.keys(functionColorState).length > 0) refreshFunctionGui();
  globalGui.close();
  if (globalGui.domElement) globalGui.domElement.style.display = 'none';
}
