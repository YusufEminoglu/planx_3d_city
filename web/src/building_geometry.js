// Building geometry in local scene coordinates (x, z), free of viewer state,
// so the same code runs on the main thread and in building_worker.js.
//
// three is imported by path rather than through the import map: module
// workers do not see import maps. The URL resolves to the same module the
// page loads as 'three', so the main thread still gets a single instance.
import * as THREE from '../assets/vendor/three/build/three.module.js';
import { skeletonRoof } from './roof_skeleton.js';

export function polygonCentroid(points) {
  if (!points.length) return new THREE.Vector3(0, 0, 0);
  let signedArea = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const a = p0.x * p1.z - p1.x * p0.z;
    signedArea += a;
    cx += (p0.x + p1.x) * a;
    cz += (p0.z + p1.z) * a;
  }
  if (Math.abs(signedArea) < 1e-7) {
    const c = new THREE.Vector3();
    points.forEach((p) => c.add(p));
    c.multiplyScalar(1 / points.length);
    return c;
  }
  const k = 1 / (3 * signedArea);
  return new THREE.Vector3(cx * k, 0, cz * k);
}

export function convexHull2D(points) {
  const ps = points.map((p) => ({ x: p.x, z: p.z }))
    .sort((a, b) => (a.x - b.x) || (a.z - b.z));
  if (ps.length < 3) return ps;
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower = [];
  for (const p of ps) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Minimum-area oriented bounding rectangle of a footprint ring in the X-Z plane.
// Aligns the box to a footprint edge instead of the world axes, so pitched roofs
// follow the building's real orientation/size rather than its axis-aligned bbox.
export function orientedRoofBox(ring) {
  const hull = convexHull2D(ring);
  let best = null;
  if (hull.length >= 3) {
    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const ux = (b.x - a.x) / len;
      const uz = (b.z - a.z) / len;
      let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
      for (const p of hull) {
        const u = p.x * ux + p.z * uz;
        const v = -p.x * uz + p.z * ux;
        if (u < uMin) uMin = u;
        if (u > uMax) uMax = u;
        if (v < vMin) vMin = v;
        if (v > vMax) vMax = v;
      }
      const area = (uMax - uMin) * (vMax - vMin);
      if (!best || area < best.area) best = { area, ux, uz, uMin, uMax, vMin, vMax };
    }
  }
  if (!best) {
    const bb = new THREE.Box3().setFromPoints(ring);
    best = { ux: 1, uz: 0, uMin: bb.min.x, uMax: bb.max.x, vMin: bb.min.z, vMax: bb.max.z };
  }
  return best;
}

// Offset a footprint ring outward by `dist` (miter join) so a roof can keep a
// small eave that follows the polygon shape. Winding-agnostic: keeps whichever
// direction grows the area. Sharp corners are clamped to avoid long spikes.
export function offsetRingOutward(ring, dist) {
  const n = ring.length;
  if (n < 3 || dist <= 1e-6) return ring.map((p) => p.clone());
  const area = (pts) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      s += a.x * b.z - b.x * a.z;
    }
    return Math.abs(s);
  };
  const build = (sign) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const prev = ring[(i - 1 + n) % n];
      const cur = ring[i];
      const next = ring[(i + 1) % n];
      const l1 = Math.hypot(cur.x - prev.x, cur.z - prev.z) || 1;
      const l2 = Math.hypot(next.x - cur.x, next.z - cur.z) || 1;
      const n1x = -(cur.z - prev.z) / l1;
      const n1z = (cur.x - prev.x) / l1;
      const n2x = -(next.z - cur.z) / l2;
      const n2z = (next.x - cur.x) / l2;
      let mx = (n1x + n2x) * sign;
      let mz = (n1z + n2z) * sign;
      const ml = Math.hypot(mx, mz) || 1;
      mx /= ml;
      mz /= ml;
      let cos = Math.abs(mx * n1x + mz * n1z);
      if (cos < 0.3) cos = 0.3;
      const s = dist / cos;
      out.push(new THREE.Vector3(cur.x + mx * s, 0, cur.z + mz * s));
    }
    return out;
  };
  const plus = build(1);
  return area(plus) >= area(ring) ? plus : build(-1);
}

export function roofGeometryFromTriangles(points, faces) {
  const verts = [];
  const uvs = [];
  const bb = new THREE.Box2();
  points.forEach((p) => bb.expandByPoint(new THREE.Vector2(p.x, p.z)));
  const sx = Math.max(1e-6, bb.max.x - bb.min.x);
  const sz = Math.max(1e-6, bb.max.y - bb.min.y);
  const pushVertex = (p) => {
    verts.push(p.x, p.y, p.z);
    uvs.push((p.x - bb.min.x) / sx, (p.z - bb.min.y) / sz);
  };
  faces.forEach((face) => {
    if (face.length === 3) {
      face.forEach(pushVertex);
    } else if (face.length === 4) {
      pushVertex(face[0]); pushVertex(face[1]); pushVertex(face[2]);
      pushVertex(face[0]); pushVertex(face[2]); pushVertex(face[3]);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

// Hip / gable roof on the straight skeleton of the eave outline: every eave
// edge gets its own plane at the same pitch, so L, T and U footprints get
// valleys and ridges that follow the building. Roof texture rows run along
// each face's eave. Returns null when the skeleton cannot be built.
function skeletonRoofGeometry(eaveRing, roofHeight, gable) {
  const roof = skeletonRoof(eaveRing.map((p) => ({ x: p.x, y: p.z })), roofHeight, { gable });
  if (!roof) return null;
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const p of eaveRing) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const uvScale = 1 / Math.max(1e-6, maxX - minX, maxZ - minZ);
  const pos = [];
  const uv = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  for (const face of roof.faces) {
    const pts = face.points;
    const a = pts[0];
    const b = pts[1];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    // Inward normal of the eave (the footprint is counter-clockwise).
    const ix = -dy;
    const iy = dx;
    // 2D frame of the face: along the eave, and up the slope (or the wall).
    const local = pts.map((p) => {
      const along = (p.x - a.x) * dx + (p.y - a.y) * dy;
      const inward = (p.x - a.x) * ix + (p.y - a.y) * iy;
      return { along, up: face.vertical ? p.h : Math.hypot(inward, p.h) };
    });
    const contour = face.vertical
      ? local.map((q) => new THREE.Vector2(q.along, q.up))
      : pts.map((p) => new THREE.Vector2(p.x, p.y));
    let tris;
    try {
      tris = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch {
      return null;
    }
    for (const [i0, i1, i2] of tris) {
      const p0 = pts[i0], p1 = pts[i1], p2 = pts[i2];
      va.set(p0.x, p0.h, p0.y);
      vb.set(p1.x, p1.h, p1.y);
      vc.set(p2.x, p2.h, p2.y);
      nrm.subVectors(vb, va).cross(vc.clone().sub(va));
      // Slopes face up, gable walls face out of the footprint.
      const flip = face.vertical ? (nrm.x * ix + nrm.z * iy) > 0 : nrm.y < 0;
      const order = flip ? [i0, i2, i1] : [i0, i1, i2];
      for (const k of order) {
        const p = pts[k];
        pos.push(p.x, p.h, p.y);
        uv.push(local[k].along * uvScale, local[k].up * uvScale);
      }
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// Roof geometry over a footprint, with its lowest point at y = 0. roofShape
// must already be one of ROOF_SHAPE_OPTIONS.
export function roofGeometryFor(shape, footprintPoints, roofShape, roofHeight) {
  const ring = footprintPoints.filter((_, i) => i === 0 || footprintPoints[i - 1].distanceTo(footprintPoints[i]) > 1e-6);
  const safeShape = roofShape;
  const rh = Math.max(0, Number(roofHeight) || 0);
  let roofGeo;

  if (safeShape === 'Flat' || rh <= 0.05 || ring.length < 3) {
    roofGeo = new THREE.ShapeGeometry(shape);
    roofGeo.rotateX(Math.PI / 2);
  } else if (safeShape === 'Pyramid') {
    const center = polygonCentroid(ring);
    center.y = rh;
    const faces = ring.map((a, i) => [a, ring[(i + 1) % ring.length], center]);
    roofGeo = roofGeometryFromTriangles(ring.concat([center]), faces);
  } else {
    // Footprint-following roofs (like Pyramid): eaves are the real polygon edges,
    // not a bounding box. Orientation/ridge axis comes from the OBB; the eave is
    // the footprint offset outward by a small amount.
    const box = orientedRoofBox(ring);
    let ax = box.ux;
    let az = box.uz;
    let bx = -box.uz;
    let bz = box.ux;
    const c0 = polygonCentroid(ring);
    let a0Half = 0;
    let b0Half = 0;
    for (const p of ring) {
      const da = Math.abs((p.x - c0.x) * ax + (p.z - c0.z) * az);
      const db = Math.abs((p.x - c0.x) * bx + (p.z - c0.z) * bz);
      if (da > a0Half) a0Half = da;
      if (db > b0Half) b0Half = db;
    }
    const eave = Math.min(0.3, 0.2 * Math.min(a0Half, b0Half));
    const eaveRing = offsetRingOutward(ring, eave);

    const C = polygonCentroid(eaveRing);
    let aHalf = 0;
    let bHalf = 0;
    for (const p of eaveRing) {
      const da = Math.abs((p.x - C.x) * ax + (p.z - C.z) * az);
      const db = Math.abs((p.x - C.x) * bx + (p.z - C.z) * bz);
      if (da > aHalf) aHalf = da;
      if (db > bHalf) bHalf = db;
    }
    // Ridge runs along the longer axis.
    if (bHalf > aHalf) {
      let t;
      t = ax; ax = bx; bx = t;
      t = az; az = bz; bz = t;
      t = aHalf; aHalf = bHalf; bHalf = t;
    }

    if (safeShape === 'Shed') {
      // Single tilted plane over the real footprint (low at -b, high at +b),
      // plus vertical skirt faces so the raised sides are not left open.
      const span = Math.max(0.1, 2 * bHalf);
      const shedH = (px, pz) => rh * Math.max(0, Math.min(1, ((px - C.x) * bx + (pz - C.z) * bz + bHalf) / span));
      const ring2 = eaveRing.slice();
      const contour = ring2.map((p) => new THREE.Vector2(p.x, p.z));
      if (THREE.ShapeUtils.isClockWise(contour)) { ring2.reverse(); contour.reverse(); }
      const top = ring2.map((p) => new THREE.Vector3(p.x, shedH(p.x, p.z), p.z));
      const points = [];
      const faces = [];
      for (const tri of THREE.ShapeUtils.triangulateShape(contour, [])) {
        points.push(top[tri[0]], top[tri[1]], top[tri[2]]);
        faces.push([top[tri[0]], top[tri[1]], top[tri[2]]]);
      }
      for (let i = 0; i < ring2.length; i++) {
        const p = ring2[i];
        const q = ring2[(i + 1) % ring2.length];
        const hp = shedH(p.x, p.z);
        const hq = shedH(q.x, q.z);
        if (Math.max(hp, hq) < 1e-4) continue;
        const pBase = new THREE.Vector3(p.x, 0, p.z);
        const qBase = new THREE.Vector3(q.x, 0, q.z);
        const qTop = new THREE.Vector3(q.x, hq, q.z);
        const pTop = new THREE.Vector3(p.x, hp, p.z);
        points.push(pBase, qBase, qTop, pTop);
        faces.push([pBase, qBase, qTop, pTop]);
      }
      roofGeo = roofGeometryFromTriangles(points, faces);
    } else if ((roofGeo = skeletonRoofGeometry(eaveRing, rh, safeShape === 'Gable'))) {
      // Straight-skeleton hip / gable roof.
    } else {
      // Fallback: loft the footprint outline up to one ridge line at height rh.
      // Gable -> ridge spans the full length (vertical gable ends).
      // Hip   -> ridge inset from each end by the half-width (sloped hip ends).
      const ridgeHalf = safeShape === 'Gable' ? aHalf : Math.max(0, aHalf - bHalf);
      const ridgeOf = (p) => {
        let pa = (p.x - C.x) * ax + (p.z - C.z) * az;
        pa = Math.max(-ridgeHalf, Math.min(ridgeHalf, pa));
        return new THREE.Vector3(C.x + ax * pa, rh, C.z + az * pa);
      };
      const points = [];
      const faces = [];
      for (let i = 0; i < eaveRing.length; i++) {
        const a = eaveRing[i];
        const b = eaveRing[(i + 1) % eaveRing.length];
        const a0 = new THREE.Vector3(a.x, 0, a.z);
        const b0 = new THREE.Vector3(b.x, 0, b.z);
        const ra = ridgeOf(a);
        const rb = ridgeOf(b);
        points.push(a0, b0, ra, rb);
        if (ra.distanceTo(rb) < 1e-6) {
          faces.push([a0, b0, ra]);
        } else {
          faces.push([a0, b0, rb, ra]);
        }
      }
      roofGeo = roofGeometryFromTriangles(points, faces);
    }
  }

  roofGeo.computeBoundingBox();
  const minY = roofGeo.boundingBox ? roofGeo.boundingBox.min.y : 0;
  if (minY !== 0) roofGeo.translate(0, -minY, 0);

  return roofGeo;
}

// Shape from local rings [[x, z], ...]: the first ring is the outline, the rest holes.
export function shapeFromRings(poly) {
  const outer = poly?.[0];
  if (!outer || outer.length < 3) return null;
  const shape = new THREE.Shape();
  outer.forEach((c, i) => {
    const [x, z] = c;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  });
  for (let h = 1; h < poly.length; h++) {
    const ring = poly[h];
    if (!ring || ring.length < 3) continue;
    const path = new THREE.Path();
    ring.forEach((c, i) => {
      const [x, z] = c;
      if (i === 0) path.moveTo(x, z); else path.lineTo(x, z);
    });
    shape.holes.push(path);
  }
  return shape;
}

export function offsetLocalRing(ring, distance, isHole) {
  if (!ring || !Array.isArray(ring)) return null;
  const pts = [];
  for (const pt of ring) {
    if (!pt || pt.length < 2) continue;
    const [x, z] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const v = new THREE.Vector2(x, z);
    if (pts.length === 0 || pts[pts.length - 1].distanceTo(v) > 0.001) {
      pts.push(v);
    }
  }
  if (pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 0.001) {
    pts.pop();
  }
  const n = pts.length;
  if (n < 3) return null;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  const ccw = area > 0;
  const dirSign = (ccw !== isHole) ? 1 : -1;
  const newPts = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    
    const len1 = curr.distanceTo(prev);
    const len2 = next.distanceTo(curr);
    if (len1 < 0.001 || len2 < 0.001) {
      newPts.push(new THREE.Vector2(curr.x, curr.y));
      continue;
    }
    
    const d1 = new THREE.Vector2().subVectors(curr, prev).divideScalar(len1);
    const d2 = new THREE.Vector2().subVectors(next, curr).divideScalar(len2);
    const n1 = new THREE.Vector2(-d1.y, d1.x);
    const n2 = new THREE.Vector2(-d2.y, d2.x);
    
    const sum = new THREE.Vector2().addVectors(n1, n2);
    let bisector;
    if (sum.lengthSq() < 0.0001) {
      bisector = new THREE.Vector2(n1.x, n1.y);
    } else {
      bisector = sum.normalize();
    }
    
    const cosHalf = bisector.dot(n1);
    const scale = cosHalf > 0.1 ? 1 / cosHalf : 1.0;
    const offset = new THREE.Vector2().addScaledVector(bisector, distance * scale * dirSign).add(curr);
    newPts.push(offset);
  }
  return newPts;
}

export function insetShapeFromRings(poly, distance) {
  if (!poly || !poly.length) return null;
  if (distance <= 0) return shapeFromRings(poly);
  const outerLocal = offsetLocalRing(poly[0], distance, false);
  if (!outerLocal || outerLocal.length < 3) return null;
  const hasNan = outerLocal.some(pt => !Number.isFinite(pt.x) || !Number.isFinite(pt.y));
  if (hasNan) return null;
  
  let area = 0;
  const n = outerLocal.length;
  for (let i = 0; i < n; i++) {
    const p1 = outerLocal[i];
    const p2 = outerLocal[(i + 1) % n];
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  if (Math.abs(area) < 5.0) {
    return shapeFromRings(poly);
  }
  const shape = new THREE.Shape();
  outerLocal.forEach((pt, i) => {
    if (i === 0) shape.moveTo(pt.x, pt.y); else shape.lineTo(pt.x, pt.y);
  });
  for (let h = 1; h < poly.length; h++) {
    const ring = poly[h];
    if (!ring || ring.length < 3) continue;
    const holeLocal = offsetLocalRing(ring, distance, true);
    if (!holeLocal || holeLocal.length < 3) continue;
    const holeHasNan = holeLocal.some(pt => !Number.isFinite(pt.x) || !Number.isFinite(pt.y));
    if (holeHasNan) continue;
    
    const path = new THREE.Path();
    holeLocal.forEach((pt, i) => {
      if (i === 0) path.moveTo(pt.x, pt.y); else path.lineTo(pt.x, pt.y);
    });
    shape.holes.push(path);
  }
  return shape;
}

// Deterministic night window brightness in [0.2, 1.0] per building.
export function glowFor(x, z) {
  return 0.2 + (Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1) * 0.8;
}

const SLAB_THICKNESS = 0.12;

function extrudeUp(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.computeBoundingBox();
  const minY = g.boundingBox ? g.boundingBox.min.y : 0;
  if (minY !== 0) g.translate(0, -minY, 0);
  return g;
}

function toByte(v) {
  return v <= 0 ? 0 : (v >= 1 ? 255 : Math.round(v * 255));
}

/**
 * Build every building of `specs` and merge the result into one buffer set
 * per (look, tile). Runs on the main thread or in building_worker.js.
 *
 * spec: {
 *   rid, tile, centre: [x, z], rings: [[[x, z], ...], ...] (local),
 *   baseY, height, levels, floorHeight, podiumHeight, setback,
 *   mode: 'footprint' | 'extrude' | 'extrude+roof',
 *   ledges: null | { projection }, roof: null | { shape, height },
 *   looks: { wall, podiumWall, towerWall, cap, roof, slab, footprint }
 *          each null or { id, color: [r, g, b] (linear), uv: [9] | null }
 * }
 * looks[id].hasMap tells whether the look samples a texture (UVs needed).
 * Returns [{ lookId, tile, position, normal, uv, color, planxId, planxGlow }].
 */
export function buildBuildingBuckets(specs, looks) {
  const buckets = new Map();
  const add = (look, geo, start, count, ty, rid, glow, tile) => {
    if (!look || count <= 0) return;
    const key = `${look.id}#${tile}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { lookId: look.id, tile, pieces: [], count: 0 }));
    b.pieces.push({ geo, start, count, ty, color: look.color, uv: look.uv, rid, glow });
    b.count += count;
  };
  const addWhole = (look, geo, ty, spec, glow) => {
    if (geo.index) geo = geo.toNonIndexed();
    add(look, geo, 0, geo.attributes.position.count, ty, spec.rid, glow, spec.tile);
  };
  // ExtrudeGeometry: group 0 = caps, group 1 = sides.
  const addExtrude = (capLook, sideLook, geo, ty, spec, glow) => {
    const total = geo.attributes.position.count;
    for (const g of geo.groups) {
      const look = g.materialIndex === 0 ? capLook : sideLook;
      add(look, geo, g.start, Math.min(g.count, total - g.start), ty, spec.rid, glow, spec.tile);
    }
  };

  for (const spec of specs) {
    const shape = shapeFromRings(spec.rings);
    if (!shape) continue;
    const L = spec.looks;
    const glow = glowFor(spec.centre[0], spec.centre[1]);
    const baseY = spec.baseY;

    if (spec.mode === 'footprint') {
      const fp = new THREE.ShapeGeometry(shape);
      fp.rotateX(Math.PI / 2);
      addWhole(L.footprint, fp, baseY + 0.035, spec, glow);
      continue;
    }

    const outer = spec.rings[0];
    const podium = spec.podiumHeight;
    let towerShape = shape;
    let towerFootprint = outer.map(([x, z]) => new THREE.Vector3(x, 0, z));
    if (podium > 0) {
      addExtrude(null, L.podiumWall, extrudeUp(shape, podium), baseY, spec, glow);
      const inset = insetShapeFromRings(spec.rings, spec.setback);
      if (inset) {
        towerShape = inset;
        const outerInset = offsetLocalRing(outer, spec.setback, false);
        if (outerInset && outerInset.length >= 3) towerFootprint = outerInset.map((p) => new THREE.Vector3(p.x, 0, p.y));
      }
      addExtrude(L.cap, L.towerWall, extrudeUp(towerShape, spec.height - podium), baseY + podium, spec, glow);
    } else {
      addExtrude(L.cap, L.wall, extrudeUp(shape, spec.height), baseY, spec, glow);
    }

    if (spec.ledges && spec.levels > 1) {
      // Every floor shares one slab outline per setback (podium and tower).
      const slabGeoms = new Map();
      for (let i = 1; i < spec.levels; i++) {
        const setback = ((i === 1 && podium > 0) ? 0 : (podium > 0 ? spec.setback : 0)) - spec.ledges.projection;
        if (!slabGeoms.has(setback)) {
          const outline = insetShapeFromRings(spec.rings, setback);
          slabGeoms.set(setback, outline ? extrudeUp(outline, SLAB_THICKNESS) : null);
        }
        const geom = slabGeoms.get(setback);
        if (geom) addWhole(L.slab, geom, baseY + i * spec.floorHeight - SLAB_THICKNESS / 2, spec, glow);
      }
    }

    if (spec.mode === 'extrude+roof' && spec.roof) {
      const roofGeo = roofGeometryFor(towerShape, towerFootprint, spec.roof.shape, spec.roof.height);
      addWhole(L.roof, roofGeo, baseY + podium + (spec.height - podium) + 0.04, spec, glow);
    }
  }

  const out = [];
  for (const b of buckets.values()) {
    const n = b.count;
    const hasMap = !!looks[b.lookId]?.hasMap;
    const pos = new Float32Array(n * 3);
    const nor = new Int16Array(n * 3);
    const uv = hasMap ? new Float32Array(n * 2) : null;
    const col = new Uint8Array(n * 3);
    const ids = new Float32Array(n);
    const glow = new Uint8Array(n);
    let o = 0;
    for (const p of b.pieces) {
      const P = p.geo.attributes.position.array;
      const N = p.geo.attributes.normal.array;
      const U = p.geo.attributes.uv?.array;
      const end = p.start + p.count;
      for (let i = p.start, j = o * 3; i < end; i++, j += 3) {
        pos[j] = P[i * 3]; pos[j + 1] = P[i * 3 + 1] + p.ty; pos[j + 2] = P[i * 3 + 2];
        nor[j] = Math.round(N[i * 3] * 32767);
        nor[j + 1] = Math.round(N[i * 3 + 1] * 32767);
        nor[j + 2] = Math.round(N[i * 3 + 2] * 32767);
      }
      if (uv && U) {
        // Bake the texture transform (repeat/offset) into the UVs.
        const m = p.uv || [1, 0, 0, 0, 1, 0, 0, 0, 1];
        for (let i = p.start, j = o * 2; i < end; i++, j += 2) {
          const u0 = U[i * 2], v0 = U[i * 2 + 1];
          uv[j] = m[0] * u0 + m[3] * v0 + m[6];
          uv[j + 1] = m[1] * u0 + m[4] * v0 + m[7];
        }
      }
      const R = toByte(p.color[0]), G = toByte(p.color[1]), B = toByte(p.color[2]);
      for (let j = o * 3, k = 0; k < p.count; k++, j += 3) {
        col[j] = R; col[j + 1] = G; col[j + 2] = B;
      }
      ids.fill(p.rid, o, o + p.count);
      glow.fill(toByte(p.glow), o, o + p.count);
      o += p.count;
    }
    out.push({ lookId: b.lookId, tile: b.tile, position: pos, normal: nor, uv, color: col, planxId: ids, planxGlow: glow });
  }
  return out;
}
