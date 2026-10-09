// The dock panels: open/close, every [data-setting] control, analysis and
// time presets, the theme switch, bookmarks, and the block-category and
// building-function style editors.
import { t } from '../ui_text.js';
import { ROOF_SHAPE_OPTIONS, textureSets } from '../catalog.js';
import { presetValue, roofShapeValue } from '../props.js';
import { state } from '../core/state.js';
import {
  isPortableMode, islandGroup, parcelGroup, hardscapeGroup, buildingGroup, roadGroup, treeGroup, mosqueGroup,
  tumulusGroup, carGroup, bikeLaneGroup, bikeGroup, furnitureGroup, pedestrianGroup, sidewalkGroup,
  pedestrianPathGroup, crosswalkGroup, fenceGroup, waterlineGroup, zoningGroup
} from '../core/scene.js';
import {
  functionColorState, functionFacadeState, blockCategoryColorState, blockCategoryTextureState,
  applyThemeDefaultsToSettings, uniqueAssetVariants, normalizeFacadeKey, settings, ensureFunctionBuildingStyle,
  saveFunctionBuildingStyles, savePersistedSettings, ensureBlockCategoryStyle, saveBlockCategoryStyles
} from '../core/settings.js';
import { requestRender } from '../core/render.js';
import { setStatus } from './status.js';
import { clearGroup } from '../core/scene_util.js';
import { updateTimeOfDay } from '../core/daylight.js';
import { buildZoningEnvelopesLayer, buildScenario } from '../layers/zoning.js';
import { computeExposure, removeShadowHeatmap } from '../analysis/exposure.js';
import { checkTimeChange, updateWeather } from '../layers/environment.js';
import { cameraBookmarks, loadCameraBookmarks, addCameraBookmark, renderCameraBookmarks } from './bookmarks.js';
import {
  updateBlockStyleModeUi, populateDockSelects, updateDockControls, reflectDockSettings
} from './dock_controls.js';
import { rebuildScene } from '../core/scene_build.js';
import {
  renderUploadedModelsList, renderTreePoolList, renderModelTransformControls, renderMosqueCustomizationsList,
  renderTumulusCustomizationsList, initModelStudioListeners
} from './model_studio.js';
import { globalGui } from './gui.js';

export function renderBlockCategoryStyleDock() {
  const host = document.getElementById('block-style-controls');
  if (!host) return;
  const keys = Object.keys(blockCategoryColorState).sort();
  updateBlockStyleModeUi();
  if (!keys.length) {
    host.innerHTML = `<p class="dock-note">Block categories appear after data is loaded.</p>`;
    return;
  }
  host.innerHTML = '';
  const islandOptions = Object.keys(textureSets.island);
  const makeSelect = (options, value) => {
    const select = document.createElement('select');
    options.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
    select.value = value;
    return select;
  };
  const makeField = (labelText, control) => {
    const label = document.createElement('label');
    label.className = 'function-style-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  };
  keys.forEach((key, index) => {
    const style = ensureBlockCategoryStyle(key, index);
    const card = document.createElement('div');
    card.className = 'function-style-card';

    const header = document.createElement('div');
    header.className = 'function-style-header';
    const name = document.createElement('strong');
    name.textContent = key;
    name.title = key;
    const color = document.createElement('input');
    color.type = 'color';
    color.value = style.color;
    color.title = 'Block color';
    color.addEventListener('input', () => {
      style.color = color.value;
      blockCategoryColorState[key] = color.value;
      saveBlockCategoryStyles();
      requestFunctionStyleRebuild();
    });
    header.append(name, color);

    const grid = document.createElement('div');
    grid.className = 'function-style-grid';

    const islandTex = makeSelect(islandOptions, style.texture);
    islandTex.addEventListener('change', () => {
      style.texture = islandTex.value;
      blockCategoryTextureState[key] = style.texture;
      saveBlockCategoryStyles();
      rebuildScene();
    });

    grid.append(makeField('Texture', islandTex));
    card.append(header, grid);
    host.append(card);
  });
}

let functionStyleRebuildTimer = null;
function requestFunctionStyleRebuild() {
  window.clearTimeout(functionStyleRebuildTimer);
  functionStyleRebuildTimer = window.setTimeout(() => rebuildScene(), 140);
}

export function renderFunctionStyleDock() {
  const host = document.getElementById('function-style-controls');
  if (!host) return;
  const keys = Object.keys(functionColorState).sort();
  if (!keys.length) {
    host.innerHTML = `<p class="dock-note">${t('funcStylesPending')}</p>`;
    return;
  }
  host.innerHTML = '';
  const facadeOptions = uniqueAssetVariants('facades', Object.keys(textureSets.facade))
    .filter((value) => Object.prototype.hasOwnProperty.call(textureSets.facade, value));
  const roofOptions = Object.keys(textureSets.roof);
  const makeSelect = (options, value) => {
    const select = document.createElement('select');
    options.forEach((item) => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      select.appendChild(opt);
    });
    select.value = value;
    return select;
  };
  const makeRange = (min, max, step, value) => {
    const wrap = document.createElement('div');
    wrap.className = 'function-style-range';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = value;
    const out = document.createElement('output');
    out.value = String(value);
    out.textContent = String(value);
    wrap.append(input, out);
    return { wrap, input, out };
  };
  const makeField = (labelText, control) => {
    const label = document.createElement('label');
    label.className = 'function-style-field';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  };
  keys.forEach((key, index) => {
    const style = ensureFunctionBuildingStyle(key, index);
    const card = document.createElement('div');
    card.className = 'function-style-card';

    const header = document.createElement('div');
    header.className = 'function-style-header';
    const name = document.createElement('strong');
    name.textContent = key;
    name.title = key;
    const color = document.createElement('input');
    color.type = 'color';
    color.value = style.color;
    color.title = 'Facade color';
    color.addEventListener('input', () => {
      style.color = color.value;
      functionColorState[key] = color.value;
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });
    header.append(name, color);

    const grid = document.createElement('div');
    grid.className = 'function-style-grid';

    const facade = makeSelect(facadeOptions, style.facade);
    facade.addEventListener('change', () => {
      style.facade = normalizeFacadeKey(facade.value);
      functionFacadeState[key] = style.facade;
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofShape = makeSelect(ROOF_SHAPE_OPTIONS, style.roofShape);
    roofShape.addEventListener('change', () => {
      style.roofShape = roofShapeValue(roofShape.value, 'Pyramid');
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofTexture = makeSelect(roofOptions, style.roofTexture);
    roofTexture.addEventListener('change', () => {
      style.roofTexture = presetValue(roofTexture.value, textureSets.roof, 'RoofA');
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    const roofColor = document.createElement('input');
    roofColor.type = 'color';
    roofColor.value = style.roofColor;
    roofColor.title = t('lblRoofColor') || 'Roof color';
    roofColor.addEventListener('input', () => {
      style.roofColor = roofColor.value;
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const roofHeight = makeRange(0, 8, 0.1, style.roofHeight);
    roofHeight.input.addEventListener('input', () => {
      style.roofHeight = Number(roofHeight.input.value);
      roofHeight.out.textContent = style.roofHeight.toFixed(1);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const facadeScale = makeRange(1, 8, 0.05, style.facadeScale);
    facadeScale.input.addEventListener('input', () => {
      style.facadeScale = Number(facadeScale.input.value);
      facadeScale.out.textContent = style.facadeScale.toFixed(2);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const floorHeight = makeRange(2.4, 6, 0.05, style.floorHeight);
    floorHeight.input.addEventListener('input', () => {
      style.floorHeight = Number(floorHeight.input.value);
      floorHeight.out.textContent = style.floorHeight.toFixed(2);
      saveFunctionBuildingStyles();
      requestFunctionStyleRebuild();
    });

    const setbackEnabled = document.createElement('input');
    setbackEnabled.type = 'checkbox';
    setbackEnabled.checked = style.setbackEnabled !== false;
    setbackEnabled.title = 'Use procedural setback for this function';
    setbackEnabled.addEventListener('change', () => {
      style.setbackEnabled = setbackEnabled.checked;
      saveFunctionBuildingStyles();
      rebuildScene();
    });

    grid.append(
      makeField('Facade', facade),
      makeField('Roof shape', roofShape),
      makeField('Roof texture', roofTexture),
      makeField(t('lblRoofColor') || 'Roof color', roofColor),
      makeField('Roof height', roofHeight.wrap),
      makeField('Facade scale', facadeScale.wrap),
      makeField('Floor height', floorHeight.wrap),
      makeField('Setback', setbackEnabled)
    );
    card.append(header, grid);
    host.appendChild(card);
  });
}

function applyDockSetting(key, value, inputType) {
  if (!(key in settings)) return;
  if (inputType === 'checkbox') {
    settings[key] = !!value;
  } else if (typeof settings[key] === 'number') {
    settings[key] = parseFloat(value);
  } else {
    settings[key] = value;
  }
  if (inputType === 'checkbox' && value === false) {
    if (key === 'showBuildings') { clearGroup(buildingGroup); clearGroup(zoningGroup); }
    else if (key === 'showIslands') clearGroup(islandGroup);
    else if (key === 'showParcels') clearGroup(parcelGroup);
    else if (key === 'showHardscape') clearGroup(hardscapeGroup);
    else if (key === 'showTrees') clearGroup(treeGroup);
    else if (key === 'showMosques') clearGroup(mosqueGroup);
    else if (key === 'showTumulus') clearGroup(tumulusGroup);
    else if (key === 'showFurniture') clearGroup(furnitureGroup);
    else if (key === 'showBikeLanes') { clearGroup(bikeLaneGroup); clearGroup(bikeGroup); state.bikeLaneCurves = []; state.bikes = []; }
    else if (key === 'showBikes') { clearGroup(bikeGroup); state.bikes = []; }
    else if (key === 'showRoads') clearGroup(roadGroup);
    else if (key === 'showSidewalks') clearGroup(sidewalkGroup);
    else if (key === 'showPedestrianPaths') { clearGroup(pedestrianPathGroup); state.pedestrianPathCurves = []; }
    else if (key === 'showCrosswalks') clearGroup(crosswalkGroup);
    else if (key === 'showCars') clearGroup(carGroup);
    else if (key === 'showPedestrians') clearGroup(pedestrianGroup);
    else if (key === 'showFences') clearGroup(fenceGroup);
    else if (key === 'showWaterlines') clearGroup(waterlineGroup);
    else if (key === 'showZoningEnvelopes') clearGroup(zoningGroup);
  }
  if (key === 'assetTheme') {
    applyThemeDefaultsToSettings(true);
    state.terrainTexture = null;
    state.baseMapTexture = null;
    updateDockControls();
  }
  if (key === 'showTerrainTexture' || key === 'terrainTextureBrightness' || key === 'terrainTextureContrast' || key === 'terrainAnalysisMode') {
    state.terrainTexture = null;
  }
  if (key === 'showXyzTiles' || key === 'xyzTileUrl') {
    state.baseMapTexture = null;
  }
  savePersistedSettings();
  if (key === 'timeOfDay' || key === 'weather' || key === 'fogDensity' || key === 'enableBloom' || key === 'enableSSAO') {
    if (key === 'weather') updateWeather();
    checkTimeChange();
  } else if (key === 'autoTime' || key === 'autoTimeSpeed' || key === 'trafficSpeed' || key === 'bikeSpeed') {
    updateDockControls();
  } else if (key === 'viewshedRadius') {
    // Used by the next viewshed run.
  } else if (['zoningCoverage', 'zoningFar', 'zoningMaxHeight', 'zoningSetback', 'highlightViolations', 'zoningBCoverage', 'zoningBFar', 'zoningBMaxHeight', 'zoningBSetback'].includes(key)) {
    // Rules only: redraw the envelopes and the scenario, not the scene.
    buildZoningEnvelopesLayer(state.layerDataCache?.buildingsFc);
    buildScenario();
    requestRender();
  } else {
    rebuildScene();
  }
}

let dockUiInitialized = false;

export function initDockUi() {
  if (dockUiInitialized) return;
  dockUiInitialized = true;
  populateDockSelects();
  updateDockControls();
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-dock-target]');
    if (!btn) return;
    const target = document.getElementById(btn.dataset.dockTarget);
    if (!target) return;
    event.preventDefault();
    document.querySelectorAll('.dock-panel').forEach((dock) => {
      if (dock !== target) dock.classList.add('hidden');
    });
    target.classList.toggle('hidden');
    
    // Refresh Model Studio lists if opened
    if (target.id === 'model-studio-dock' && !target.classList.contains('hidden')) {
      renderUploadedModelsList();
      renderTreePoolList();
      renderModelTransformControls();
      renderMosqueCustomizationsList();
      renderTumulusCustomizationsList();
    }
  });
  document.getElementById('advanced-toggle')?.addEventListener('click', () => {
    if (!globalGui?.domElement) return;
    globalGui.domElement.style.display = globalGui.domElement.style.display === 'none' ? '' : 'none';
  });
  document.querySelectorAll('.dock-close').forEach((btn) => {
    btn.addEventListener('click', () => document.getElementById(btn.dataset.close)?.classList.add('hidden'));
  });
  document.querySelectorAll('.dock-panel [data-setting]').forEach((el) => {
    const handler = () => applyDockSetting(el.dataset.setting, el.type === 'checkbox' ? el.checked : el.value, el.type);
    el.addEventListener(el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input', handler);
  });

  // Shadow study presets — jump dayOfYear to a solstice/equinox and clamp time to noon.
  const SHADOW_PRESETS = { winter: 355, spring: 79, summer: 172, autumn: 265 };
  document.querySelectorAll('[data-shadow-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.shadowPreset;
      const day = SHADOW_PRESETS[key];
      if (!day) return;
      settings.dayOfYear = day;
      settings.timeOfDay = 12;
      updateTimeOfDay();
      reflectDockSettings();
      document.querySelectorAll('[data-shadow-preset]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
  document.getElementById('shadow-play-day')?.addEventListener('click', () => {
    settings.autoTime = true;
    if (settings.timeOfDay < 6 || settings.timeOfDay > 18) settings.timeOfDay = 6;
    reflectDockSettings();
  });
  document.getElementById('shadow-stop')?.addEventListener('click', () => {
    settings.autoTime = false;
    reflectDockSettings();
  });
  document.getElementById('shadow-compute')?.addEventListener('click', () => computeExposure('sun'));
  document.getElementById('svf-compute')?.addEventListener('click', () => computeExposure('svf'));
  document.getElementById('viewshed-pick')?.addEventListener('click', () => {
    state.viewshedPicking = true;
    document.body.classList.add('picking-point');
    setStatus('Viewshed: click the observer position in the scene (Esc cancels).');
  });
  document.getElementById('shadow-clear')?.addEventListener('click', () => {
    removeShadowHeatmap();
    setStatus('Analysis cleared.');
    requestRender();
  });

  // Quick time-of-day presets
  document.querySelectorAll('[data-time-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = parseFloat(btn.dataset.timePreset);
      if (!Number.isFinite(t)) return;
      settings.timeOfDay = t;
      settings.autoTime = false;
      updateTimeOfDay();
      reflectDockSettings();
    });
  });

  // Theme override (auto/light/dark) — stored in localStorage
  const themeSelect = document.getElementById('theme-mode-select');
  if (themeSelect) {
    const applyTheme = (value) => {
      const root = document.documentElement;
      root.removeAttribute('data-theme');
      if (value === 'light' || value === 'dark') {
        root.setAttribute('data-theme', value);
      }
      try { if (!isPortableMode) localStorage.setItem('planx_3d_city_theme', value); } catch (_) {}
    };
    let saved = 'auto';
    try { saved = (isPortableMode ? 'auto' : localStorage.getItem('planx_3d_city_theme')) || 'auto'; } catch (_) {}
    themeSelect.value = ['auto', 'light', 'dark'].includes(saved) ? saved : 'auto';
    applyTheme(themeSelect.value);
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
  }

  // Camera bookmarks
  loadCameraBookmarks();
  renderCameraBookmarks();
  document.getElementById('bookmark-save')?.addEventListener('click', () => {
    const name = window.prompt(t('bookmarkPrompt'), `View ${cameraBookmarks.length + 1}`);
    if (name === null) return;
    addCameraBookmark(name);
  });

  // Model Studio Listeners
  initModelStudioListeners();
}
