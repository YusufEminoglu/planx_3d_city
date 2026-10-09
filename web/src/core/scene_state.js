// Scene-state sync: with the PlanX local server, settings, styles and Model
// Studio models are saved next to the export, so the portable package opens
// exactly as tuned; the portable package reads that snapshot back.
import { textureSets } from '../catalog.js';
import { presetValue, roofShapeValue } from '../props.js';
import { state } from './state.js';
import { isPortableMode } from './scene.js';
import {
  SETTINGS_SCHEMA_VERSION, functionBuildingStyleState, setAfterSave, blockCategoryStyleState, settings,
  PERSISTED_SETTING_KEYS
} from './settings.js';
import { uploadedModels, loadModelsFromDB, parseGltfBuffer } from './model_store.js';

// --- Portable Scene Snapshot (freeze the live scene into the portable ZIP) ---
// In the QGIS dev session the viewer auto-saves the full live scene state to the
// local server (writes web/data/planx_scene_state.json + web/data/models/*.glb).
// The portable build (?portable=1) reads that file back and applies it BEFORE
// the scene is built, so every style edit, GUI setting and Model Studio model
// survives the handoff one-to-one — instead of falling back to bare defaults
// (which is why mosques shrank to the procedural box and trees disappeared).
const SCENE_STATE_ENDPOINT = '/api/scene-state';
const SCENE_STATE_URL = '../data/planx_scene_state.json';
let sceneStateSaveTimer = null;
let sceneStateModelsDirty = false;
let sceneStateSaveInFlight = false;
let sceneStateSeeded = false;   // first save of a session always embeds the GLB models

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function buildSceneStateBundle({ includeModels = false } = {}) {
  const settingsPayload = {};
  for (const key of PERSISTED_SETTING_KEYS) settingsPayload[key] = settings[key];
  settingsPayload._schemaVersion = SETTINGS_SCHEMA_VERSION;
  const bundle = {
    schema: 'planx-3d-city-scene-state/v1',
    plugin: 'planx_3d_city',
    savedAt: new Date().toISOString(),
    settings: settingsPayload,
    functionStyles: functionBuildingStyleState,
    blockStyles: blockCategoryStyleState,
    mosqueCustomizations: state.mosqueCustomizations,
    tumulusCustomizations: state.tumulusCustomizations,
  };
  if (includeModels) {
    const models = [];
    try {
      const rows = await loadModelsFromDB();
      for (const row of rows) {
        try {
          const buffer = await row.blob.arrayBuffer();
          models.push({
            id: row.id,
            name: row.name,
            category: row.category,
            dataBase64: arrayBufferToBase64(buffer),
          });
        } catch (err) {
          console.warn('Could not serialize Model Studio model', row && row.name, err);
        }
      }
    } catch (err) {
      console.warn('Could not read Model Studio models for snapshot', err);
    }
    bundle.models = models;
  }
  return bundle;
}

export function scheduleSceneStateSave(opts = {}) {
  if (isPortableMode) return;            // the portable build never writes back
  if (opts.includeModels) sceneStateModelsDirty = true;
  if (sceneStateSaveTimer) clearTimeout(sceneStateSaveTimer);
  sceneStateSaveTimer = window.setTimeout(() => { doSceneStateSave(); }, 700);
}
setAfterSave(scheduleSceneStateSave);

async function doSceneStateSave() {
  if (isPortableMode || sceneStateSaveInFlight) return;
  sceneStateSaveInFlight = true;
  // The first save of a session embeds the models so a snapshot is never left
  // with a stale/empty model list (e.g. when models already sit in IndexedDB
  // from a previous session and the user only tweaks a color before exporting).
  const includeModels = sceneStateModelsDirty || !sceneStateSeeded;
  try {
    const bundle = await buildSceneStateBundle({ includeModels });
    const res = await fetch(SCENE_STATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bundle),
    });
    if (res && res.ok) {
      sceneStateSeeded = true;
      if (includeModels) sceneStateModelsDirty = false;
      markSceneStateSaved();
    }
  } catch (err) {
    // Opened without the PlanX local server (e.g. plain http.server) — ignore.
  } finally {
    sceneStateSaveInFlight = false;
  }
}

function markSceneStateSaved() {
  const el = document.getElementById('scene-state-indicator');
  if (!el) return;
  el.classList.add('visible');
  if (markSceneStateSaved._t) clearTimeout(markSceneStateSaved._t);
  markSceneStateSaved._t = window.setTimeout(() => el.classList.remove('visible'), 1600);
}

async function loadPortableSceneState() {
  try {
    const res = await fetch(SCENE_STATE_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn('Portable scene snapshot not available', err);
    return null;
  }
}

function applySceneStateSettings(state) {
  const saved = state && state.settings;
  if (!saved) return;
  for (const key of PERSISTED_SETTING_KEYS) {
    if (!(key in saved) || !(key in settings)) continue;
    if (typeof settings[key] === 'number') settings[key] = Number(saved[key]);
    else if (typeof settings[key] === 'boolean') settings[key] = Boolean(saved[key]);
    else settings[key] = saved[key];
  }
  settings.roofShape = roofShapeValue(settings.roofShape, 'Pyramid');
  settings.roofTexture = presetValue(settings.roofTexture, textureSets.roof, 'RoofA');
}

function applySceneStateStyles(state) {
  if (!state) return;
  if (state.functionStyles && typeof state.functionStyles === 'object') {
    Object.entries(state.functionStyles).forEach(([k, v]) => { functionBuildingStyleState[k] = v; });
  }
  if (state.blockStyles && typeof state.blockStyles === 'object') {
    Object.entries(state.blockStyles).forEach(([k, v]) => { blockCategoryStyleState[k] = v; });
  }
  if (Array.isArray(state.mosqueCustomizations)) state.mosqueCustomizations = state.mosqueCustomizations;
  if (Array.isArray(state.tumulusCustomizations)) state.tumulusCustomizations = state.tumulusCustomizations;
}

async function applySceneStateModels(state) {
  const models = state && state.models;
  if (!Array.isArray(models)) return;
  for (const model of models) {
    if (!model || !model.id) continue;
    try {
      let buffer = null;
      if (model.dataBase64) {
        buffer = base64ToArrayBuffer(model.dataBase64);
      } else if (model.target) {
        const rel = String(model.target).replace(/^(\.\.\/)*data\//, '').replace(/^\/+/, '');
        const res = await fetch('../data/' + rel, { cache: 'no-store' });
        if (!res.ok) continue;
        buffer = await res.arrayBuffer();
      }
      if (!buffer) continue;
      const scene = await parseGltfBuffer(buffer);
      uploadedModels.push({ id: model.id, name: model.name, category: model.category, scene });
    } catch (err) {
      console.warn('Could not load portable Model Studio model', model && model.name, err);
    }
  }
  state.uploadedModelsLoaded = true;  // stop ensureUploadedModelsLoaded from re-running
}

export async function hydratePortableSceneState() {
  state.portableSceneState = await loadPortableSceneState();
  if (!state.portableSceneState) return;
  applySceneStateSettings(state.portableSceneState);
  applySceneStateStyles(state.portableSceneState);
  await applySceneStateModels(state.portableSceneState);
}
