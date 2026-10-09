// Viewer settings and styles: the settings object (defaults, then what the
// user saved in this browser), per-function building styles, block category
// styles and the asset theme helpers that fill settings from a theme.
import { textureSets, assetThemePresets } from '../catalog.js';
import { propFirst, normalizeHexColor, presetValue, roofShapeValue, setFieldNameResolver } from '../props.js';
import { state } from './state.js';
import { isPortableMode } from './scene.js';

export const FACADE_TEXTURE_SCALE_MULTIPLIER = 4.85;
export const SETTINGS_SCHEMA_VERSION = 9;

export const functionColorState = {};
export const functionFacadeState = {};
export const functionBuildingStyleState = {};
// Called after settings, styles or models are saved: the scene-state sync
// registers here, so a portable package keeps the edits.
let afterSave = () => {};
export function setAfterSave(fn) {
  afterSave = fn;
}
export function notifySaved(opts) {
  afterSave(opts);
}
const FUNCTION_STYLE_STORAGE_KEY = 'planx_3d_city_function_styles';

export const blockCategoryStyleState = {};
export const blockCategoryColorState = {};
export const blockCategoryTextureState = {};
const BLOCK_STYLE_STORAGE_KEY = 'planx_3d_city_block_styles';

function activeAssetTheme() {
  const name = settings.assetTheme || state.projectManifest?.assetTheme || 'Modern Urban';
  return assetThemePresets[name] ? name : 'Modern Urban';
}

export function assetPoolVariants(category) {
  const fromManifest = settings.assetTheme === state.projectManifest?.assetTheme ? state.projectManifest?.assetPools?.[category]?.variants : null;
  if (Array.isArray(fromManifest) && fromManifest.length) return fromManifest;
  return assetThemePresets[activeAssetTheme()]?.[category] || assetThemePresets['Modern Urban'][category] || [];
}

function firstAssetVariant(category, fallback) {
  const variants = assetPoolVariants(category);
  return variants.length ? variants[0] : fallback;
}

export function applyThemeDefaultsToSettings(resetFunctionFacades = true) {
  settings.lightStyle = firstAssetVariant('lights', settings.lightStyle);
  settings.benchStyle = firstAssetVariant('benches', settings.benchStyle);
  settings.binStyle = firstAssetVariant('bins', settings.binStyle);
  settings.stopStyle = firstAssetVariant('busstops', settings.stopStyle);
  const roof = firstAssetVariant('roofs', settings.roofTexture);
  if (Object.prototype.hasOwnProperty.call(textureSets.roof, roof)) settings.roofTexture = roof;
  const paving = firstAssetVariant('paving', settings.pavementStyle);
  if (Object.prototype.hasOwnProperty.call(textureSets.pavement, paving)) settings.pavementStyle = paving;
  if (resetFunctionFacades) {
    const facades = assetPoolVariants('facades').filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value));
    Object.keys(functionFacadeState).forEach((key, index) => {
      const facade = normalizeFacadeKey(facades[index % Math.max(1, facades.length)] || functionFacadeState[key]);
      functionFacadeState[key] = facade;
      if (functionBuildingStyleState[key]) functionBuildingStyleState[key].facade = facade;
    });
    saveFunctionBuildingStyles();
  }
}

export function uniqueAssetVariants(category, fallback = []) {
  const values = [];
  const add = (items) => {
    for (const item of items || []) {
      if (item && !values.includes(item)) values.push(item);
    }
  };
  add(fallback);
  Object.values(assetThemePresets).forEach((preset) => add(preset[category]));
  return values;
}

export function normalizeFacadeKey(key) {
  const raw = String(key || '').trim();
  if (!raw) return 'UrbanA';
  const exact = Object.keys(textureSets.facade).find((name) => name.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  // Legacy fallback: keep the scene drawable even when stored facade keys are stale.
  return 'UrbanA';
}

export function resolveFacadeForLevels(key, _levels) {
  return normalizeFacadeKey(key);
}

export function facadeTextureFloorRows(_key, fallback = 10) {
  return fallback;
}

export function mappedField(key) {
  return state.projectManifest?.fieldMappings?.[key] || null;
}

export function namesWithMapping(mappingKey, fallbackNames) {
  const mapped = mappedField(mappingKey);
  return mapped ? [mapped, ...fallbackNames] : fallbackNames;
}
setFieldNameResolver(namesWithMapping);

export function buildingFunctionValue(props) {
  return propFirst(props || {}, namesWithMapping('landuse_function_field', ['function', 'landuse', 'building:use'])) || 'UNDEFINED';
}

export const settings = {
  sunElevation: 30,
  sunAzimuth: 30,
  fogDensity: 0.0003,
  mapOpacity: 1.0,
  floorHeight: 3.2,
  pavementStyle: 'Asphalt',
  showTerrainTexture: true,
  showOutsideRoiTerrain: true,
  terrainTextureOpacity: 1.0,
  terrainTextureBrightness: 1.0,
  terrainTextureContrast: 1.0,
  terrainOutsideColor: '#edf2ef',
  terrainSmoothingPasses: 2,
  terrainSmoothingStrength: 0.45,
  terrainMaxSlope: 0.75,
  showTerrainSides: true,
  terrainSideDrop: 5.0,
  terrainSideColor: '#d9fbf5',
  islandColor: '#e5e7eb',
  islandTexture: 'None',
  parcelBoundaryColor: '#71717a',
  parcelBoundaryOpacity: 0.35,
  hardscapeStyle: 'Cobble',
  hardscapeHeight: 0.30,
  buildingMode: 'Extruded + roof',
  terrainAnalysisMode: 'Texture',
  assetTheme: 'Modern Urban',
  showXyzTiles: false,
  xyzTileUrl: '',
  roofTexture: 'RoofA',
  roofShape: 'Pyramid',
  roofHeight: 2.0,
  roadStyle: 'Asphalt',
  roadColor: '#2f3438',
  sidewalkColor: '#c9bfa2',
  roadColorMode: 'Default',
  roadWidth: 8.0,
  showBikeLanes: true,
  bikeLaneWidth: 3.0,
  bikeLaneColor: '#16a34a',
  showBikes: true,
  bikeDensity: 0.12,
  bikeSpeed: 1.0,
  trafficSpeed: 1.0,
  showWindPlumes: false,
  windDirectionDeg: 315,
  windPlumeDistance: 180,
  showUrbanComfort: false,
  carDensity: 0.2,
  showIslands: true,
  showParcels: false,
  showHardscape: false,
  showBuildings: true,
  facadeTextureScale: FACADE_TEXTURE_SCALE_MULTIPLIER,
  showTrees: false,
  treeRenderMode: 'Stylized',
  treeRandomize: true,
  treeVariantCount: 8,
  treeHeightRandomExpr: '',
  showMosques: true,
  mosqueScaleX: 1.0,
  mosqueScaleY: 1.0,
  mosqueScaleZ: 1.0,
  mosqueRotation: 0.0,
  showTumulus: true,
  tumulusScaleX: 1.0,
  tumulusScaleY: 1.0,
  tumulusScaleZ: 1.0,
  tumulusRotation: 0.0,
  showFurniture: false,
  showCars: false,
  showRoads: true,
  showSidewalks: true,
  showPedestrianPaths: true,
  showCrosswalks: true,
  showLights: false,
  lightStyle: 'Modern Arc',
  showBenches: false,
  benchStyle: 'Wood Plank',
  showBins: false,
  binStyle: 'Square Box',
  showBusStops: false,
  stopStyle: 'Glass Shelter',
  fastTerrainSegments: 120,
  demMeshQuality: 160,
  timeOfDay: 14,
  enableSSAO: true,
  enableBloom: true,
  depthOfField: false,
  atmosphere: 'Cinematic',
  treeWind: false,
  showPedestrians: false,
  pedestrianDensity: 0.5,
  weather: 'Clear',
  fov: 58,
  walkSpeed: 1.0,
  autoOrbit: false,
  autoOrbitSpeed: 0.3,
  autoTime: false,
  autoTimeSpeed: 2.0,
  flattenIslands: true,
  islandPlateauTransition: 6,
  islandTransparency: 0,
  dayOfYear: 172,
  latitude: 39.0,
  parkColor: '#5e9e3e',
  parkTexture: 'ParkGreen',
  sportColor: '#4a8c30',
  furnitureGroundOffset: 0.02,
  terrainTileMeters: 60,
  showFences: false,
  fenceHeight: 1.8,
  fenceThickness: 0.15,
  fenceTexture: 'wall',
  fenceColor: '#a1a1aa',
  showWaterlines: false,
  waterlineWidth: 3.0,
  showRoadMarkings: true,
  showLedges: true,
  showStorefronts: true,
  buildingSetback: 1.2,
  ledgeProjection: 0.15,
  showZoningEnvelopes: false,
  highlightViolations: true,
  zoningSetback: 3.0,
  zoningMaxHeight: 40.0,
  zoningCoverage: 0.4,
  zoningBCoverage: 0.3,
  zoningBFar: 1.5,
  zoningBMaxHeight: 21,
  zoningBSetback: 5,
  viewshedRadius: 500,
  zoningFar: 2.0,
  scenarioView: 'Off',
  activeTreeModel: 'default',
  activeLightModel: 'default',
  activeBenchModel: 'default',
  activeBinModel: 'default',
  activeBusStopModel: 'default',
  activeMosqueModel: 'default',
  activeTumulusModel: 'default',
  treeModelPool: [],
  mosqueElevation: 0,
  tumulusElevation: 0,
  treeElevation: 0,
  lightElevation: 0,
  benchElevation: 0,
  binElevation: 0,
  busstopElevation: 0,
  treeScaleX: 1.0,
  treeScaleY: 1.0,
  treeScaleZ: 1.0,
  lightScaleX: 1.0,
  lightScaleY: 1.0,
  lightScaleZ: 1.0,
  benchScaleX: 1.0,
  benchScaleY: 1.0,
  benchScaleZ: 1.0,
  binScaleX: 1.0,
  binScaleY: 1.0,
  binScaleZ: 1.0,
  busstopScaleX: 1.0,
  busstopScaleY: 1.0,
  busstopScaleZ: 1.0,
  lightRotation: 0,
  benchRotation: 0,
  binRotation: 0,
  busstopRotation: 0
};

export const PERSISTED_SETTING_KEYS = [
  'islandColor', 'islandTexture', 'islandTransparency', 'parcelBoundaryColor', 'parcelBoundaryOpacity',
  'showTerrainTexture', 'showOutsideRoiTerrain', 'terrainTextureOpacity', 'terrainTextureBrightness', 'terrainTextureContrast',
  'terrainOutsideColor', 'terrainSmoothingPasses', 'terrainSmoothingStrength', 'terrainMaxSlope',
  'showTerrainSides', 'terrainSideDrop', 'terrainSideColor',
  'fogDensity', 'autoTime', 'autoTimeSpeed', 'enableSSAO', 'enableBloom', 'atmosphere', 'treeWind', 'depthOfField',
  'pavementStyle', 'hardscapeStyle', 'hardscapeHeight', 'buildingMode', 'facadeTextureScale', 'terrainAnalysisMode', 'showXyzTiles', 'xyzTileUrl',
  'assetTheme',
  'floorHeight', 'roofTexture', 'roofShape', 'roofHeight', 'roadStyle', 'roadColor', 'sidewalkColor', 'roadColorMode', 'roadWidth',
  'showBikeLanes', 'bikeLaneWidth', 'bikeLaneColor', 'showBikes', 'bikeDensity', 'bikeSpeed',
  'showLights', 'lightStyle', 'showBenches', 'benchStyle', 'showBins', 'binStyle', 'showBusStops', 'stopStyle',
  'showIslands', 'showParcels', 'showHardscape', 'showBuildings', 'showTrees', 'showFurniture', 'showMosques',
  'showTumulus', 'tumulusScaleX', 'tumulusScaleY', 'tumulusScaleZ', 'tumulusRotation',
  'mosqueScaleX', 'mosqueScaleY', 'mosqueScaleZ', 'mosqueRotation',
  'mosqueElevation', 'tumulusElevation', 'treeElevation', 'lightElevation', 'benchElevation', 'binElevation', 'busstopElevation',
  'treeScaleX', 'treeScaleY', 'treeScaleZ', 'lightScaleX', 'lightScaleY', 'lightScaleZ',
  'benchScaleX', 'benchScaleY', 'benchScaleZ', 'binScaleX', 'binScaleY', 'binScaleZ',
  'busstopScaleX', 'busstopScaleY', 'busstopScaleZ',
  'lightRotation', 'benchRotation', 'binRotation', 'busstopRotation',
  'treeRenderMode', 'treeRandomize', 'treeVariantCount', 'treeHeightRandomExpr',
  'showCars', 'showRoads', 'showSidewalks', 'showPedestrianPaths', 'showCrosswalks', 'showPedestrians',
  'showWindPlumes', 'windDirectionDeg', 'windPlumeDistance', 'showUrbanComfort',
  'demMeshQuality', 'timeOfDay', 'weather', 'fov', 'walkSpeed',
  'flattenIslands', 'islandPlateauTransition',
  'dayOfYear', 'latitude',
  'parkColor', 'parkTexture', 'sportColor',
  'terrainTileMeters',
  'showFences', 'fenceHeight', 'fenceThickness', 'fenceTexture', 'fenceColor',
  'showWaterlines', 'waterlineWidth',
  'showRoadMarkings', 'showLedges', 'showStorefronts', 'buildingSetback', 'ledgeProjection',
  'showZoningEnvelopes', 'highlightViolations', 'zoningSetback', 'zoningMaxHeight', 'zoningCoverage', 'zoningFar', 'scenarioView', 'viewshedRadius', 'zoningBCoverage', 'zoningBFar', 'zoningBMaxHeight', 'zoningBSetback',
  'activeTreeModel', 'activeLightModel', 'activeBenchModel', 'activeBinModel', 'activeBusStopModel', 'activeMosqueModel',
  'activeTumulusModel', 'treeModelPool'
];

function loadPersistedSettings() {
  if (isPortableMode) {
    console.log('PlanX Portable Mode: localStorage settings reading disabled.');
    return;
  }
  try {
    const raw = localStorage.getItem('planx_3d_city_settings');
    if (!raw) return;
    const saved = JSON.parse(raw);
    const schemaVersion = Number(saved._schemaVersion || 0);
    for (const key of PERSISTED_SETTING_KEYS) {
      if (!(key in saved) || !(key in settings)) continue;
      if (typeof settings[key] === 'number') settings[key] = Number(saved[key]);
      else if (typeof settings[key] === 'boolean') settings[key] = Boolean(saved[key]);
      else settings[key] = saved[key];
    }
    if (schemaVersion < SETTINGS_SCHEMA_VERSION) {
      if (!('facadeTextureScale' in saved)) settings.facadeTextureScale = FACADE_TEXTURE_SCALE_MULTIPLIER;
      if (!('showOutsideRoiTerrain' in saved)) settings.showOutsideRoiTerrain = true;
      if (!('showIslands' in saved)) settings.showIslands = true;
      if (!('islandTransparency' in saved)) settings.islandTransparency = 0;
      settings.flattenIslands = true;
      if (!('treeRenderMode' in saved)) settings.treeRenderMode = 'Stylized';
      if (!('treeRandomize' in saved)) settings.treeRandomize = true;
      if (!('treeVariantCount' in saved)) settings.treeVariantCount = 8;
      if (!('treeHeightRandomExpr' in saved)) settings.treeHeightRandomExpr = '';
      if (schemaVersion < 9) {
        settings.showIslands = true;
        settings.islandTransparency = 0;
        settings.buildingMode = 'Extruded + roof';
      }
    }
    settings.roofShape = roofShapeValue(settings.roofShape, 'Pyramid');
    settings.roofTexture = presetValue(settings.roofTexture, textureSets.roof, 'RoofA');
  } catch (err) {
    console.warn('Could not restore PlanX viewer settings', err);
  }
}

function defaultFunctionBuildingStyle(fn, index = 0) {
  const facadeOptions = uniqueAssetVariants('facades', Object.keys(textureSets.facade))
    .filter((name) => Object.prototype.hasOwnProperty.call(textureSets.facade, name));
  return {
    color: getSemanticColor(fn) || ['#f1f5f9', '#dbeafe', '#fee2e2', '#dcfce7', '#fef3c7', '#ede9fe'][index % 6],
    facade: normalizeFacadeKey(facadeOptions[index % Math.max(1, facadeOptions.length)] || 'UrbanA'),
    facadeScale: settings.facadeTextureScale,
    floorHeight: settings.floorHeight,
    roofShape: roofShapeValue(settings.roofShape, 'Pyramid'),
    roofHeight: settings.roofHeight,
    roofTexture: presetValue(settings.roofTexture, textureSets.roof, 'RoofA'),
    roofColor: '#ffffff',
    setbackEnabled: true
  };
}

function sanitizeFunctionBuildingStyle(style, fallback) {
  const base = { ...fallback, ...(style || {}) };
  return {
    color: normalizeHexColor(base.color, fallback.color),
    facade: normalizeFacadeKey(base.facade || fallback.facade),
    facadeScale: Math.max(1, Math.min(8, Number(base.facadeScale) || fallback.facadeScale)),
    floorHeight: Math.max(2.4, Math.min(6, Number(base.floorHeight) || fallback.floorHeight)),
    roofShape: roofShapeValue(base.roofShape, fallback.roofShape),
    roofHeight: Math.max(0, Math.min(8, Number(base.roofHeight) || fallback.roofHeight)),
    roofTexture: presetValue(base.roofTexture, textureSets.roof, fallback.roofTexture),
    roofColor: normalizeHexColor(base.roofColor, fallback.roofColor),
    setbackEnabled: base.setbackEnabled !== false
  };
}

export function ensureFunctionBuildingStyle(fn, index = 0) {
  const fallback = defaultFunctionBuildingStyle(fn, index);
  functionBuildingStyleState[fn] = sanitizeFunctionBuildingStyle(functionBuildingStyleState[fn], fallback);
  functionColorState[fn] = functionBuildingStyleState[fn].color;
  functionFacadeState[fn] = functionBuildingStyleState[fn].facade;
  return functionBuildingStyleState[fn];
}

export function syncLegacyFunctionStyle(fn) {
  if (!functionBuildingStyleState[fn]) return;
  functionBuildingStyleState[fn].color = functionColorState[fn] || functionBuildingStyleState[fn].color;
  functionBuildingStyleState[fn].facade = normalizeFacadeKey(functionFacadeState[fn] || functionBuildingStyleState[fn].facade);
}

function loadFunctionBuildingStyles() {
  if (isPortableMode) return;
  try {
    const raw = localStorage.getItem(FUNCTION_STYLE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    Object.entries(parsed || {}).forEach(([key, value]) => {
      functionBuildingStyleState[key] = value;
    });
  } catch (err) {
    console.warn('Could not restore function building styles', err);
  }
}

export function saveFunctionBuildingStyles() {
  if (isPortableMode) return;
  try {
    localStorage.setItem(FUNCTION_STYLE_STORAGE_KEY, JSON.stringify(functionBuildingStyleState));
  } catch (err) {
    console.warn('Could not save function building styles', err);
  }
  afterSave();
}

export function savePersistedSettings() {
  if (isPortableMode) return;
  try {
    const payload = {};
    for (const key of PERSISTED_SETTING_KEYS) payload[key] = settings[key];
    payload._schemaVersion = SETTINGS_SCHEMA_VERSION;
    localStorage.setItem('planx_3d_city_settings', JSON.stringify(payload));
  } catch (err) {
    console.warn('Could not save PlanX viewer settings', err);
  }
  afterSave();
}

export function blockCategoryValue(properties) {
  const field = state.projectManifest?.fieldMappings?.block_category_field;
  if (field && properties && properties[field] !== undefined && properties[field] !== null) {
    return properties[field];
  }
  const defaults = ['planx_category', 'category', 'function'];
  for (const def of defaults) {
    if (properties && properties[def] !== undefined && properties[def] !== null) {
      return properties[def];
    }
  }
  return 'Residential';
}

function defaultBlockCategoryStyle(cat, index = 0) {
  const c = cat.toUpperCase();
  let color = ['#f5e4c2', '#bfdbfe', '#fee2e2', '#dcfce7', '#fef3c7', '#ede9fe'][index % 6];
  let texture = 'None';
  if (/PARK|GREEN|FOREST|PLAYGROUND|GARDEN|MEADOW/.test(c)) {
    color = '#5e9e3e';
    texture = 'ParkGreen';
  } else if (/WATER|LAKE|SEA\b|RIVER|POND|RESERVOIR/.test(c)) {
    color = '#0f5e9c';
    texture = 'Water';
  } else if (/SPORT|STADIUM|PITCH/.test(c)) {
    color = '#4a8c30';
    texture = 'FineGrid';
  } else if (/RESIDENT|HOUSING/.test(c)) {
    color = '#d6c8a6';
    texture = 'ResidentialBeige';
  } else if (/CIVIC|PUBLIC|COMMERCIAL|RETAIL|SCHOOL|EDUCATION/.test(c)) {
    color = '#b6b3a8';
    texture = 'CivicGravel';
  }
  return { color, texture };
}

export function ensureBlockCategoryStyle(cat, index = 0) {
  if (!blockCategoryStyleState[cat] || !blockCategoryStyleState[cat].color || !blockCategoryStyleState[cat].texture) {
    const fallback = defaultBlockCategoryStyle(cat, index);
    blockCategoryStyleState[cat] = {
      color: blockCategoryStyleState[cat]?.color || fallback.color,
      texture: blockCategoryStyleState[cat]?.texture || fallback.texture
    };
  }
  blockCategoryColorState[cat] = blockCategoryStyleState[cat].color;
  blockCategoryTextureState[cat] = blockCategoryStyleState[cat].texture;
  return blockCategoryStyleState[cat];
}

function loadBlockCategoryStyles() {
  if (isPortableMode) return;
  try {
    const raw = localStorage.getItem(BLOCK_STYLE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.entries(parsed || {}).forEach(([k, v]) => {
        blockCategoryStyleState[k] = v;
      });
    }
  } catch (err) {
    console.warn('Could not restore block category styles', err);
  }
}

export function saveBlockCategoryStyles() {
  if (isPortableMode) return;
  try {
    localStorage.setItem(BLOCK_STYLE_STORAGE_KEY, JSON.stringify(blockCategoryStyleState));
  } catch (err) {
    console.warn('Could not save block category styles', err);
  }
  afterSave();
}

export function blockCategoryStylesActive() {
  return Object.keys(blockCategoryColorState).length > 0;
}

// Keyword matching on the (upper-cased) land-use / function value.
const FUNCTION_KEYWORDS = [
  { re: /RESIDENT|HOUSING|DWELLING|APARTMENT/, color: '#f5e4c2', icon: '🏠' },
  { re: /SCHOOL|EDUCATION|UNIVERSITY|COLLEGE|CAMPUS/, color: '#bfdbfe', icon: '🏫' },
  { re: /MOSQUE|CHURCH|TEMPLE|SYNAGOGUE|RELIGIO|WORSHIP/, color: '#d8f5e0', icon: '🕌' },
  { re: /COMMERCIAL|RETAIL|SHOP|MALL|MARKET|OFFICE/, color: '#fed7aa', icon: '🏪' },
  { re: /HEALTH|HOSPITAL|CLINIC|MEDICAL/, color: '#fce7f3', icon: '🏥' },
  { re: /SPORT|STADIUM|ARENA/, color: '#e0e7ff', icon: '🏟️' },
  { re: /PARK|GREEN|GARDEN/, color: '#bbf7d0', icon: '🌳' },
  { re: /CIVIC|PUBLIC|GOVERNMENT|MUNICIPAL|ADMINISTRAT/, color: '#ede9fe', icon: '🏛️' },
  { re: /INDUSTR|FACTORY|WAREHOUSE|MANUFACTUR/, color: '#e2e8f0', icon: '🏭' }
];

function getSemanticColor(fn) {
  const f = String(fn).toUpperCase();
  return FUNCTION_KEYWORDS.find((k) => k.re.test(f))?.color || '#f1f5f9';
}

export function getFunctionIcon(fn) {
  const f = String(fn).toUpperCase();
  return FUNCTION_KEYWORDS.find((k) => k.re.test(f))?.icon || '🏢';
}

// Restore what the user saved in this browser.
loadPersistedSettings();
loadFunctionBuildingStyles();
loadBlockCategoryStyles();
