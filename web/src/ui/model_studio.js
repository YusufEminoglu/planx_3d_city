// Model Studio dock: upload glTF models per category (trees, mosques,
// tumuli, furniture), pick the active one, set elevation, scale and rotation,
// and customise individual landmarks.
import { t } from '../ui_text.js';
import { state } from '../core/state.js';
import { settings, savePersistedSettings } from '../core/settings.js';
import {
  uploadedModels, saveModelToDB, deleteModelFromDB, saveMosqueCustomizations, saveTumulusCustomizations,
  parseGltfBuffer
} from '../core/model_store.js';
import { buildTreeLayer } from '../layers/trees.js';
import { buildMosqueLayer, buildTumulusLayer } from '../layers/landmarks.js';
import { buildFurnitureLayer } from '../layers/furniture.js';
import { updateDockControls } from './dock_controls.js';

function rebuildMosqueLayerPartially() {
  if (!state.layerDataCache || !state.layerDataCache.mosques) return;
  buildMosqueLayer(state.layerDataCache.mosques, state.cachedDefaultMosqueModel);
}

function rebuildTreeLayerPartially() {
  if (!state.layerDataCache || !state.layerDataCache.treesFc) return;
  buildTreeLayer(state.layerDataCache.treesFc, state.cachedDefaultTreeModel);
}

function rebuildTumulusLayerPartially() {
  if (!state.layerDataCache || !state.layerDataCache.tumulus) return;
  buildTumulusLayer(state.layerDataCache.tumulus, null);
}

function rebuildFurnitureLayerPartially() {
  if (!state.layerDataCache) return;
  buildFurnitureLayer();
}

function rebuildCategoryLayer(cat) {
  if (cat === 'tree') {
    rebuildTreeLayerPartially();
  } else if (cat === 'mosque') {
    rebuildMosqueLayerPartially();
  } else if (cat === 'tumulus') {
    rebuildTumulusLayerPartially();
  } else {
    rebuildFurnitureLayerPartially();
  }
}

function getActiveModelForCategory(cat) {
  if (cat === 'tree') return settings.activeTreeModel;
  if (cat === 'light') return settings.activeLightModel;
  if (cat === 'bench') return settings.activeBenchModel;
  if (cat === 'bin') return settings.activeBinModel;
  if (cat === 'busstop') return settings.activeBusStopModel;
  if (cat === 'mosque') return settings.activeMosqueModel;
  if (cat === 'tumulus') return settings.activeTumulusModel;
  return 'default';
}

function setActiveModelForCategory(cat, modelId) {
  if (cat === 'tree') {
    settings.activeTreeModel = modelId;
    if (modelId !== 'default') {
      settings.showTrees = true;
      settings.treeRenderMode = 'Model-based';
    }
  } else if (cat === 'light') {
    settings.activeLightModel = modelId;
    if (modelId !== 'default') {
      settings.showFurniture = true;
      settings.showLights = true;
    }
  } else if (cat === 'bench') {
    settings.activeBenchModel = modelId;
    if (modelId !== 'default') {
      settings.showFurniture = true;
      settings.showBenches = true;
    }
  } else if (cat === 'bin') {
    settings.activeBinModel = modelId;
    if (modelId !== 'default') {
      settings.showFurniture = true;
      settings.showBins = true;
    }
  } else if (cat === 'busstop') {
    settings.activeBusStopModel = modelId;
    if (modelId !== 'default') {
      settings.showFurniture = true;
      settings.showBusStops = true;
    }
  } else if (cat === 'mosque') {
    settings.activeMosqueModel = modelId;
    if (modelId !== 'default') {
      settings.showMosques = true;
    }
  } else if (cat === 'tumulus') {
    settings.activeTumulusModel = modelId;
    if (modelId !== 'default') {
      settings.showTumulus = true;
    }
  }

  if (typeof updateDockControls === 'function') {
    updateDockControls();
  }
}

function getMosqueName(feature, index) {
  const props = feature.properties || {};
  return props.name || props.label || `${t('catMosque') || 'Mosque'} #${index + 1}`;
}

export function renderUploadedModelsList() {
  const container = document.getElementById('uploaded-models-list');
  if (!container) return;
  container.innerHTML = '';

  // Trees are managed in their own random-pool section, not via single Use/Reset.
  const items = uploadedModels.filter(m => m.category !== 'tree');

  if (items.length === 0) {
    container.innerHTML = `<div style="text-align:center; font-size:0.7rem; color:rgba(255,255,255,0.4); padding:10px;">${t('noModelsUploaded') || 'No models uploaded yet.'}</div>`;
    return;
  }

  items.forEach(m => {
    const isCategoryActive = getActiveModelForCategory(m.category) === m.id;
    const item = document.createElement('div');
    item.className = 'uploaded-model-item';
    
    const catLabel = t('cat' + m.category.charAt(0).toUpperCase() + m.category.slice(1)) || m.category;
    
    item.innerHTML = `
      <div class="model-meta">
        <span class="model-name" title="${m.name}">${m.name}</span>
        <span class="model-tag">${catLabel} ${isCategoryActive ? ` <span style="color:#22c55e;">● ${t('active') || 'Active'}</span>` : ''}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        ${!isCategoryActive ? `
          <button class="btn-use-model" data-id="${m.id}" data-category="${m.category}" style="background: var(--planx-accent, #5eead4); color: #0f172a; border: 0; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer;">
            ${t('btnUse') || 'Use'}
          </button>
        ` : `
          <button class="btn-reset-model" data-category="${m.category}" style="background: rgba(255,255,255,0.15); color: white; border: 0; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer;">
            ${t('btnReset') || 'Reset'}
          </button>
        `}
        <button class="btn-delete-model" data-id="${m.id}">x</button>
      </div>
    `;
    
    item.querySelector('.btn-use-model')?.addEventListener('click', () => {
      setActiveModelForCategory(m.category, m.id);
      savePersistedSettings();
      renderUploadedModelsList();
      rebuildCategoryLayer(m.category);
    });
    
    item.querySelector('.btn-reset-model')?.addEventListener('click', () => {
      setActiveModelForCategory(m.category, 'default');
      savePersistedSettings();
      renderUploadedModelsList();
      rebuildCategoryLayer(m.category);
    });
    
    item.querySelector('.btn-delete-model')?.addEventListener('click', async () => {
      if (confirm(t('confirmDeleteModel') || 'Are you sure you want to delete this model?')) {
        await deleteModelFromDB(m.id);
        const idx = uploadedModels.findIndex(x => x.id === m.id);
        if (idx !== -1) uploadedModels.splice(idx, 1);
        
        if (getActiveModelForCategory(m.category) === m.id) {
          setActiveModelForCategory(m.category, 'default');
        }
        if (Array.isArray(settings.treeModelPool)) {
          settings.treeModelPool = settings.treeModelPool.filter(id => id !== m.id);
        }

        state.mosqueCustomizations.forEach(cust => {
          if (cust.modelId === m.id) cust.modelId = 'default';
        });
        saveMosqueCustomizations();
        state.tumulusCustomizations.forEach(cust => {
          if (cust.modelId === m.id) cust.modelId = 'default';
        });
        saveTumulusCustomizations();

        savePersistedSettings();
        renderUploadedModelsList();
        renderTreePoolList();
        renderMosqueCustomizationsList();
        renderTumulusCustomizationsList();
        rebuildCategoryLayer(m.category);
      }
    });

    container.appendChild(item);
  });
}

export function renderTreePoolList() {
  const container = document.getElementById('tree-pool-list');
  if (!container) return;
  container.innerHTML = '';

  const treeItems = uploadedModels.filter(m => m.category === 'tree');
  if (treeItems.length === 0) {
    container.innerHTML = `<div style="text-align:center; font-size:0.7rem; color:rgba(255,255,255,0.4); padding:10px;">${t('noModelsUploaded') || 'No models uploaded yet.'}</div>`;
    return;
  }

  if (!Array.isArray(settings.treeModelPool)) settings.treeModelPool = [];

  treeItems.forEach(m => {
    const inPool = settings.treeModelPool.includes(m.id);
    const item = document.createElement('div');
    item.className = 'uploaded-model-item';
    item.innerHTML = `
      <div class="model-meta">
        <span class="model-name" title="${m.name}">${m.name}</span>
        <span class="model-tag">${t('catTree') || 'Tree'} ${inPool ? ` <span style="color:#22c55e;">● ${t('active') || 'Active'}</span>` : ''}</span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <button class="btn-pool-toggle" style="background: ${inPool ? 'rgba(255,255,255,0.15)' : 'var(--planx-accent, #5eead4)'}; color: ${inPool ? 'white' : '#0f172a'}; border: 0; border-radius: 4px; padding: 2px 6px; font-size: 0.65rem; font-weight: bold; cursor: pointer;">
          ${inPool ? (t('btnInPool') || '✓ In pool') : (t('btnAddPool') || '+ Add to pool')}
        </button>
        <button class="btn-delete-model" data-id="${m.id}">x</button>
      </div>
    `;

    item.querySelector('.btn-pool-toggle')?.addEventListener('click', () => {
      if (!Array.isArray(settings.treeModelPool)) settings.treeModelPool = [];
      if (settings.treeModelPool.includes(m.id)) {
        settings.treeModelPool = settings.treeModelPool.filter(id => id !== m.id);
      } else {
        settings.treeModelPool.push(m.id);
      }
      // Keep the legacy single-active field in sync and switch trees to model mode.
      settings.activeTreeModel = settings.treeModelPool[0] || 'default';
      if (settings.treeModelPool.length) {
        settings.showTrees = true;
        settings.treeRenderMode = 'Model-based';
      }
      savePersistedSettings();
      renderTreePoolList();
      updateDockControls();
      rebuildTreeLayerPartially();
    });

    item.querySelector('.btn-delete-model')?.addEventListener('click', async () => {
      if (confirm(t('confirmDeleteModel') || 'Are you sure you want to delete this model?')) {
        await deleteModelFromDB(m.id);
        const idx = uploadedModels.findIndex(x => x.id === m.id);
        if (idx !== -1) uploadedModels.splice(idx, 1);
        if (Array.isArray(settings.treeModelPool)) {
          settings.treeModelPool = settings.treeModelPool.filter(id => id !== m.id);
        }
        settings.activeTreeModel = settings.treeModelPool[0] || 'default';
        savePersistedSettings();
        renderTreePoolList();
        renderUploadedModelsList();
        updateDockControls();
        rebuildTreeLayerPartially();
      }
    });

    container.appendChild(item);
  });
}

const CATEGORY_ELEVATION_KEY = {
  mosque: 'mosqueElevation',
  tumulus: 'tumulusElevation',
  tree: 'treeElevation',
  light: 'lightElevation',
  bench: 'benchElevation',
  bin: 'binElevation',
  busstop: 'busstopElevation',
};

const MODEL_ELEVATION_MIN = -30;
const MODEL_ELEVATION_MAX = 50;

const CATEGORY_SCALE_KEYS = {
  mosque: ['mosqueScaleX', 'mosqueScaleY', 'mosqueScaleZ'],
  tumulus: ['tumulusScaleX', 'tumulusScaleY', 'tumulusScaleZ'],
  tree: ['treeScaleX', 'treeScaleY', 'treeScaleZ'],
  light: ['lightScaleX', 'lightScaleY', 'lightScaleZ'],
  bench: ['benchScaleX', 'benchScaleY', 'benchScaleZ'],
  bin: ['binScaleX', 'binScaleY', 'binScaleZ'],
  busstop: ['busstopScaleX', 'busstopScaleY', 'busstopScaleZ'],
};

// Categories whose global rotation is meaningful from the Transform panel.
// Furniture rotation is applied as an offset on top of the road-aligned/attribute angle.
const CATEGORY_ROTATION_KEY = {
  mosque: 'mosqueRotation',
  tumulus: 'tumulusRotation',
  light: 'lightRotation',
  bench: 'benchRotation',
  bin: 'binRotation',
  busstop: 'busstopRotation',
};

function activeTransformCategory() {
  const sel = document.getElementById('transform-category');
  return (sel && sel.value) || 'mosque';
}

// Per-category Elevation + Scale (X/Y/Z) panel, driven by the category selector.
export function renderModelTransformControls() {
  const container = document.getElementById('model-transform-controls');
  if (!container) return;
  container.innerHTML = '';

  const cat = activeTransformCategory();
  const elevKey = CATEGORY_ELEVATION_KEY[cat];
  const scaleKeys = CATEGORY_SCALE_KEYS[cat];
  const rotKey = CATEGORY_ROTATION_KEY[cat];

  const makeSliderRow = (labelText, key, min, max, step, fmt) => {
    const current = Number(settings[key]);
    const value = Number.isFinite(current) ? current : (key.includes('Scale') ? 1 : 0);
    const row = document.createElement('div');
    row.className = 'mosque-custom-slider-row';
    row.style.cssText = 'display:flex; align-items:center; gap:6px;';
    row.innerHTML = `
      <span style="flex: 0 0 78px; font-size: 0.72rem; color: rgba(255,255,255,0.85);">${labelText}</span>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1;">
      <span class="transform-val" style="min-width:44px; text-align:right; font-size:0.72rem;">${fmt(value)}</span>
    `;
    const input = row.querySelector('input');
    const valOut = row.querySelector('.transform-val');
    let debounceTimer;
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      settings[key] = v;
      valOut.textContent = fmt(v);
      if (typeof updateDockControls === 'function') updateDockControls();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        savePersistedSettings();
        rebuildCategoryLayer(cat);
      }, 60);
    });
    container.appendChild(row);
  };

  if (elevKey) {
    makeSliderRow(t('lblElevation') || 'Elevation', elevKey, MODEL_ELEVATION_MIN, MODEL_ELEVATION_MAX, 0.5, (v) => v.toFixed(1) + 'm');
  }
  if (scaleKeys) {
    makeSliderRow(t('lblScaleX') || 'Scale X', scaleKeys[0], 0.1, 10, 0.1, (v) => v.toFixed(1) + 'x');
    makeSliderRow(t('lblScaleY') || 'Scale Y', scaleKeys[1], 0.1, 10, 0.1, (v) => v.toFixed(1) + 'x');
    makeSliderRow(t('lblScaleZ') || 'Scale Z', scaleKeys[2], 0.1, 10, 0.1, (v) => v.toFixed(1) + 'x');
  }
  if (rotKey) {
    makeSliderRow(t('lblRotation') || 'Rotation', rotKey, 0, 360, 1, (v) => Math.round(v) + '°');
  }
}

export function renderMosqueCustomizationsList() {
  const container = document.getElementById('mosque-custom-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (!state.layerDataCache?.mosques?.features?.length) {
    container.innerHTML = `<div style="text-align:center; font-size:0.7rem; color:rgba(255,255,255,0.4); padding:10px;">${t('noMosquesInProject') || 'No mosques in the current project.'}</div>`;
    return;
  }
  
  state.layerDataCache.mosques.features.forEach((f, idx) => {
    const name = getMosqueName(f, idx);
    
    if (!state.mosqueCustomizations[idx]) {
      state.mosqueCustomizations[idx] = {
        modelId: 'default',
        color: '#ffffff',
        scaleX: 1.0,
        scaleY: 1.0,
        scaleZ: 1.0,
        rotation: 0,
        elevation: 0
      };
    }
    const cust = state.mosqueCustomizations[idx];
    if (cust.elevation === undefined) cust.elevation = 0;
    
    const card = document.createElement('div');
    card.className = 'mosque-custom-card';
    
    let modelOptionsHtml = `
      <option value="default" ${cust.modelId === 'default' ? 'selected' : ''}>${t('catGlobal') || 'Global Default'}</option>
      <option value="procedural" ${cust.modelId === 'procedural' ? 'selected' : ''}>${t('catProcedural') || 'Procedural'}</option>
    `;
    
    uploadedModels.filter(m => m.category === 'mosque').forEach(m => {
      modelOptionsHtml += `<option value="${m.id}" ${cust.modelId === m.id ? 'selected' : ''}>${m.name}</option>`;
    });
    
    card.innerHTML = `
      <div class="mosque-custom-card-header">
        <strong>${name}</strong>
      </div>
      <div class="mosque-custom-card-grid">
        <div class="mosque-custom-field">
          <span>${t('lblModel') || 'Model'}</span>
          <select class="mosque-model-select">${modelOptionsHtml}</select>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblColor') || 'Color'}</span>
          <input type="color" class="mosque-color-input" value="${cust.color || '#ffffff'}">
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleX') || 'Scale X'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="mosque-scale-x" min="0.1" max="5.0" step="0.1" value="${cust.scaleX}">
            <span class="scale-x-val" style="min-width:24px; text-align:right;">${cust.scaleX}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleY') || 'Scale Y'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="mosque-scale-y" min="0.1" max="5.0" step="0.1" value="${cust.scaleY}">
            <span class="scale-y-val" style="min-width:24px; text-align:right;">${cust.scaleY}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleZ') || 'Scale Z'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="mosque-scale-z" min="0.1" max="5.0" step="0.1" value="${cust.scaleZ}">
            <span class="scale-z-val" style="min-width:24px; text-align:right;">${cust.scaleZ}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblRotation') || 'Rotation'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="mosque-rotation" min="0" max="360" step="5" value="${cust.rotation}">
            <span class="rotation-val" style="min-width:24px; text-align:right;">${cust.rotation}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblElevation') || 'Elevation'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="mosque-elevation" min="${MODEL_ELEVATION_MIN}" max="${MODEL_ELEVATION_MAX}" step="0.5" value="${cust.elevation}">
            <span class="elevation-val" style="min-width:32px; text-align:right;">${Number(cust.elevation).toFixed(1)}m</span>
          </div>
        </div>
      </div>
    `;
    
    let debounceTimer;
    const triggerRebuild = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        saveMosqueCustomizations();
        rebuildMosqueLayerPartially();
      }, 50);
    };
    
    card.querySelector('.mosque-model-select').addEventListener('change', (e) => {
      cust.modelId = e.target.value;
      triggerRebuild();
    });
    
    card.querySelector('.mosque-color-input').addEventListener('input', (e) => {
      cust.color = e.target.value;
      triggerRebuild();
    });
    
    const scaleXInput = card.querySelector('.mosque-scale-x');
    const scaleXVal = card.querySelector('.scale-x-val');
    scaleXInput.addEventListener('input', (e) => {
      cust.scaleX = parseFloat(e.target.value);
      scaleXVal.innerText = cust.scaleX;
      triggerRebuild();
    });
    
    const scaleYInput = card.querySelector('.mosque-scale-y');
    const scaleYVal = card.querySelector('.scale-y-val');
    scaleYInput.addEventListener('input', (e) => {
      cust.scaleY = parseFloat(e.target.value);
      scaleYVal.innerText = cust.scaleY;
      triggerRebuild();
    });
    
    const scaleZInput = card.querySelector('.mosque-scale-z');
    const scaleZVal = card.querySelector('.scale-z-val');
    scaleZInput.addEventListener('input', (e) => {
      cust.scaleZ = parseFloat(e.target.value);
      scaleZVal.innerText = cust.scaleZ;
      triggerRebuild();
    });
    
    const rotationInput = card.querySelector('.mosque-rotation');
    const rotationVal = card.querySelector('.rotation-val');
    rotationInput.addEventListener('input', (e) => {
      cust.rotation = parseInt(e.target.value);
      rotationVal.innerText = cust.rotation;
      triggerRebuild();
    });

    const elevationInput = card.querySelector('.mosque-elevation');
    const elevationVal = card.querySelector('.elevation-val');
    elevationInput.addEventListener('input', (e) => {
      cust.elevation = parseFloat(e.target.value);
      elevationVal.innerText = cust.elevation.toFixed(1) + 'm';
      triggerRebuild();
    });

    container.appendChild(card);
  });
}

function getTumulusName(feature, index) {
  const props = feature.properties || {};
  return props.name || props.label || `${t('catTumulus') || 'Tumulus'} #${index + 1}`;
}

export function renderTumulusCustomizationsList() {
  const container = document.getElementById('tumulus-custom-list');
  if (!container) return;
  container.innerHTML = '';

  if (!state.layerDataCache?.tumulus?.features?.length) {
    container.innerHTML = `<div style="text-align:center; font-size:0.7rem; color:rgba(255,255,255,0.4); padding:10px;">${t('noTumulusInProject') || 'No tumuli in the current project.'}</div>`;
    return;
  }

  state.layerDataCache.tumulus.features.forEach((f, idx) => {
    if (!f.geometry || f.geometry.type !== 'Point') return;
    const name = getTumulusName(f, idx);

    if (!state.tumulusCustomizations[idx]) {
      state.tumulusCustomizations[idx] = {
        modelId: 'default',
        color: '#ffffff',
        scaleX: 1.0,
        scaleY: 1.0,
        scaleZ: 1.0,
        rotation: 0,
        elevation: 0
      };
    }
    const cust = state.tumulusCustomizations[idx];
    if (cust.elevation === undefined) cust.elevation = 0;

    const card = document.createElement('div');
    card.className = 'mosque-custom-card';

    let modelOptionsHtml = `
      <option value="default" ${cust.modelId === 'default' ? 'selected' : ''}>${t('catGlobal') || 'Global Default'}</option>
      <option value="procedural" ${cust.modelId === 'procedural' ? 'selected' : ''}>${t('catProcedural') || 'Procedural'}</option>
    `;
    uploadedModels.filter(m => m.category === 'tumulus').forEach(m => {
      modelOptionsHtml += `<option value="${m.id}" ${cust.modelId === m.id ? 'selected' : ''}>${m.name}</option>`;
    });

    card.innerHTML = `
      <div class="mosque-custom-card-header">
        <strong>${name}</strong>
      </div>
      <div class="mosque-custom-card-grid">
        <div class="mosque-custom-field">
          <span>${t('lblModel') || 'Model'}</span>
          <select class="tumulus-model-select">${modelOptionsHtml}</select>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblColor') || 'Color'}</span>
          <input type="color" class="tumulus-color-input" value="${cust.color || '#ffffff'}">
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleX') || 'Scale X'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="tumulus-scale-x" min="0.1" max="5.0" step="0.1" value="${cust.scaleX}">
            <span class="scale-x-val" style="min-width:24px; text-align:right;">${cust.scaleX}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleY') || 'Scale Y'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="tumulus-scale-y" min="0.1" max="5.0" step="0.1" value="${cust.scaleY}">
            <span class="scale-y-val" style="min-width:24px; text-align:right;">${cust.scaleY}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblScaleZ') || 'Scale Z'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="tumulus-scale-z" min="0.1" max="5.0" step="0.1" value="${cust.scaleZ}">
            <span class="scale-z-val" style="min-width:24px; text-align:right;">${cust.scaleZ}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblRotation') || 'Rotation'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="tumulus-rotation" min="0" max="360" step="5" value="${cust.rotation}">
            <span class="rotation-val" style="min-width:24px; text-align:right;">${cust.rotation}</span>
          </div>
        </div>
        <div class="mosque-custom-field">
          <span>${t('lblElevation') || 'Elevation'}</span>
          <div class="mosque-custom-slider-row">
            <input type="range" class="tumulus-elevation" min="${MODEL_ELEVATION_MIN}" max="${MODEL_ELEVATION_MAX}" step="0.5" value="${cust.elevation}">
            <span class="elevation-val" style="min-width:32px; text-align:right;">${Number(cust.elevation).toFixed(1)}m</span>
          </div>
        </div>
      </div>
    `;

    let debounceTimer;
    const triggerRebuild = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        saveTumulusCustomizations();
        rebuildTumulusLayerPartially();
      }, 50);
    };

    card.querySelector('.tumulus-model-select').addEventListener('change', (e) => {
      cust.modelId = e.target.value;
      triggerRebuild();
    });
    card.querySelector('.tumulus-color-input').addEventListener('input', (e) => {
      cust.color = e.target.value;
      triggerRebuild();
    });
    const sx = card.querySelector('.tumulus-scale-x');
    const sxv = card.querySelector('.scale-x-val');
    sx.addEventListener('input', (e) => { cust.scaleX = parseFloat(e.target.value); sxv.innerText = cust.scaleX; triggerRebuild(); });
    const sy = card.querySelector('.tumulus-scale-y');
    const syv = card.querySelector('.scale-y-val');
    sy.addEventListener('input', (e) => { cust.scaleY = parseFloat(e.target.value); syv.innerText = cust.scaleY; triggerRebuild(); });
    const sz = card.querySelector('.tumulus-scale-z');
    const szv = card.querySelector('.scale-z-val');
    sz.addEventListener('input', (e) => { cust.scaleZ = parseFloat(e.target.value); szv.innerText = cust.scaleZ; triggerRebuild(); });
    const rot = card.querySelector('.tumulus-rotation');
    const rotv = card.querySelector('.rotation-val');
    rot.addEventListener('input', (e) => { cust.rotation = parseInt(e.target.value); rotv.innerText = cust.rotation; triggerRebuild(); });
    const elev = card.querySelector('.tumulus-elevation');
    const elevv = card.querySelector('.elevation-val');
    elev.addEventListener('input', (e) => { cust.elevation = parseFloat(e.target.value); elevv.innerText = cust.elevation.toFixed(1) + 'm'; triggerRebuild(); });

    container.appendChild(card);
  });
}

export function initModelStudioListeners() {
  const uploadFileInput = document.getElementById('upload-model-file');
  const uploadCategorySelect = document.getElementById('upload-model-category');
  const uploadStatusDiv = document.getElementById('upload-status');
  const transformCategorySelect = document.getElementById('transform-category');
  if (transformCategorySelect) {
    transformCategorySelect.addEventListener('change', () => renderModelTransformControls());
  }

  if (uploadFileInput) {
    uploadFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const category = uploadCategorySelect.value;
      uploadStatusDiv.innerText = t('statusParsing') || 'Parsing GLB model...';
      uploadStatusDiv.style.color = '#a5f3fc';
      
      try {
        const buffer = await file.arrayBuffer();
        const scene = await parseGltfBuffer(buffer);
        
        const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        await saveModelToDB(id, file.name, category, file);
        
        uploadedModels.push({
          id,
          name: file.name,
          category,
          scene
        });
        
        uploadStatusDiv.innerText = t('statusSuccess') || 'Successfully loaded!';
        uploadStatusDiv.style.color = '#22c55e';
        uploadFileInput.value = '';

        if (category === 'tree') {
          // Newly uploaded tree models join the random pool automatically.
          if (!Array.isArray(settings.treeModelPool)) settings.treeModelPool = [];
          if (!settings.treeModelPool.includes(id)) settings.treeModelPool.push(id);
          settings.activeTreeModel = settings.treeModelPool[0] || 'default';
          settings.showTrees = true;
          settings.treeRenderMode = 'Model-based';
          updateDockControls();
        } else {
          setActiveModelForCategory(category, id);
        }
        savePersistedSettings();
        renderUploadedModelsList();
        renderTreePoolList();
        renderModelTransformControls();
        renderMosqueCustomizationsList();
        renderTumulusCustomizationsList();
        rebuildCategoryLayer(category);

      } catch (err) {
        console.error('Error parsing uploaded file', err);
        uploadStatusDiv.innerText = (t('statusError') || 'Error parsing model: ') + err.message;
        uploadStatusDiv.style.color = '#ef4444';
      }
    });
  }
}
