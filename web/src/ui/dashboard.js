// The statistics dashboard: counts, floor area, population and building
// function mix of the loaded data.
import { t } from '../ui_text.js';
import { state } from '../core/state.js';
import { buildingFunctionValue, settings, getFunctionIcon } from '../core/settings.js';
import { buildingLevels, EMPTY_GEOJSON, isRasterTextureMode } from '../core/data.js';
import { estimateBuildingFeatureMetrics } from '../layers/buildings.js';

export function updateDashboard(data) {
  if (!data) return;
  const blocksFc = data.blocksFc || EMPTY_GEOJSON;
  const buildingsFc = data.buildingsFc || EMPTY_GEOJSON;
  const roadsFc = data.roadsFc || EMPTY_GEOJSON;
  const treesFc = data.treesFc || EMPTY_GEOJSON;
  const parcelsFc = data.parcelsFc || EMPTY_GEOJSON;
  const hardscape = data.hardscape || EMPTY_GEOJSON;
  const sidewalks = data.sidewalks || EMPTY_GEOJSON;
  const pedestrianPaths = data.pedestrianPaths || EMPTY_GEOJSON;
  const bikeLanes = data.bikeLanes || EMPTY_GEOJSON;
  const furniture = data.furniture || {};

  const bldCount = buildingsFc.features.length;
  const blockCount = blocksFc.features.length;
  const parcelCount = parcelsFc?.features?.length || 0;
  let totalFloors = 0;
  let totalPopulation = 0;
  let totalDwellings = 0;
  let totalVehicles = 0;
  const funcMap = {};
  buildingsFc.features.forEach((f) => {
    const fn = buildingFunctionValue(f.properties || {});
    funcMap[fn] = (funcMap[fn] || 0) + 1;
    totalFloors += buildingLevels(f.properties);
    const metrics = estimateBuildingFeatureMetrics(f);
    totalPopulation += metrics.population || 0;
    totalDwellings += metrics.dwellings || 0;
    totalVehicles += metrics.vehicles || 0;
  });
  const avgFlr = bldCount > 0 ? (totalFloors / bldCount).toFixed(1) : '-';

  const setMetric = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setMetric('metric-buildings', bldCount);
  setMetric('metric-blocks', isRasterTextureMode() && !blockCount ? 'texture' : blockCount);
  setMetric('metric-parcels', isRasterTextureMode() && !parcelCount ? 'texture' : (parcelCount || '-'));
  setMetric('metric-floors', avgFlr);
  setMetric('metric-population', Math.round(totalPopulation));
  setMetric('metric-dwellings', Math.round(totalDwellings));
  setMetric('metric-vehicles', Math.round(totalVehicles));

  const meta = document.getElementById('project-meta');
  if (meta) {
    if (state.projectManifest) {
      const title = state.projectManifest.project?.title || 'PlanX 3D City Project';
      const exportedAt = state.projectManifest.exportedAt ? new Date(state.projectManifest.exportedAt).toLocaleString() : '-';
      const crs = state.projectManifest.summary?.crs?.length ? state.projectManifest.summary.crs.join(', ') : t('crsUnknown');
      const modeLabel = isRasterTextureMode() ? 'Raster Plan Texture' : 'Vector Plan';
      const accessField = state.projectManifest.roadAccess?.field ? `<br>Traffic filter: ${state.projectManifest.roadAccess.field}` : '';
      const themeLabel = state.projectManifest.assetTheme || settings.assetTheme || 'Modern Urban';
      meta.innerHTML = `<strong>${title}</strong><br>Mode: ${modeLabel}<br>Asset theme: ${themeLabel}<br>Export: ${exportedAt}<br>CRS: ${crs}${accessField}`;
    } else {
      meta.textContent = t('manifestMissing');
    }
  }

  const health = document.getElementById('data-health');
  if (health) {
    const manifestEmpty = new Set(state.projectManifest?.summary?.emptyOptionalInputs || []);
    const optional = [
      ['blocks', 'Blocks', blocksFc.features.length],
      ['parcels', 'Parcels', parcelCount],
      ['roads', 'Roads', roadsFc.features.length],
      ['trees', 'Trees', treesFc.features.length],
      ['hardscape', 'Hardscape', hardscape?.features?.length || 0],
      ['sidewalks', 'Sidewalks', sidewalks?.features?.length || 0],
      ['pedestrian_paths', 'Paths', pedestrianPaths?.features?.length || 0],
      ['bike_lanes', 'Bike lanes', bikeLanes?.features?.length || 0],
      ['lights', 'Lights', furniture.lights?.features?.length || 0],
      ['benches', 'Benches', furniture.benches?.features?.length || 0],
      ['busstops', 'Stops', furniture.busstops?.features?.length || 0],
    ];
    health.innerHTML = optional.map(([key, name, count]) =>
      `<span class="health-chip ${count ? 'ok' : 'empty'}">${name}: ${count || (manifestEmpty.has(key) ? t('emptyExport') : t('notAvailable'))}</span>`
    ).join('');
  }

  const topFuncs = Object.entries(funcMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const statDiv = document.getElementById('stats-content');
  if (statDiv) {
    let html = `<div class="stat-row"><span>${t('statBld')}</span><span class="stat-val">${bldCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statBlock')}</span><span class="stat-val">${blockCount}</span></div>`;
    html += `<div class="stat-row"><span>${t('statParcel')}</span><span class="stat-val">${parcelCount || '-'}</span></div>`;
    html += `<div class="stat-row"><span>${t('statFlr')}</span><span class="stat-val">${avgFlr}</span></div>`;
    topFuncs.forEach(([k, v]) => {
      const icon = getFunctionIcon(k);
      html += `<div class="stat-row stat-func"><span>${icon} ${String(k).slice(0, 20)}</span><span class="stat-val">${v}</span></div>`;
    });
    statDiv.innerHTML = html;
  }
}
