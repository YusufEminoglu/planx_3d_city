// @ts-check
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

export const MASSING_MODE_MAP = {
  'Auto Smart Massing': 'auto',
  'auto': 'auto',
  'Extruded + roof': 'extrude+roof',
  'extrude+roof': 'extrude+roof',
  'Podium + tower': 'podium',
  'podium': 'podium',
  'Stepped tower': 'stepped',
  'stepped': 'stepped',
  'Courtyard block': 'courtyard',
  'courtyard': 'courtyard',
  'Cantilever / pilotis': 'cantilever',
  'cantilever': 'cantilever',
  'Penthouse crown': 'penthouse',
  'penthouse': 'penthouse',
  'Extruded': 'extrude',
  'extrude': 'extrude',
  'Footprint only': 'footprint',
  'footprint': 'footprint'
};

/**
 * Resolve a building's volumetric massing mode from explicit setting/property
 * or automatically from building typology (levels, footprint area, function).
 */
export function resolveBuildingMassing(requestedMode, opts = {}) {
  const raw = String(requestedMode || 'Auto Smart Massing').trim();
  const mapped = MASSING_MODE_MAP[raw] || 'auto';
  if (mapped !== 'auto') return mapped;

  const levels = Math.max(1, Number(opts.levels) || 1);
  const footprintArea = Math.max(0, Number(opts.footprintArea) || 0);
  const fn = String(opts.functionName || '').toLowerCase();
  const hasHoles = Boolean(opts.hasHoles);
  const seed = Math.abs(Math.round(Number(opts.seed) || 0));

  if (levels <= 1) return 'extrude+roof';
  if (levels >= 9) return 'stepped';
  if (footprintArea >= 520 && !hasHoles && levels >= 3 && levels <= 8) return 'courtyard';
  const isCivicOrCommercial = /commercial|office|mixed|retail|civic|public|education|health|hotel/.test(fn);
  if (levels >= 4 && (isCivicOrCommercial || footprintArea >= 360)) return 'podium';
  if (levels >= 5) return (seed % 2 === 0) ? 'penthouse' : 'cantilever';
  if (levels >= 3 && footprintArea >= 240 && (seed % 3 === 0)) return 'penthouse';
  return 'extrude+roof';
}

function signedRingArea2D(pts) {
  if (!pts || pts.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const x1 = Array.isArray(p1) ? p1[0] : p1.x;
    const y1 = Array.isArray(p1) ? p1[1] : (p1.y ?? p1.z);
    const x2 = Array.isArray(p2) ? p2[0] : p2.x;
    const y2 = Array.isArray(p2) ? p2[1] : (p2.y ?? p2.z);
    a += (x1 * y2 - x2 * y1);
  }
  return a * 0.5;
}

function tryInsetRing2D(ring, distance) {
  if (!ring || ring.length < 3 || distance <= 0) return null;
  const origArea = signedRingArea2D(ring);
  if (Math.abs(origArea) < 9.0) return null;
  const insetPts = offsetLocalRing(ring, distance, false);
  if (!insetPts || insetPts.length < 3) return null;
  if (insetPts.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const newArea = signedRingArea2D(insetPts);
  if ((newArea > 0) !== (origArea > 0)) return null;
  const ratio = Math.abs(newArea) / Math.abs(origArea);
  if (Math.abs(newArea) < 4.5 || ratio < 0.12 || ratio > 0.96) return null;
  return insetPts;
}

function buildTierShape(rings, insetDist) {
  const outerPts = tryInsetRing2D(rings[0], insetDist);
  if (!outerPts) return null;
  const shape = new THREE.Shape();
  outerPts.forEach((pt, i) => {
    if (i === 0) shape.moveTo(pt.x, pt.y); else shape.lineTo(pt.x, pt.y);
  });
  const footprint = outerPts.map((pt) => new THREE.Vector3(pt.x, 0, pt.y));
  return { shape, footprint, outerPts };
}

const SLAB_THICKNESS = 0.12;
// Walls darken over their lowest AO_HEIGHT metres (contact shadow).
const AO_HEIGHT = 3.5;

function extrudeUp(shape, depth) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(Math.PI / 2);
  g.computeBoundingBox();
  const minY = g.boundingBox ? g.boundingBox.min.y : 0;
  if (minY !== 0) g.translate(0, -minY, 0);
  return g;
}

// Walls turn a corner where the outline bends by more than this (radians);
// gentler bends (curved walls, digitising noise) continue the same facade.
const WALL_CORNER_ANGLE = 0.3;

/**
 * Prism over a shape (x, z = shape x, y) from y = 0 to `depth`, like
 * extrudeUp, but with facade texture coordinates in building units on the
 * walls: u counts window bays along each wall, v counts floors from the
 * building's ground. Every wall (outline between two corners) gets a whole
 * number of bays of about frame.bay metres and restarts at its corner, so
 * windows are never cut by a corner and rows sit on the floors.
 * Groups: 0 = caps (u, v = x, z in metres, as ExtrudeGeometry), 1 = walls.
 * frame: { bay: metres per bay, floor: metres per floor, z0: height of
 * y = 0 above the building's ground }.
 */
export function prismGeometry(shape, depth, frame) {
  const { shape: outer, holes } = shape.extractPoints(1);
  const clean = (pts) => {
    const out = [];
    for (const p of pts) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-4) out.push(p);
    }
    if (out.length > 2 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-4) out.pop();
    return out;
  };
  const contour = clean(outer);
  const holeRings = holes.map(clean).filter((h) => h.length >= 3);
  if (contour.length < 3) return null;
  const pos = [];
  const nor = [];
  const uv = [];

  // Caps: top faces up, bottom faces down.
  let tris;
  try {
    tris = THREE.ShapeUtils.triangulateShape(contour, holeRings);
  } catch {
    return null;
  }
  const all = contour.concat(...holeRings);
  for (const [y, up] of [[depth, 1], [0, -1]]) {
    for (const t of tris) {
      const [a, b, c] = t.map((i) => all[i]);
      // Normal y of (b - a) x (c - a) in (x, y, z) with z = shape y.
      const ny = (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
      const order = (ny >= 0) === (up > 0) ? [a, b, c] : [a, c, b];
      for (const p of order) {
        pos.push(p.x, y, p.y);
        nor.push(0, up, 0);
        uv.push(p.x, p.y);
      }
    }
  }
  const capCount = pos.length / 3;

  const bay = Math.max(0.5, frame.bay || 3);
  const floorH = Math.max(1, frame.floor || 3);
  const v0 = (frame.z0 || 0) / floorH;
  const v1 = ((frame.z0 || 0) + depth) / floorH;
  const ringWalls = (ring, isHole) => {
    const n = ring.length;
    let area = 0;
    for (let i = 0; i < n; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % n];
      area += a.x * b.y - b.x * a.y;
    }
    // Outward: right of the edge for a counter-clockwise outline, left
    // for a hole (the building is outside it).
    const outSign = (area >= 0 ? 1 : -1) * (isHole ? -1 : 1);
    const turn = (i) => {
      const p = ring[(i - 1 + n) % n];
      const c = ring[i];
      const q = ring[(i + 1) % n];
      const a1 = Math.atan2(c.y - p.y, c.x - p.x);
      const a2 = Math.atan2(q.y - c.y, q.x - c.x);
      return Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)));
    };
    const corners = [];
    for (let i = 0; i < n; i++) if (turn(i) > WALL_CORNER_ANGLE) corners.push(i);
    if (!corners.length) corners.push(0);
    for (let k = 0; k < corners.length; k++) {
      const start = corners[k];
      const end = corners[(k + 1) % corners.length];
      const edges = [];
      let len = 0;
      for (let i = start; ; i = (i + 1) % n) {
        const a = ring[i];
        const b = ring[(i + 1) % n];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        edges.push({ a, b, s: len, l });
        len += l;
        if ((i + 1) % n === end) break;
      }
      // Too short for a window: plain wall (u on a cell edge, between windows).
      const bays = Math.max(1, Math.round(len / bay));
      const scale = len < bay * 0.55 ? 0 : bays / len;
      for (const { a, b, s, l } of edges) {
        if (l < 1e-6) continue;
        const dx = (b.x - a.x) / l;
        const dz = (b.y - a.y) / l;
        const nx = dz * outSign;
        const nz = -dx * outSign;
        const ua = scale ? s * scale : 0.02;
        const ub = scale ? (s + l) * scale : 0.02;
        const A0 = [a.x, 0, a.y], B0 = [b.x, 0, b.y], B1 = [b.x, depth, b.y], A1 = [a.x, depth, a.y];
        const uvA0 = [ua, v0], uvB0 = [ub, v0], uvB1 = [ub, v1], uvA1 = [ua, v1];
        // Wind so the face normal points out (n): (B0 - A0) x (A1 - A0) = (dz, 0, -dx) * l * depth.
        const quad = outSign > 0
          ? [[A0, uvA0], [A1, uvA1], [B0, uvB0], [B0, uvB0], [A1, uvA1], [B1, uvB1]]
          : [[A0, uvA0], [B0, uvB0], [A1, uvA1], [B0, uvB0], [B1, uvB1], [A1, uvA1]];
        for (const [p, t] of quad) {
          pos.push(p[0], p[1], p[2]);
          nor.push(nx, 0, nz);
          uv.push(t[0], t[1]);
        }
      }
    }
  };
  ringWalls(contour, false);
  holeRings.forEach((h) => ringWalls(h, true));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.addGroup(0, capCount, 0);
  geo.addGroup(capCount, pos.length / 3 - capCount, 1);
  return geo;
}

function toByte(v) {
  return v <= 0 ? 0 : (v >= 1 ? 255 : Math.round(v * 255));
}

// Ring [[x, z], ...] or [Vector2, ...] -> [{ x, y }] (y = local z).
function ringPoints(ring) {
  return ring.map((p) => (Array.isArray(p) ? { x: p[0], y: p[1] } : { x: p.x, y: p.y }));
}

function pointInRing2D(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// The ring moved inwards by `distance`, or null when that folds it over.
function insetRingLoose(ring, distance) {
  const inset = offsetLocalRing(ring.map((p) => (Array.isArray(p) ? p : [p.x, p.y])), distance, false);
  if (!inset || inset.length < 3 || inset.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const a0 = signedRingArea2D(ring);
  const a1 = signedRingArea2D(inset);
  if ((a0 > 0) !== (a1 > 0) || Math.abs(a1) < 0.3 * Math.abs(a0)) return null;
  return inset;
}

// A low wall along the edge of a roof or terrace.
function parapetGeometry(ring, height, thickness = 0.22) {
  if (!ring || ring.length < 3) return null;
  const inner = insetRingLoose(ring, thickness);
  if (!inner) return null;
  const shape = new THREE.Shape(ringPoints(ring).map((p) => new THREE.Vector2(p.x, p.y)));
  shape.holes.push(new THREE.Path(inner.map((p) => new THREE.Vector2(p.x, p.y))));
  return extrudeUp(shape, height);
}

function seededRandom(seed) {
  let s = (Math.abs(Math.floor(seed)) * 2654435761 + 12345) >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Linear RGB.
const PLANT_COLORS = {
  core: [0.62, 0.6, 0.56], hvac: [0.42, 0.44, 0.46], tank: [0.78, 0.76, 0.7], panel: [0.03, 0.05, 0.1], frame: [0.5, 0.5, 0.5]
};

/**
 * Rooftop plant for a flat roof outline, deterministic per building: a stair
 * and lift core on taller buildings, air handling units, a water tank and
 * (spec.solar) solar water heaters facing south (-z). Geometry starts at y = 0.
 * @returns {{ geo: any, color: number[] }[]}
 */
export function rooftopPlant(ring, spec) {
  const out = [];
  if (!ring || ring.length < 3) return out;
  const area = Math.abs(signedRingArea2D(ring));
  if (area < 45) return out;
  const zone = insetRingLoose(ring, 1.1);
  if (!zone) return out;
  const pts = ringPoints(zone);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const rand = seededRandom(spec.rid + 17);
  const placed = [];
  // A free spot for a w x d footprint inside the roof, or null.
  const spot = (w, d) => {
    for (let k = 0; k < 14; k++) {
      const x = minX + w / 2 + rand() * Math.max(0, maxX - minX - w);
      const y = minY + d / 2 + rand() * Math.max(0, maxY - minY - d);
      const r = Math.hypot(w, d) / 2;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 0.4)) continue;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      if (!corners.every(([sx, sy]) => pointInRing2D(x + (sx * w) / 2, y + (sy * d) / 2, pts))) continue;
      placed.push({ x, y, r });
      return { x, y };
    }
    return null;
  };
  const box = (w, h, d, x, z, color) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, h / 2, z);
    out.push({ geo: g, color });
  };
  if ((spec.levels || 1) >= 5 && area > 120) {
    const p = spot(2.6, 3.0);
    if (p) box(2.6, 2.7, 3.0, p.x, p.y, PLANT_COLORS.core);
  }
  const units = area > 400 ? 3 : area > 150 ? 2 : 1;
  for (let i = 0; i < units; i++) {
    const p = spot(1.5, 1.0);
    if (p) box(1.5, 0.95, 1.0, p.x, p.y, PLANT_COLORS.hvac);
  }
  if (rand() < 0.6) {
    const p = spot(1.1, 1.1);
    if (p) {
      const g = new THREE.CylinderGeometry(0.52, 0.52, 1.15, 10, 1);
      g.translate(p.x, 0.575 + 0.15, p.y);
      out.push({ geo: g, color: PLANT_COLORS.tank });
    }
  }
  if (spec.solar) {
    const heaters = area > 220 ? 2 : 1;
    for (let i = 0; i < heaters; i++) {
      const p = spot(2.1, 1.9);
      if (!p) continue;
      // Collector tilted 35 degrees towards the south (-z), tank behind it.
      const panel = new THREE.BoxGeometry(1.9, 0.06, 1.25);
      panel.rotateX(-0.61);
      panel.translate(p.x, 0.62, p.y - 0.2);
      out.push({ geo: panel, color: PLANT_COLORS.panel });
      const tank = new THREE.CylinderGeometry(0.24, 0.24, 1.9, 8, 1);
      tank.rotateZ(Math.PI / 2);
      tank.translate(p.x, 1.08, p.y + 0.42);
      out.push({ geo: tank, color: PLANT_COLORS.tank });
      box(1.9, 0.05, 1.2, p.x, p.y + 0.1, PLANT_COLORS.frame);
    }
  }
  return out;
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
 *   solar: true for rooftop solar water heaters,
 *   looks: { wall, podiumWall, towerWall, cap, roof, slab, footprint, trim, plinth, plant }
 *          each null or { id, color: [r, g, b] (linear), uv: [9] | null }
 * }
 * looks[id].hasMap tells whether the look samples a texture (UVs needed).
 * Returns [{ lookId, tile, position, normal, uv, color, planxId, planxGlow, planxAo }].
 */
export function buildBuildingBuckets(specs, looks) {
  const buckets = new Map();
  // ao: wall pieces darken towards the ground (contact shadow), measured
  // from baseY; color overrides the look's colour for this piece.
  const add = (look, geo, start, count, ty, rid, glow, tile, extra = null) => {
    if (!look || count <= 0) return;
    const key = `${look.id}#${tile}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { lookId: look.id, tile, pieces: [], count: 0 }));
    b.pieces.push({
      geo, start, count, ty, color: extra?.color || look.color, uv: look.uv, rid, glow,
      aoBase: extra?.aoBase ?? null
    });
    b.count += count;
  };
  const addWhole = (look, geo, ty, spec, glow, extra = null) => {
    if (geo.index) geo = geo.toNonIndexed();
    add(look, geo, 0, geo.attributes.position.count, ty, spec.rid, glow, spec.tile, extra);
  };
  // ExtrudeGeometry: group 0 = caps, group 1 = sides.
  // A volume of the building from ty up by depth: caps and walls (walls
  // with facade coordinates in bays and floors, see prismGeometry).
  const addVolume = (capLook, sideLook, shape, depth, ty, spec, glow) => {
    const frame = { bay: spec.bay, floor: spec.height / Math.max(1, spec.levels || 1), z0: ty - spec.baseY };
    const geo = prismGeometry(shape, depth, frame) || extrudeUp(shape, depth);
    const total = geo.attributes.position.count;
    for (const g of geo.groups) {
      const side = g.materialIndex !== 0;
      add(side ? sideLook : capLook, geo, g.start, Math.min(g.count, total - g.start), ty, spec.rid, glow, spec.tile,
        side ? { aoBase: spec.baseY } : null);
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
    const outerFootprint = outer.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const outerArea = Math.abs(signedRingArea2D(outer));
    const minSpan = Math.sqrt(Math.max(16, outerArea));
    const mode = spec.mode || 'extrude+roof';
    let topShape = shape;
    let topFootprint = outerFootprint;
    let topY = baseY + spec.height;
    // Volumes stacked from the ground: [from, to] above baseY, their outline
    // (local rings) and whether the top is an open terrace. Floor slabs
    // follow the volume they belong to; terraces get a parapet.
    const tiers = [];
    const tierRings = (tier) => (tier ? [tier.outerPts.map((p) => [p.x, p.y])] : spec.rings);

    if (mode === 'stepped' && spec.height >= 8) {
      const h1 = spec.height * 0.42;
      const h2 = spec.height * 0.34;
      const h3 = Math.max(1.0, spec.height - h1 - h2);
      const step1 = Math.max(1.1, Math.min(minSpan * 0.14, (spec.setback || 0) + 1.4));
      const step2 = step1 * 1.95;
      const tier2 = buildTierShape(spec.rings, step1);
      const tier3 = tier2 ? buildTierShape(spec.rings, step2) : null;

      addVolume(L.cap || L.roof, L.podiumWall || L.wall, shape, h1, baseY, spec, glow);
      tiers.push({ from: 0, to: h1, rings: spec.rings, terrace: !!tier2 });
      if (tier2) {
        addVolume(L.cap || L.roof, L.towerWall || L.wall, tier2.shape, h2, baseY + h1, spec, glow);
        topShape = tier2.shape;
        topFootprint = tier2.footprint;
      } else {
        addVolume(L.cap || L.roof, L.towerWall || L.wall, shape, h2, baseY + h1, spec, glow);
      }
      tiers.push({ from: h1, to: h1 + h2, rings: tierRings(tier2), terrace: !!tier3 });
      if (tier3) {
        addVolume(L.cap, L.towerWall || L.wall, tier3.shape, h3, baseY + h1 + h2, spec, glow);
        topShape = tier3.shape;
        topFootprint = tier3.footprint;
      } else {
        addVolume(L.cap, L.towerWall || L.wall, topShape, h3, baseY + h1 + h2, spec, glow);
      }
      tiers.push({ from: h1 + h2, to: spec.height, rings: tier3 ? tierRings(tier3) : tierRings(tier2), top: true });
    } else if (mode === 'podium' && spec.height >= 6) {
      const podiumH = spec.podiumHeight > 0
        ? spec.podiumHeight
        : Math.min(spec.height * 0.42, Math.max(spec.floorHeight || 3.2, (spec.floorHeight || 3.2) * Math.min(3, Math.max(1, Math.floor((spec.levels || 4) * 0.35)))));
      const towerInset = Math.max(1.5, Math.min(minSpan * 0.18, (spec.setback || 0) + 1.8));
      const towerTier = buildTierShape(spec.rings, towerInset);
      addVolume(L.cap || L.roof, L.podiumWall || L.wall, shape, podiumH, baseY, spec, glow);
      tiers.push({ from: 0, to: podiumH, rings: spec.rings, terrace: !!towerTier });
      if (towerTier) {
        topShape = towerTier.shape;
        topFootprint = towerTier.footprint;
      }
      addVolume(L.cap, L.towerWall || L.wall, topShape, Math.max(1.0, spec.height - podiumH), baseY + podiumH, spec, glow);
      tiers.push({ from: podiumH, to: Math.max(podiumH + 1, spec.height), rings: tierRings(towerTier), top: true });
    } else if (mode === 'courtyard' && spec.rings.length === 1) {
      const courtWall = Math.max(2.2, Math.min(6.5, minSpan * 0.22));
      const innerRing = tryInsetRing2D(outer, courtWall);
      if (innerRing && Math.abs(signedRingArea2D(innerRing)) >= 9.0) {
        const courtShape = shapeFromRings(spec.rings);
        const holePath = new THREE.Path();
        const rev = innerRing.slice().reverse();
        rev.forEach((pt, i) => {
          if (i === 0) holePath.moveTo(pt.x, pt.y); else holePath.lineTo(pt.x, pt.y);
        });
        courtShape.holes.push(holePath);
        const plinthH = Math.min(1.2, (spec.floorHeight || 3.2) * 0.32);
        addVolume(L.cap || L.roof, L.podiumWall || L.wall, shape, plinthH, baseY, spec, glow);
        addVolume(L.cap, L.wall, courtShape, Math.max(1.0, spec.height - plinthH), baseY + plinthH, spec, glow);
        topShape = courtShape;
        tiers.push({ from: 0, to: spec.height, rings: [outer, rev.map((p) => [p.x, p.y])], top: true });
      } else {
        addVolume(L.cap, L.wall, shape, spec.height, baseY, spec, glow);
        tiers.push({ from: 0, to: spec.height, rings: spec.rings, top: true });
      }
    } else if (mode === 'cantilever' && spec.height >= 6) {
      const groundH = Math.min(spec.height * 0.34, Math.max(spec.floorHeight || 3.2, (spec.floorHeight || 3.2) * ((spec.levels || 4) >= 6 ? 2 : 1)));
      const recess = Math.max(1.2, Math.min(minSpan * 0.16, 2.2));
      const coreTier = buildTierShape(spec.rings, recess);
      const baseShape = coreTier ? coreTier.shape : shape;
      addVolume(null, L.podiumWall || L.wall, baseShape, groundH, baseY, spec, glow);
      if (L.slab) {
        addWhole(L.slab, extrudeUp(shape, SLAB_THICKNESS * 1.4), baseY + groundH - SLAB_THICKNESS * 0.7, spec, glow);
      }
      addVolume(L.cap, L.towerWall || L.wall, shape, Math.max(1.0, spec.height - groundH), baseY + groundH, spec, glow);
      tiers.push({ from: 0, to: groundH, rings: tierRings(coreTier), recessed: true });
      tiers.push({ from: groundH, to: spec.height, rings: spec.rings, top: true });
    } else if (mode === 'penthouse' && spec.height >= 5.5) {
      const crownH = Math.min(spec.height * 0.24, Math.max((spec.floorHeight || 3.2) * 0.9, 2.6));
      const mainH = Math.max(2.4, spec.height - crownH);
      const crownInset = Math.max(1.2, Math.min(minSpan * 0.16, 2.2));
      const crownTier = buildTierShape(spec.rings, crownInset);
      addVolume(L.cap || L.roof, L.wall, shape, mainH, baseY, spec, glow);
      if (L.slab) {
        addWhole(L.slab, extrudeUp(shape, SLAB_THICKNESS * 1.4), baseY + mainH, spec, glow);
      }
      tiers.push({ from: 0, to: mainH, rings: spec.rings, terrace: !!crownTier, top: !crownTier });
      if (crownTier) {
        addVolume(L.cap, L.towerWall || L.wall, crownTier.shape, crownH, baseY + mainH, spec, glow);
        topShape = crownTier.shape;
        topFootprint = crownTier.footprint;
        tiers.push({ from: mainH, to: spec.height, rings: tierRings(crownTier), top: true });
      } else {
        topY = baseY + mainH;
      }
    } else {
      const podium = spec.podiumHeight;
      if (podium > 0) {
        addVolume(L.cap || L.roof, L.podiumWall || L.wall, shape, podium, baseY, spec, glow);
        let towerRings = spec.rings;
        const inset = insetShapeFromRings(spec.rings, spec.setback);
        if (inset) {
          topShape = inset;
          const outerInset = offsetLocalRing(outer, spec.setback, false);
          if (outerInset && outerInset.length >= 3) {
            topFootprint = outerInset.map((p) => new THREE.Vector3(p.x, 0, p.y));
            towerRings = [outerInset.map((p) => [p.x, p.y])];
          }
        }
        addVolume(L.cap, L.towerWall || L.wall, topShape, spec.height - podium, baseY + podium, spec, glow);
        tiers.push({ from: 0, to: podium, rings: spec.rings, terrace: towerRings !== spec.rings });
        tiers.push({ from: podium, to: spec.height, rings: towerRings, top: true });
      } else {
        addVolume(L.cap, L.wall, shape, spec.height, baseY, spec, glow);
        tiers.push({ from: 0, to: spec.height, rings: spec.rings, top: true });
      }
    }

    // Floor slabs: a thin ledge at every floor line, following the volume
    // it belongs to (never across a terrace or a recessed ground floor).
    if (spec.ledges && spec.levels > 1 && L.slab) {
      const slabGeoms = new Map();
      for (let i = 1; i < spec.levels; i++) {
        const y = i * spec.floorHeight;
        const ti = tiers.findIndex((t) => y > t.from + 0.3 && y < t.to - 0.3);
        if (ti < 0 || tiers[ti].recessed) continue;
        if (!slabGeoms.has(ti)) {
          const outline = insetShapeFromRings(tiers[ti].rings, -spec.ledges.projection);
          slabGeoms.set(ti, outline ? extrudeUp(outline, SLAB_THICKNESS) : null);
        }
        const geom = slabGeoms.get(ti);
        if (geom) addWhole(L.slab, geom, baseY + y - SLAB_THICKNESS / 2, spec, glow);
      }
    }

    const flatTop = mode === 'extrude' || !spec.roof || spec.roof.shape === 'Flat' || !(spec.roof.height > 0.05);
    if (L.trim) {
      // Parapets around terraces and flat roofs.
      for (const t of tiers) {
        if (!(t.terrace || (t.top && flatTop))) continue;
        const parapet = parapetGeometry(t.rings[0], t.top ? 0.75 : 1.0);
        if (parapet) addWhole(L.trim, parapet, baseY + t.to, spec, glow);
      }
      // Rooftop plant on flat roofs: stair core, air handling, water tanks
      // and solar water heaters.
      const topTier = tiers.find((t) => t.top);
      if (flatTop && topTier && L.plant) {
        for (const item of rooftopPlant(topTier.rings[0], spec)) addWhole(L.plant, item.geo, baseY + topTier.to, spec, glow, { color: item.color });
      }
    }
    // Base course: a slightly proud stone plinth at street level.
    if (L.plinth && !(tiers[0]?.recessed)) {
      const plinthShape = insetShapeFromRings(spec.rings, -0.06);
      if (plinthShape) addWhole(L.plinth, extrudeUp(plinthShape, Math.min(0.85, spec.height * 0.3)), baseY - 0.05, spec, glow);
    }

    if (mode !== 'extrude' && spec.roof) {
      const roofGeo = roofGeometryFor(topShape, topFootprint, spec.roof.shape, spec.roof.height);
      addWhole(L.roof, roofGeo, topY + 0.04, spec, glow);
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
    const ao = new Uint8Array(n);
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
      if (p.aoBase === null) {
        ao.fill(255, o, o + p.count);
      } else {
        for (let i = p.start, j = o; i < end; i++, j++) ao[j] = toByte((P[i * 3 + 1] + p.ty - p.aoBase) / AO_HEIGHT);
      }
      o += p.count;
    }
    out.push({ lookId: b.lookId, tile: b.tile, position: pos, normal: nor, uv, color: col, planxId: ids, planxGlow: glow, planxAo: ao });
  }
  return out;
}
