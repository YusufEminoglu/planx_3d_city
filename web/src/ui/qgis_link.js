// QGIS <-> viewer selection sync (only with the PlanX local server):
// buildings selected in QGIS are highlighted and flown to; a building
// clicked here is reported back so QGIS selects it.
import * as THREE from 'three';
import { setSelectedBuildingId } from '../building_batch.js';
import { pointInRings } from '../zoning_scenario.js';
import { state } from '../core/state.js';
import { isPortableMode, camera } from '../core/scene.js';
import { requestRender } from '../core/render.js';
import { setStatus } from './status.js';
import { metersToLocal } from '../core/data.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

function buildingIdAtProjected(x, y) {
  for (let rid = 0; rid < state.buildingFootprints.length; rid++) {
    const f = state.buildingFootprints[rid];
    if (!f || x < f.minX || x > f.maxX || y < f.minY || y > f.maxY) continue;
    if (pointInRings(x, y, f.rings)) return rid;
  }
  return -1;
}

const qgisSync = { seq: -1, enabled: !isPortableMode, failures: 0 };
async function pollQgisSelection() {
  if (!qgisSync.enabled || document.hidden || !state.buildingFootprints.length) return;
  try {
    const res = await fetch('/api/selection', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const sel = await res.json();
    qgisSync.failures = 0;
    if (sel.seq === qgisSync.seq) return;
    const first = qgisSync.seq === -1;
    qgisSync.seq = sel.seq;
    const ids = (sel.points || []).map(([x, y]) => buildingIdAtProjected(x, y)).filter((id) => id >= 0);
    setSelectedBuildingId(ids.length ? ids[0] : -1);
    if (ids.length && !first) {
      const f = state.buildingFootprints[ids[0]];
      const [lx, lz] = metersToLocal(f.cx, f.cy);
      const pt = new THREE.Vector3(lx, terrainLocalYAt(lx, lz), lz);
      const dir = camera.position.clone().sub(pt).setY(0).normalize();
      state.flyOrigin = camera.position.clone();
      state.flyTarget = pt.clone().addScaledVector(dir, 90).add(new THREE.Vector3(0, 60, 0));
      state.flyControlsTarget = pt;
      state.flyT = 0;
      setStatus(`QGIS selection: ${ids.length} building${ids.length === 1 ? '' : 's'} in the scene${ids.length > 1 ? ' (first one highlighted)' : ''}.`);
    }
    requestRender();
  } catch {
    // Plain static hosting has no selection endpoint: stop after a few tries.
    if (++qgisSync.failures >= 3) qgisSync.enabled = false;
  }
}
setInterval(pollQgisSelection, 1000);

// A point inside a footprint: its centre when that is inside, otherwise
// the centre of its largest triangle (L, U and C shapes).
function footprintInsidePoint(f) {
  if (pointInRings(f.cx, f.cy, f.rings)) return [f.cx, f.cy];
  const outer = (f.rings[0] || []).map(([x, y]) => new THREE.Vector2(x - f.cx, y - f.cy));
  let best = null;
  let bestArea = -1;
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(outer, [])) {
    const area = Math.abs(THREE.ShapeUtils.area([outer[a], outer[b], outer[c]]));
    if (area > bestArea) {
      bestArea = area;
      best = [(outer[a].x + outer[b].x + outer[c].x) / 3 + f.cx, (outer[a].y + outer[b].y + outer[c].y) / 3 + f.cy];
    }
  }
  return best || [f.cx, f.cy];
}

export function reportViewerPick(rid) {
  const f = state.buildingFootprints[rid];
  if (!qgisSync.enabled || !f) return;
  const [x, y] = footprintInsidePoint(f);
  fetch('/api/viewer-pick', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y })
  }).catch(() => {});
}
