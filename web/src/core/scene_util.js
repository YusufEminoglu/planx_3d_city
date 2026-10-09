// Small helpers shared by the layer builders: clearing groups, local shapes
// from projected polygons, geometry merging and subdivision, and the scene
// build token check.
import * as THREE from 'three';
import { insetShapeFromRings, shapeFromRings } from '../building_geometry.js';
import { state } from './state.js';
import { metersToLocal } from './data.js';
import { setStatus } from '../ui/status.js';

export function clearGroup(g) {
  while (g.children.length) {
    const c = g.children.pop();
    if (c.geometry) c.geometry.dispose();
    if (c.material) {
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach((m) => m.dispose());
    }
  }
}

// Projected GeoJSON rings -> local [x, z] rings (invalid points kept as-is
// for the geometry helpers to skip).
export function toLocalRings(poly) {
  return poly.map((ring) => (ring || []).map((c) => (c && c.length >= 2 ? metersToLocal(c[0], c[1]) : c)));
}

export function shapeFromLocalPolygon(poly) {
  if (!poly?.[0] || poly[0].length < 3) return null;
  return shapeFromRings(toLocalRings(poly));
}

export function shapeFromInsetPolygon(poly, distance) {
  if (!poly || !poly.length) return null;
  return insetShapeFromRings(toLocalRings(poly), distance);
}

export function isSceneBuildStale(token) {
  return token !== state.sceneBuildToken;
}

/* Collapse coincident vertices of a non-indexed BufferGeometry into an indexed
 * one with shared vertices, so computeVertexNormals can produce smooth shading
 * across shared edges. Tolerance in scene units. */
export function indexAndMergeNonIndexed(geometry, tolerance = 0.01) {
  if (geometry.index) return geometry;
  const posAttr = geometry.attributes.position;
  const uvAttr = geometry.attributes.uv;
  if (!posAttr) return geometry;
  const positions = posAttr.array;
  const uvs = uvAttr ? uvAttr.array : null;
  const count = positions.length / 3;
  const inv = 1 / Math.max(tolerance, 1e-6);
  const uniquePositions = [];
  const uniqueUvs = uvs ? [] : null;
  const indices = new Array(count);
  const map = new Map();
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x * inv)}|${Math.round(y * inv)}|${Math.round(z * inv)}`;
    let idx = map.get(key);
    if (idx === undefined) {
      idx = uniquePositions.length / 3;
      uniquePositions.push(x, y, z);
      if (uvs) uniqueUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
      map.set(key, idx);
    }
    indices[i] = idx;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(uniquePositions, 3));
  if (uniqueUvs) out.setAttribute('uv', new THREE.Float32BufferAttribute(uniqueUvs, 2));
  out.setIndex(indices);
  return out;
}

export function subdivideShapeGeometry(geometry, maxEdgeLen) {
  // Conforming 4-1 (Loop-style) subdivision: every triangle is split into 4
  // children at the midpoints of ALL three edges. Because two neighbouring
  // triangles share an edge, both compute the exact same midpoint, so the
  // resulting mesh is watertight (no T-vertices, no gaps). Earlier code
  // bisected only the longest edge per triangle, which produced T-vertex
  // cracks visible after DEM drape.
  let geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const maxIterations = 6;
  for (let iter = 0; iter < maxIterations; iter++) {
    const positions = geo.attributes.position.array;
    const uvs = geo.attributes.uv ? geo.attributes.uv.array : null;
    const triCount = positions.length / 9;

    // Decide whether further subdivision is needed (longest edge > target).
    let maxEdge = 0;
    for (let i = 0; i < triCount; i++) {
      const ax = positions[i * 9],     az = positions[i * 9 + 2];
      const bx = positions[i * 9 + 3], bz = positions[i * 9 + 5];
      const cx = positions[i * 9 + 6], cz = positions[i * 9 + 8];
      const d1 = Math.hypot(ax - bx, az - bz);
      const d2 = Math.hypot(bx - cx, bz - cz);
      const d3 = Math.hypot(cx - ax, cz - az);
      if (d1 > maxEdge) maxEdge = d1;
      if (d2 > maxEdge) maxEdge = d2;
      if (d3 > maxEdge) maxEdge = d3;
    }
    if (maxEdge <= maxEdgeLen) break;

    const newPos = new Array(triCount * 4 * 9);
    const newUv = uvs ? new Array(triCount * 4 * 6) : null;
    let pi = 0;
    let ui = 0;
    for (let i = 0; i < triCount; i++) {
      const ax = positions[i * 9],     ay = positions[i * 9 + 1], az = positions[i * 9 + 2];
      const bx = positions[i * 9 + 3], by = positions[i * 9 + 4], bz = positions[i * 9 + 5];
      const cx = positions[i * 9 + 6], cy = positions[i * 9 + 7], cz = positions[i * 9 + 8];
      const mabx = (ax + bx) / 2, maby = (ay + by) / 2, mabz = (az + bz) / 2;
      const mbcx = (bx + cx) / 2, mbcy = (by + cy) / 2, mbcz = (bz + cz) / 2;
      const mcax = (cx + ax) / 2, mcay = (cy + ay) / 2, mcaz = (cz + az) / 2;
      // 4 triangles: corner_a, corner_b, corner_c, central
      // [A, Mab, Mca]
      newPos[pi++] = ax;   newPos[pi++] = ay;   newPos[pi++] = az;
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      // [Mab, B, Mbc]
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = bx;   newPos[pi++] = by;   newPos[pi++] = bz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      // [Mca, Mbc, C]
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      newPos[pi++] = cx;   newPos[pi++] = cy;   newPos[pi++] = cz;
      // [Mab, Mbc, Mca] central
      newPos[pi++] = mabx; newPos[pi++] = maby; newPos[pi++] = mabz;
      newPos[pi++] = mbcx; newPos[pi++] = mbcy; newPos[pi++] = mbcz;
      newPos[pi++] = mcax; newPos[pi++] = mcay; newPos[pi++] = mcaz;
      if (uvs) {
        const au = uvs[i * 6],     av = uvs[i * 6 + 1];
        const bu = uvs[i * 6 + 2], bv = uvs[i * 6 + 3];
        const cu = uvs[i * 6 + 4], cv = uvs[i * 6 + 5];
        const mabu = (au + bu) / 2, mabv = (av + bv) / 2;
        const mbcu = (bu + cu) / 2, mbcv = (bv + cv) / 2;
        const mcau = (cu + au) / 2, mcav = (cv + av) / 2;
        newUv[ui++] = au;   newUv[ui++] = av;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = bu;   newUv[ui++] = bv;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = cu;   newUv[ui++] = cv;
        newUv[ui++] = mabu; newUv[ui++] = mabv;
        newUv[ui++] = mbcu; newUv[ui++] = mbcv;
        newUv[ui++] = mcau; newUv[ui++] = mcav;
      }
    }
    const next = new THREE.BufferGeometry();
    next.setAttribute('position', new THREE.Float32BufferAttribute(newPos, 3));
    if (newUv) next.setAttribute('uv', new THREE.Float32BufferAttribute(newUv, 2));
    geo = next;
  }
  return geo;
}

// Per-layer build durations of the last scene build (ms), for __planxPerf.
export const layerBuildTimings = {};
export async function runLayerBuild(label, buildFn, clearFn = null) {
  const t0 = performance.now();
  try {
    await buildFn();
    layerBuildTimings[label] = Math.round(performance.now() - t0);
    return true;
  } catch (err) {
    console.warn(`${label} layer skipped`, err);
    if (clearFn) clearFn();
    setStatus(`${label} layer skipped: ${err?.message || err}`, true);
    return false;
  }
}
