// Dock controls mirror the settings: select options and current values.
import { ROOF_SHAPE_OPTIONS, textureSets, assetThemePresets, TREE_VARIANT_CATALOG } from '../catalog.js';
import { uniqueAssetVariants, settings, blockCategoryStylesActive } from '../core/settings.js';

export function updateBlockStyleModeUi() {
  const categoryMode = blockCategoryStylesActive();
  document.querySelectorAll('[data-setting="islandColor"], [data-setting="islandTexture"]').forEach((control) => {
    control.disabled = categoryMode;
    control.closest('label')?.classList.toggle('control-disabled', categoryMode);
    control.title = categoryMode ? 'Block Categories active' : '';
  });
}

export function populateDockSelects() {
  const selectOptions = {
    islandTexture: Object.keys(textureSets.island),
    roofShape: ROOF_SHAPE_OPTIONS,
    roofTexture: Object.keys(textureSets.roof),
    pavementStyle: Object.keys(textureSets.pavement),
    terrainAnalysisMode: ['Texture', 'Elevation tint', 'Slope tint'],
    buildingMode: ['Footprint only', 'Extruded', 'Extruded + roof'],
    hardscapeStyle: Object.keys(textureSets.hardscape),
    roadStyle: Object.keys(textureSets.road),
    roadColorMode: ['Default', 'Amenity distance', 'Access / traffic'],
    assetTheme: Object.keys(assetThemePresets),
    treeRenderMode: ['Stylized', 'Realistic'],
    treeVariantCount: Array.from({ length: TREE_VARIANT_CATALOG.length }, (_item, idx) => String(idx + 1)),
    lightStyle: uniqueAssetVariants('lights', ['Modern Arc', 'Classic Post', 'Dual Head', 'Slim Post']),
    benchStyle: uniqueAssetVariants('benches', ['Wood Plank', 'Concrete Slab', 'Curved Metal']),
    binStyle: uniqueAssetVariants('bins', ['Square Box', 'Cylinder', 'Dual Recycle']),
    stopStyle: uniqueAssetVariants('busstops', ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin']),
    weather: ['Clear', 'Rain', 'Snow']
  };
  document.querySelectorAll('.dock-panel select[data-setting]').forEach((select) => {
    const key = select.dataset.setting;
    if (!selectOptions[key]) return;
    select.innerHTML = selectOptions[key].map((value) => `<option value="${value}">${value}</option>`).join('');
  });
}

export function updateDockControls() {
  document.querySelectorAll('.dock-panel [data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (!(key in settings)) return;
    if (el.type === 'checkbox') el.checked = !!settings[key];
    else el.value = settings[key];
  });
  updateBlockStyleModeUi();
}
export const reflectDockSettings = updateDockControls;
