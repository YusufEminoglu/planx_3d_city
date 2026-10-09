// @ts-check
// Straight skeleton of a simple polygon and the hip / gable roof built on it.
//
// The skeleton is what remains when every edge of the footprint moves inward
// at the same speed: each edge sweeps one roof face, so a roof with the same
// pitch on every side follows any footprint (L, T, U, irregular) instead of a
// single ridge over the bounding box.
//
// Kinetic wavefront: every wavefront vertex knows where and when it was born
// and its exact velocity (it stays on both of its edges' moving lines). Edge
// events (an edge shrinks to nothing) and split events (a reflex vertex runs
// into an edge across the polygon) are processed in time order, and each
// event is checked against the live wavefront when it is taken from the
// queue, so stale predictions are dropped instead of corrupting the result.
// Each vertex trajectory is a skeleton arc between the faces of its two edges.
//
// Pure math on {x, y} points (y is the scene z axis): runs in workers and in
// node tests.

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k });
const dot = (a, b) => a.x * b.x + a.y * b.y;
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (a) => {
  const l = Math.hypot(a.x, a.y);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
};

function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

// Drop repeated and collinear points; null if fewer than three remain.
export function cleanRing(points, eps = 1e-4) {
  const pts = [];
  for (const p of points) {
    if (!pts.length || dist(pts[pts.length - 1], p) > eps) pts.push({ x: p.x, y: p.y });
  }
  if (pts.length > 1 && dist(pts[0], pts[pts.length - 1]) <= eps) pts.pop();
  let changed = true;
  while (changed && pts.length >= 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length];
      const b = pts[i];
      const c = pts[(i + 1) % pts.length];
      // Straight on or folding back, within ~0.1 degrees.
      if (Math.abs(cross(unit(sub(b, a)), unit(sub(c, b)))) < 2e-3) {
        pts.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return pts.length >= 3 ? pts : null;
}

// Velocity that keeps a vertex on both moving edge lines (n·w = 1 for each
// inward normal); null when the edges are anti-parallel (the region between
// them has no width left).
function velocity(eLeft, eRight) {
  const n1 = eLeft.n;
  const n2 = eRight.n;
  const det = cross(n1, n2);
  if (Math.abs(det) < 1e-9) {
    return dot(n1, n2) > 0 ? { x: n1.x, y: n1.y } : null;
  }
  // Solve [n1; n2] w = [1; 1].
  return { x: (n2.y - n1.y) / det, y: (n1.x - n2.x) / det };
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(e) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].t <= a[i].t) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].t < a[m].t) m = l;
        if (r < a.length && a[r].t < a[m].t) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Straight skeleton of a simple counter-clockwise polygon (y up).
 * Returns arcs [{ a, ta, b, tb, edges: [i, j] }]: from point a at time
 * (height) ta to point b at time tb, between the faces of edges i and j.
 */
export function straightSkeleton(points) {
  const n = points.length;
  let size = 0;
  for (const p of points) size = Math.max(size, Math.abs(p.x - points[0].x), Math.abs(p.y - points[0].y));
  const eps = 1e-9 * Math.max(1, size);
  const edges = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const d = unit(sub(q, p));
    return { i, p, d, n: { x: -d.y, y: d.x } }; // interior on the left
  });
  const arcs = [];
  const queue = new Heap();
  let alive = 0;

  const makeVertex = (p, t, eLeft, eRight) => {
    const v = { p, t, eLeft, eRight, w: velocity(eLeft, eRight), prev: null, next: null, valid: true };
    v.reflex = cross(eLeft.d, eRight.d) < -1e-12;
    alive++;
    return v;
  };
  const posAt = (v, t) => (v.w ? add(v.p, scale(v.w, t - v.t)) : v.p);
  const retire = (v, p, t) => {
    if (!v.valid) return;
    v.valid = false;
    alive--;
    arcs.push({ a: v.p, ta: v.t, b: p, tb: t, edges: [v.eLeft.i, v.eRight.i] });
  };

  const edgeCollapse = (a, b) => {
    // a.eRight === b.eLeft: the edge between them shrinks to a point.
    if (!a.w || !b.w) return;
    const d = a.eRight.d;
    const den = dot(d, a.w) - dot(d, b.w);
    if (den <= 1e-12) return;
    const t = (dot(d, sub(b.p, a.p)) - dot(d, b.w) * b.t + dot(d, a.w) * a.t) / den;
    if (t < Math.max(a.t, b.t) - 1e-9 * Math.max(1, size)) return;
    queue.push({ type: 'edge', t: Math.max(t, a.t, b.t), a, b });
  };
  const predict = (v) => {
    edgeCollapse(v.prev, v);
    edgeCollapse(v, v.next);
    if (!v.reflex || !v.w) return;
    for (const e of edges) {
      if (e === v.eLeft || e === v.eRight) continue;
      const den = 1 - dot(e.n, v.w);
      if (den <= 1e-12) continue;
      const ahead = dot(e.n, sub(v.p, e.p));
      if (ahead < v.t - eps) continue; // behind that edge's wavefront
      const t = (ahead - dot(e.n, v.w) * v.t) / den;
      if (t <= v.t + eps) continue;
      queue.push({ type: 'split', t, v, e });
    }
  };

  const ridge = (p, q, t, e1, e2) => {
    if (dist(p, q) > eps) arcs.push({ a: p, ta: t, b: q, tb: t, edges: [e1.i, e2.i] });
  };
  const settle = (v, t) => {
    // After an event: resolve degenerate vertices, otherwise predict anew.
    if (!v.valid) return;
    const p = v.prev;
    const q = v.next;
    if (p === q) {
      // Two vertices left: the loop is a level ridge between them.
      const pv = posAt(v, t);
      const pq = posAt(q, t);
      retire(v, pv, t);
      retire(q, pq, t);
      ridge(pv, pq, t, v.eLeft, v.eRight);
      return;
    }
    if (v.w) {
      predict(v);
      return;
    }
    // Anti-parallel edges: the stretch where they overlap has no width left
    // and becomes a level ridge, up to the nearer neighbour, which then
    // joins the two remaining edges.
    const e1 = v.eLeft;
    const e2 = v.eRight;
    const pv = v.p;
    const pp = posAt(p, t);
    const pq = posAt(q, t);
    const l1 = dot(e2.d, sub(pp, pv));
    const l2 = dot(e2.d, sub(pq, pv));
    const tol = 1e-7 * Math.max(1, size);
    retire(v, pv, t);
    if (Math.abs(l1 - l2) <= tol) {
      const m = scale(add(pp, pq), 0.5);
      ridge(pv, m, t, e1, e2);
      if (p.prev === q) {
        retire(p, m, t);
        retire(q, m, t);
        return;
      }
      const nv = makeVertex(m, t, p.eLeft, q.eRight);
      nv.prev = p.prev;
      nv.next = q.next;
      p.prev.next = nv;
      q.next.prev = nv;
      retire(p, m, t);
      retire(q, m, t);
      settle(nv, t);
    } else if (l1 < l2) {
      ridge(pv, pp, t, e1, e2);
      const nv = makeVertex(pp, t, p.eLeft, e2);
      nv.prev = p.prev;
      nv.next = q;
      p.prev.next = nv;
      q.prev = nv;
      retire(p, pp, t);
      settle(nv, t);
    } else {
      ridge(pv, pq, t, e1, e2);
      const nv = makeVertex(pq, t, e1, q.eRight);
      nv.prev = p;
      nv.next = q.next;
      p.next = nv;
      q.next.prev = nv;
      retire(q, pq, t);
      settle(nv, t);
    }
  };

  const verts = edges.map((e, i) => makeVertex(points[i], 0, edges[(i - 1 + n) % n], e));
  verts.forEach((v, i) => {
    v.prev = verts[(i - 1 + n) % n];
    v.next = verts[(i + 1) % n];
  });
  verts.forEach(predict);

  let guard = 0;
  while (queue.size && alive > 0) {
    if (++guard > 200 * n + 1000) throw new Error('straight skeleton did not converge');
    const ev = queue.pop();
    const t = ev.t;
    if (ev.type === 'edge') {
      const { a, b } = ev;
      if (!a.valid || !b.valid || a.next !== b) continue;
      const p = scale(add(posAt(a, t), posAt(b, t)), 0.5);
      if (a.prev === b.next) {
        // The last triangle of this loop shrinks to a point: a roof peak.
        const c = b.next;
        retire(a, p, t);
        retire(b, p, t);
        retire(c, p, t);
        continue;
      }
      const nv = makeVertex(p, t, a.eLeft, b.eRight);
      nv.prev = a.prev;
      nv.next = b.next;
      a.prev.next = nv;
      b.next.prev = nv;
      retire(a, p, t);
      retire(b, p, t);
      settle(nv, t);
    } else {
      const { v, e } = ev;
      if (!v.valid) continue;
      const h = posAt(v, t);
      // The live part of edge e that the vertex reaches: between y and x.
      let y = null;
      let u = v.next;
      for (let k = 0; u !== v && k <= n * 4; k++, u = u.next) {
        if (u.eRight !== e || u.next === v || u === v.prev) continue;
        const py = posAt(u, t);
        const px = posAt(u.next, t);
        const s = dot(e.d, sub(h, py));
        const l = dot(e.d, sub(px, py));
        if (s >= -1e-7 * Math.max(1, size) && s <= l + 1e-7 * Math.max(1, size)) {
          y = u;
          break;
        }
      }
      if (!y) continue;
      const x = y.next;
      const v1 = makeVertex(h, t, v.eLeft, e);
      const v2 = makeVertex(h, t, e, v.eRight);
      v1.prev = v.prev;
      v1.next = x;
      v.prev.next = v1;
      x.prev = v1;
      v2.prev = y;
      v2.next = v.next;
      v.next.prev = v2;
      y.next = v2;
      retire(v, h, t);
      settle(v1, t);
      settle(v2, t);
    }
  }
  if (alive > 0) throw new Error('straight skeleton left open wavefronts');
  return arcs;
}

/**
 * @typedef {{ x: number, y: number }} Point2
 * @typedef {{ x: number, y: number, h: number }} RoofPoint
 * @typedef {{ vertical: boolean, points: RoofPoint[] }} RoofFace
 */

/**
 * Roof faces over a footprint with the same pitch on every side. Each face
 * is counter-clockwise seen from above (y up).
 * @param {Point2[]} ring footprint, any winding, no holes
 * @param {number} height height of the highest point (the pitch follows from it)
 * @param {{ gable?: boolean }} [options] gable: turn hip ends (triangles under
 *        a ridge end) into vertical gables
 * @returns {{ faces: RoofFace[] } | null} null when the skeleton fails
 */
export function skeletonRoof(ring, height, { gable = false } = {}) {
  let pts = cleanRing(ring);
  if (!pts) return null;
  if (signedArea(pts) < 0) pts = pts.slice().reverse();
  const n = pts.length;
  let arcs;
  try {
    arcs = straightSkeleton(pts);
  } catch {
    return null;
  }
  let size = 0;
  for (const p of pts) size = Math.max(size, Math.abs(p.x - pts[0].x), Math.abs(p.y - pts[0].y));
  const tol = 1e-6 * Math.max(1, size);

  // Merge arc ends into graph nodes (footprint corners first).
  const nodes = [];
  const nodeAt = (p, t) => {
    for (const nd of nodes) {
      if (Math.abs(nd.x - p.x) < tol && Math.abs(nd.y - p.y) < tol) return nd;
    }
    const nd = { x: p.x, y: p.y, t, links: new Map() };
    nodes.push(nd);
    return nd;
  };
  const corners = pts.map((p) => nodeAt(p, 0));
  // links: neighbour -> set of edge indices whose face uses that arc.
  const link = (a, b, edgesOf) => {
    if (a === b) return;
    for (const [u, w] of [[a, b], [b, a]]) {
      if (!u.links.has(w)) u.links.set(w, new Set());
      for (const i of edgesOf) u.links.get(w).add(i);
    }
  };
  for (const arc of arcs) {
    const a = nodeAt(arc.a, arc.ta);
    const b = nodeAt(arc.b, arc.tb);
    link(a, b, arc.edges);
  }
  let maxT = 0;
  for (const nd of nodes) maxT = Math.max(maxT, nd.t);
  if (!(maxT > 0)) return null;

  // Face of edge i: from its end corner back to its start corner through
  // arcs of that face, taking the sharpest turn at forks.
  const faces = [];
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const face = [a, b];
    let prev = a;
    let cur = b;
    let ok = false;
    for (let step = 0; step <= nodes.length; step++) {
      const back = unit(sub(prev, cur));
      let best = null;
      let bestAngle = Infinity;
      for (const [nb, faceEdges] of cur.links) {
        if (nb === prev || !faceEdges.has(i)) continue;
        const out = unit(sub(nb, cur));
        let ang = Math.atan2(cross(out, back), dot(out, back));
        if (ang <= 1e-9) ang += 2 * Math.PI;
        if (ang < bestAngle) {
          bestAngle = ang;
          best = nb;
        }
      }
      if (!best) break;
      if (best === a) {
        ok = true;
        break;
      }
      if (face.includes(best)) break;
      face.push(best);
      prev = cur;
      cur = best;
    }
    if (!ok) return null;
    // Every node of the face lies on the edge's roof plane.
    const d = unit(sub(b, a));
    for (const nd of face) {
      if (Math.abs(cross(d, sub(nd, a)) - nd.t) > 1e-4 * Math.max(1, maxT)) return null;
    }
    faces.push({ nodes: face, vertical: false });
  }

  // The faces must tile the footprint exactly (a wrong skeleton leaves gaps
  // or overlaps that this catches).
  let covered = 0;
  for (const f of faces) {
    const fa = signedArea(f.nodes);
    if (fa < -1e-6 * Math.max(1, size * size)) return null;
    covered += fa;
  }
  const total = signedArea(pts);
  if (Math.abs(covered - total) > 1e-5 * total) return null;

  if (gable) {
    // A hip end is a triangle a, b, apex whose apex continues as one level
    // ridge: slide the apex along that ridge to above the eave line.
    for (const f of faces) {
      if (f.nodes.length !== 3) continue;
      const [a, b, apex] = f.nodes;
      const others = [...apex.links.keys()].filter((k) => k !== a && k !== b);
      if (apex.links.size !== 3 || others.length !== 1) continue;
      const r = others[0];
      if (Math.abs(r.t - apex.t) > 1e-4 * Math.max(1, maxT)) continue;
      const dir = sub(apex, r);
      const ab = sub(b, a);
      const den = cross(dir, ab);
      if (Math.abs(den) < 1e-12) continue;
      const s = cross(sub(a, r), ab) / den;
      if (s < 1) continue;
      apex.x = r.x + dir.x * s;
      apex.y = r.y + dir.y * s;
      f.vertical = true;
    }
  }

  const k = height / maxT;
  return {
    faces: faces.map((f) => ({
      vertical: f.vertical,
      // a -> b runs with the interior on its left, so a, b, ridge... is
      // counter-clockwise already.
      points: f.nodes.map((nd) => ({ x: nd.x, y: nd.y, h: nd.t * k }))
    }))
  };
}
