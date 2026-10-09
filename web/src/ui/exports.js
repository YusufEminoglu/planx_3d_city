// Exports from the viewer: 3D Tiles 1.1 (tiles_export.js) and CityJSON 2.0
// (cityjson.js) downloads, and screenshots up to 8K.
import { captureSize, captureTiled } from '../capture.js';
import { LOCAL_X_SIGN, getPolygonRings } from '../geo.js';
import { parseNumberProp } from '../props.js';
import { state } from '../core/state.js';
import {
  camera, renderer, MAX_PIXEL_RATIO, world, carGroup, bikeGroup, pedestrianGroup, terrainSideGroup,
  windPlumeGroup, roiBoundaryGroup, zoningGroup, scenarioGroup, scenarioGroupB
} from '../core/scene.js';
import { functionColorState, buildingFunctionValue, ensureFunctionBuildingStyle } from '../core/settings.js';
import { requestRender, renderCleanFrame, setDynamicPixelRatio } from '../core/render.js';
import { setStatus } from './status.js';
import { buildingLevels } from '../core/data.js';
import {
  estimateBuildingFeatureMetrics, buildingGroundOffset, buildingBaseYForOuterRing, buildingHeightFromProps
} from '../layers/buildings.js';
import { globalGui } from './gui.js';
import { uiContainer } from './recording.js';

// Screenshot at the size picked next to the button: the screen itself, or a
// larger image rendered in screen-sized tiles (2x, 4K, 8K).
export async function takeScreenshot() {
  const preset = document.getElementById('screenshot-size')?.value || 'screen';
  uiContainer.style.visibility = 'hidden';
  if (globalGui) globalGui.domElement.style.visibility = 'hidden';
  setDynamicPixelRatio(MAX_PIXEL_RATIO);
  try {
    let blob;
    if (preset === 'screen') {
      renderCleanFrame();
      blob = await new Promise((resolve) => renderer.domElement.toBlob(resolve, 'image/png'));
    } else {
      const { width, height } = captureSize(preset, camera.aspect, renderer.domElement.width);
      setStatus(`Rendering ${width} x ${height} screenshot...`);
      blob = await captureTiled({
        renderer, camera, width, height,
        render: renderCleanFrame,
        onProgress: (f) => setStatus(`Rendering ${width} x ${height} screenshot... ${Math.round(f * 100)}%`)
      });
      setStatus(`Screenshot ${width} x ${height} saved.`);
    }
    if (blob) {
      const link = document.createElement('a');
      link.download = `planx_3d_city_${Date.now()}.png`;
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    }
  } catch (err) {
    setStatus(`Screenshot failed: ${err?.message || err}`, true);
  } finally {
    uiContainer.style.visibility = '';
    if (globalGui) globalGui.domElement.style.visibility = '';
    requestRender();
  }
}

// --- 3D Tiles export of the visible scene ---
async function exportTiles3DZip() {
  const georeference = state.projectManifest?.georeference;
  if (!georeference?.controlPoints) {
    setStatus('3D Tiles needs a georeferenced export: publish again from QGIS (projected CRS).', true);
    return;
  }
  const includeTerrain = !!document.getElementById('tiles-include-terrain')?.checked;
  const heightOffset = Number(document.getElementById('tiles-height-offset')?.value) || 0;
  // Static scene only: no traffic, people, overlays or analysis drapes.
  const skip = new Set([carGroup, bikeGroup, pedestrianGroup, windPlumeGroup, roiBoundaryGroup, zoningGroup, scenarioGroup, scenarioGroupB, state.shadowHeatmapMesh]);
  if (!includeTerrain) {
    skip.add(state.terrainMesh);
    skip.add(terrainSideGroup);
  }
  const roots = world.children.filter((c) => c && !skip.has(c));
  try {
    setStatus('3D Tiles: preparing...');
    const { exportTiles3D } = await import('../tiles_export.js');
    const { blob, tiles, lon, lat } = await exportTiles3D({
      roots, georeference, centre: [state.centerX, state.centerY], xSign: LOCAL_X_SIGN, heightOffset,
      onProgress: (f) => setStatus(`3D Tiles: ${Math.round(f * 100)}%`)
    });
    const link = document.createElement('a');
    link.download = `planx_3d_city_3dtiles_${Date.now()}.zip`;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 20000);
    setStatus(`3D Tiles exported: ${tiles} tiles, ${(blob.size / 1048576).toFixed(1)} MB, centre ${lat.toFixed(5)}, ${lon.toFixed(5)}.`);
  } catch (err) {
    console.warn('3D Tiles export failed', err);
    setStatus(`3D Tiles export failed: ${err?.message || err}`, true);
  }
}
document.getElementById('tiles-export')?.addEventListener('click', exportTiles3DZip);

// --- CityJSON (LoD1) export of the buildings ---
async function exportCityJson() {
  const fc = state.layerDataCache?.buildingsFc;
  if (!fc?.features?.length) {
    setStatus('CityJSON: no buildings in this scene.', true);
    return;
  }
  const buildings = [];
  fc.features.forEach((f, i) => {
    const props = f.properties || {};
    const polygons = getPolygonRings(f.geometry).filter((p) => p?.[0]?.length >= 3);
    if (!polygons.length) return;
    const levels = buildingLevels(props);
    const fn = String(buildingFunctionValue(props));
    const fnStyle = ensureFunctionBuildingStyle(fn, Math.max(0, Object.keys(functionColorState).indexOf(fn)));
    const floorHeight = parseNumberProp(props, ['planx_floor_height', 'floor_height'], fnStyle.floorHeight);
    const height = buildingHeightFromProps(props, levels, floorHeight);
    const metrics = estimateBuildingFeatureMetrics(f);
    const id = props.id ?? props.fid ?? props.osm_id ?? `building_${i + 1}`;
    buildings.push({
      id: buildings.some((b) => b.id === String(id)) ? `${id}_${i + 1}` : String(id),
      polygons,
      base: buildingBaseYForOuterRing(polygons[0][0]) - buildingGroundOffset(),
      height,
      attributes: {
        ...props,
        function: fn,
        storeysAboveGround: levels,
        measuredHeight: Math.round(height * 100) / 100,
        planx_floor_area: Math.round(metrics.floorArea || 0),
        planx_population: Math.round(metrics.population || 0)
      }
    });
  });
  const { buildCityJson } = await import('../cityjson.js');
  const crs = state.projectManifest?.georeference?.crs || state.projectManifest?.summary?.crs?.[0] || '';
  const title = state.projectManifest?.project?.title || 'PlanX 3D City';
  const cj = buildCityJson(buildings, { crs, title });
  const blob = new Blob([JSON.stringify(cj)], { type: 'application/city+json' });
  const link = document.createElement('a');
  link.download = `planx_3d_city_${Date.now()}.city.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 20000);
  setStatus(`CityJSON exported: ${Object.keys(cj.CityObjects).length} buildings (LoD1), ${(blob.size / 1048576).toFixed(1)} MB${crs ? `, ${crs}` : ', CRS unknown'}.`);
}
document.getElementById('cityjson-export')?.addEventListener('click', () => {
  exportCityJson().catch((err) => setStatus(`CityJSON export failed: ${err?.message || err}`, true));
});
