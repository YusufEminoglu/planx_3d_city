// Loading the exported data: the manifest and its defaults, GeoJSON layers,
// textures, and unit and floor-count helpers for feature attributes.
import * as THREE from 'three';
import { textureSets } from '../catalog.js';
import { LOCAL_X_SIGN } from '../geo.js';
import { propFirst, parseLevel } from '../props.js';
import { proceduralTextureCanvas } from '../textures.js';
import { state } from './state.js';
import { isPortableMode, texLoader } from './scene.js';
import {
  FACADE_TEXTURE_SCALE_MULTIPLIER, SETTINGS_SCHEMA_VERSION, applyThemeDefaultsToSettings, namesWithMapping,
  settings
} from './settings.js';

export async function textureFromSet(setName, key, repeatX = 1, repeatY = 1) {
  const token = textureSets[setName]?.[key];
  if (!token) return null;
  if (typeof token === 'string' && (token.startsWith('assets/') || token.startsWith('http'))) {
    return loadTexture(token, repeatX, repeatY);
  }
  const tex = proceduralTextureCanvas(token || key);
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function metersToLocal(x, y) {
  return [(x - state.centerX) * LOCAL_X_SIGN, y - state.centerY];
}

export function localToMeters(localX, localZ) {
  return [state.centerX + localX * LOCAL_X_SIGN, state.centerY + localZ];
}

// Common column names for building floor count (OSM building:levels first).
const BUILDING_FLOOR_FIELD_ALIASES = [
  'building:levels', 'floors', 'num_floors', 'numfloors', 'floor_count', 'levels', 'storeys', 'stories'
];

// Raw floor-count value as stored on the feature, honoring the QGIS-mapped
// 'building_floors_field' first, or null when no usable column exists.
export function buildingLevelsRaw(props) {
  return propFirst(props || {}, namesWithMapping('building_floors_field', BUILDING_FLOOR_FIELD_ALIASES));
}

// Building floor count: prefers the QGIS-mapped 'building_floors_field', then
// falls back to common column names. Building height is this
// count multiplied by the (per-feature or global) floor height.
export function buildingLevels(props) {
  return parseLevel(buildingLevelsRaw(props));
}

export const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };
const DATA_FETCH_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(url, options = {}, timeoutMs = DATA_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadGeoJson(path, options = {}) {
  const { required = false, label = path } = options;
  try {
    const r = await fetchWithTimeout(path);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.features)) {
      throw new Error('Invalid GeoJSON FeatureCollection');
    }
    return data;
  } catch (err) {
    if (required) {
      throw new Error(`${label} could not be loaded: ${path}`);
    }
    if (!String(err?.message || err).includes('HTTP 404')) {
      console.warn(`Optional layer skipped: ${path}`, err);
    }
    return { ...EMPTY_GEOJSON, name: label };
  }
}

export async function loadManifest() {
  try {
    const r = await fetchWithTimeout('../data/planx_manifest.json', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch (err) {
    console.warn('PlanX manifest not available', err);
    return null;
  }
}

export function applyManifestDefaults() {
  if (state.manifestDefaultsApplied || !state.projectManifest) return;
  state.manifestDefaultsApplied = true;
  let persisted = null;
  if (isPortableMode) {
    // Portable build: the frozen snapshot's settings stand in for localStorage,
    // so manifest defaults only fill gaps the snapshot does not already cover.
    persisted = (state.portableSceneState && state.portableSceneState.settings) || null;
  } else {
    try {
      const raw = localStorage.getItem('planx_3d_city_settings');
      if (raw) persisted = JSON.parse(raw);
    } catch (_) {}
  }
  if (persisted) {
    try {
      const schemaVersion = Number(persisted._schemaVersion || 0);
      const defaults = { ...(state.projectManifest.viewerDefaults || {}), ...(state.projectManifest.analysisDefaults || {}) };
      if (state.projectManifest.assetTheme && !defaults.assetTheme) defaults.assetTheme = state.projectManifest.assetTheme;
      for (const [key, value] of Object.entries(defaults)) {
        if (key in settings && !(key in persisted) && value !== null && value !== undefined) settings[key] = value;
      }
      if (schemaVersion < SETTINGS_SCHEMA_VERSION) {
        if (!('facadeTextureScale' in persisted)) settings.facadeTextureScale = FACADE_TEXTURE_SCALE_MULTIPLIER;
        if (!('showOutsideRoiTerrain' in persisted)) settings.showOutsideRoiTerrain = true;
        if (!('showIslands' in persisted)) settings.showIslands = true;
        if (!('islandTransparency' in persisted)) settings.islandTransparency = 0;
        if (!('showPedestrianPaths' in persisted)) settings.showPedestrianPaths = true;
        settings.flattenIslands = true;
        if (schemaVersion < 9) {
          settings.showIslands = true;
          settings.islandTransparency = 0;
          settings.buildingMode = 'Extruded + roof';
        }
      }
      if (!persisted.assetTheme && state.projectManifest.assetTheme) settings.assetTheme = state.projectManifest.assetTheme;
    } catch (_err) {
      if (state.projectManifest.assetTheme) settings.assetTheme = state.projectManifest.assetTheme;
    }
    applyThemeDefaultsToSettings(false);
    return;
  }
  const defaults = { ...(state.projectManifest.viewerDefaults || {}), ...(state.projectManifest.analysisDefaults || {}) };
  if (state.projectManifest.assetTheme && !defaults.assetTheme) defaults.assetTheme = state.projectManifest.assetTheme;
  for (const [key, value] of Object.entries(defaults)) {
    if (key in settings && value !== null && value !== undefined) settings[key] = value;
  }
  applyThemeDefaultsToSettings(false);
}

async function loadTexture(path, repeatX = 1, repeatY = 1) {
  if (!path) return null;
  return new Promise((resolve, reject) => {
    texLoader.load(path, (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.colorSpace = THREE.SRGBColorSpace;
      resolve(t);
    }, undefined, reject);
  });
}

export function viewerMode() {
  return state.projectManifest?.mode || 'vector';
}

export function isRasterTextureMode() {
  return viewerMode() === 'raster_texture';
}

export function manifestRequiresInput(key) {
  const required = state.projectManifest?.requiredInputs;
  if (Array.isArray(required)) return required.includes(key);
  if (isRasterTextureMode()) return ['roi', 'roads', 'buildings'].includes(key);
  return false;
}

export function asFeatureCollection(data, name = 'Layer') {
  return data && Array.isArray(data.features) ? data : { ...EMPTY_GEOJSON, name };
}
