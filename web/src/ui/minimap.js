// Minimap (block, road and building outlines with the camera cone) and the
// scale bar.
import * as THREE from 'three';
import { getPolygonRings } from '../geo.js';
import { state } from '../core/state.js';
import { camera, controls } from '../core/scene.js';
import { functionColorState, buildingFunctionValue, blockCategoryValue } from '../core/settings.js';
import { metersToLocal } from '../core/data.js';
import { lineSetsFromGeometry } from '../layers/mobility.js';

// --- Minimap ---
let _mmBg = null;           // pre-rendered static canvas
let _mmScale = 1, _mmOx = 0, _mmOy = 0;
const _mmW = 160, _mmH = 160;

function _mmPx(lx, lz) {
  const w = state.bounds.maxX - state.bounds.minX;
  const h = state.bounds.maxY - state.bounds.minY;
  return [_mmOx + (lx + w * 0.5) * _mmScale, _mmOy + (h * 0.5 - lz) * _mmScale];
}

export function rebuildMinimapBg() {
  if (!state.bounds || !state.layerDataCache) return;
  const w = state.bounds.maxX - state.bounds.minX;
  const h = state.bounds.maxY - state.bounds.minY;
  _mmScale = Math.min(_mmW, _mmH) * 0.86 / Math.max(w, h);
  _mmOx = (_mmW - w * _mmScale) / 2;
  _mmOy = (_mmH - h * _mmScale) / 2;

  const bg = document.createElement('canvas');
  bg.width = _mmW; bg.height = _mmH;
  const ctx = bg.getContext('2d');

  ctx.fillStyle = '#0d1425';
  ctx.fillRect(0, 0, _mmW, _mmH);

  // ROI outline
  if (state.layerDataCache.roi?.features?.length) {
    ctx.strokeStyle = 'rgba(239,68,68,0.75)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    for (const f of state.layerDataCache.roi.features) {
      const rings = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of rings) {
        for (const ring of poly) {
          ctx.beginPath();
          ring.forEach(([cx, cy], i) => {
            const [lx, lz] = metersToLocal(cx, cy);
            const [mx, my] = _mmPx(lx, lz);
            i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
          });
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
  }

  // Island blocks
  for (const f of state.layerDataCache.blocksFc?.features || []) {
    for (const poly of getPolygonRings(f.geometry)) {
      const ring = poly[0]; if (!ring) continue;
      const fn = String(blockCategoryValue(f.properties || {}) ?? '').toUpperCase();
      ctx.fillStyle = fn.includes('PARK') || fn.includes('GREEN') ? 'rgba(30,90,45,0.65)' : 'rgba(155,155,150,0.45)';
      ctx.beginPath();
      ring.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.closePath(); ctx.fill();
    }
  }

  // Roads
  ctx.strokeStyle = '#222a38'; ctx.lineWidth = 1.2;
  for (const f of state.layerDataCache.roadsFc?.features || []) {
    if (f.geometry?.type !== 'LineString') continue;
    ctx.beginPath();
    f.geometry.coordinates.forEach(([cx, cy], i) => {
      const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
      i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
    });
    ctx.stroke();
  }

  ctx.strokeStyle = '#b7ad93'; ctx.lineWidth = 0.9;
  for (const f of state.layerDataCache.pedestrianPaths?.features || []) {
    for (const line of lineSetsFromGeometry(f.geometry)) {
      ctx.beginPath();
      line.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.stroke();
    }
  }

  // Buildings (colored by function)
  for (const f of state.layerDataCache.buildingsFc?.features || []) {
    const fn = String(buildingFunctionValue(f.properties || {}));
    ctx.fillStyle = functionColorState[fn] || '#94a3b8';
    for (const poly of getPolygonRings(f.geometry)) {
      const ring = poly[0]; if (!ring) continue;
      ctx.beginPath();
      ring.forEach(([cx, cy], i) => {
        const [lx, lz] = metersToLocal(cx, cy); const [mx, my] = _mmPx(lx, lz);
        i === 0 ? ctx.moveTo(mx, my) : ctx.lineTo(mx, my);
      });
      ctx.closePath(); ctx.fill();
    }
  }

  // Trees
  ctx.fillStyle = '#4ade80';
  for (const f of state.layerDataCache.treesFc?.features || []) {
    if (f.geometry?.type !== 'Point') continue;
    const [lx, lz] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
    const [mx, my] = _mmPx(lx, lz);
    ctx.beginPath(); ctx.arc(mx, my, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  _mmBg = bg;
}

export function updateMinimapCamera() {
  const canvas = document.getElementById('minimap-canvas');
  if (!canvas || !_mmBg) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, _mmW, _mmH);
  ctx.drawImage(_mmBg, 0, 0);

  const [cmx, cmy] = _mmPx(camera.position.x, camera.position.z);
  if (cmx < -10 || cmy < -10 || cmx > _mmW + 10 || cmy > _mmH + 10) return;

  // Camera direction arrow
  const cDir = new THREE.Vector3();
  camera.getWorldDirection(cDir);
  const arrowLen = 10;
  const ax = cDir.x, ay = -cDir.z; // canvas Y: south = positive
  const norm = Math.sqrt(ax * ax + ay * ay);

  ctx.save();
  ctx.translate(cmx, cmy);
  if (norm > 0.01) {
    // FOV indicator
    const ang = Math.atan2(ay, ax);
    ctx.fillStyle = 'rgba(56,189,248,0.10)';
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 16, ang - 0.55, ang + 0.55);
    ctx.closePath(); ctx.fill();
    // Arrow
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.lineTo(ax / norm * arrowLen, ay / norm * arrowLen);
    ctx.stroke();
  }
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function updateScaleBar() {
  const bar = document.getElementById('scale-bar');
  if (!bar || state.isWalkMode) { if (bar) bar.style.display = 'none'; return; }
  bar.style.display = 'flex';
  const dist = camera.position.distanceTo(controls.target);
  let m = 500;
  if (dist < 600) m = 200;
  if (dist < 250) m = 100;
  if (dist < 120) m = 50;
  if (dist < 60)  m = 20;
  if (dist < 25)  m = 10;

  const tgt = controls.target.clone();
  const right = new THREE.Vector3();
  camera.getWorldDirection(right);
  right.cross(new THREE.Vector3(0, 1, 0)).normalize();
  const p2 = tgt.clone().addScaledVector(right, m);
  const v1 = tgt.project(camera);
  const v2 = p2.project(camera);
  const px = Math.abs(v2.x - v1.x) * window.innerWidth / 2;

  const line = document.getElementById('scale-line');
  const label = document.getElementById('scale-label');
  if (line) line.style.width = Math.max(20, px) + 'px';
  if (label) label.textContent = m >= 1000 ? `${m / 1000}km` : `${m}m`;
}
