// @ts-check
// Road network topology from road centre lines in local [x, z] coordinates,
// free of three.js so it can be unit tested:
//   - which road ends meet at a junction (three or more ends at one point, or
//     a dead end that touches the side of another road) and how far road
//     markings, sidewalks and curbs keep back from it (the clearance: the
//     half width of the widest crossing road);
//   - two ends meeting alone only continue the same street: no junction;
//   - which ends connect, so cars and people can turn into the next street
//     instead of jumping back to the start of the one they are on.

/**
 * @typedef {{ points: number[][], halfWidth: number }} NetworkLine
 * @typedef {{ line: number, at: number, dir: number }} NetworkLink
 *   at: distance along the target line, dir: +1 or -1 travel direction
 *   (0 = either way, for a T junction into the middle of a road).
 * @typedef {{ junction: boolean, clear: number, links: NetworkLink[] }} NetworkEnd
 * @typedef {{ from: number, to: number, side: number }} NetworkGap
 *   A stretch of a line's sidewalk left open where a side street joins it
 *   (side +1: right of the line's direction, -1: left).
 * @typedef {{ at: number, clear: number }} NetworkJunction
 *   A junction on a line (an end, or where another road crosses it), with
 *   its clearance on both sides.
 * @typedef {{ length: number, start: NetworkEnd, end: NetworkEnd, gaps: NetworkGap[],
 *   junctions: NetworkJunction[] }} NetworkLineInfo
 */

/** @param {number[][]} points */
export function polylineLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return len;
}

// Distance from p to segment ab, and the parameter of the closest point.
function segmentDistance(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2)) : 0;
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

/**
 * @param {NetworkLine[]} lines
 * @param {{ snap?: number, cell?: number }} [options]
 *   snap: ends closer than this (m) share a node; cell: segment index cell (m).
 * @returns {NetworkLineInfo[]}
 */
export function buildRoadNetwork(lines, { snap = 1.5, cell = 40 } = {}) {
  const info = lines.map((l) => ({
    length: polylineLength(l.points),
    start: { junction: false, clear: 0, links: [] },
    end: { junction: false, clear: 0, links: [] },
    gaps: [],
    junctions: []
  }));

  // 1. Cluster line ends into nodes (grid hash, neighbours searched).
  /** @type {{ x: number, z: number, ends: { line: number, atStart: boolean }[] }[]} */
  const nodes = [];
  const grid = new Map();
  const nodeAt = (x, z) => {
    const gx = Math.floor(x / snap);
    const gz = Math.floor(z / snap);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const n of grid.get(`${gx + i}:${gz + j}`) || []) {
          if (Math.hypot(n.x - x, n.z - z) <= snap) return n;
        }
      }
    }
    const n = { x, z, ends: [] };
    nodes.push(n);
    const key = `${gx}:${gz}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(n);
    return n;
  };
  lines.forEach((l, i) => {
    const pts = l.points;
    if (!pts || pts.length < 2) return;
    nodeAt(pts[0][0], pts[0][1]).ends.push({ line: i, atStart: true });
    const last = pts[pts.length - 1];
    nodeAt(last[0], last[1]).ends.push({ line: i, atStart: false });
  });

  const endOf = (e) => (e.atStart ? info[e.line].start : info[e.line].end);
  const linkTo = (e) => ({ line: e.line, at: e.atStart ? 0 : info[e.line].length, dir: e.atStart ? 1 : -1 });

  // 2. Segment index for dead ends that touch the side of another road.
  const segGrid = new Map();
  let segCount = 0;
  lines.forEach((l, li) => {
    const pts = l.points || [];
    let along = 0;
    for (let s = 1; s < pts.length; s++) {
      const [ax, az] = pts[s - 1];
      const [bx, bz] = pts[s];
      const seg = { id: segCount++, line: li, ax, az, bx, bz, along };
      along += Math.hypot(bx - ax, bz - az);
      const x0 = Math.floor(Math.min(ax, bx) / cell);
      const x1 = Math.floor(Math.max(ax, bx) / cell);
      const z0 = Math.floor(Math.min(az, bz) / cell);
      const z1 = Math.floor(Math.max(az, bz) / cell);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gz = z0; gz <= z1; gz++) {
          const key = `${gx}:${gz}`;
          if (!segGrid.has(key)) segGrid.set(key, []);
          segGrid.get(key).push(seg);
        }
      }
    }
  });

  for (const node of nodes) {
    const ends = node.ends;
    if (ends.length >= 3) {
      for (const e of ends) {
        const end = endOf(e);
        end.junction = true;
        let widest = 0;
        for (const o of ends) if (o !== e && o.line !== e.line) widest = Math.max(widest, lines[o.line].halfWidth);
        end.clear = widest + 0.5;
        end.links = ends.filter((o) => o !== e).map(linkTo);
      }
    } else if (ends.length === 2) {
      // The street continues in the next feature: no junction, keep driving.
      const [a, b] = ends;
      endOf(a).links = [linkTo(b)];
      endOf(b).links = [linkTo(a)];
    } else if (ends.length === 1) {
      // Dead end, unless it touches the side of another road (T junction).
      const e = ends[0];
      const gx = Math.floor(node.x / cell);
      const gz = Math.floor(node.z / cell);
      let best = null;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          for (const seg of segGrid.get(`${gx + i}:${gz + j}`) || []) {
            if (seg.line === e.line) continue;
            const { d, t } = segmentDistance(node.x, node.z, seg.ax, seg.az, seg.bx, seg.bz);
            const reach = lines[seg.line].halfWidth + snap;
            if (d <= reach && (!best || d < best.d)) {
              const sx = seg.bx - seg.ax;
              const sz = seg.bz - seg.az;
              // Right of the segment direction is (-dz, dx).
              const lateral = (node.x - (seg.ax + sx * t)) * -sz + (node.z - (seg.az + sz * t)) * sx;
              best = { d, line: seg.line, at: seg.along + t * Math.hypot(sx, sz), side: lateral >= 0 ? 1 : -1 };
            }
          }
        }
      }
      const end = endOf(e);
      if (best) {
        end.junction = true;
        end.clear = Math.max(0, lines[best.line].halfWidth - best.d) + 0.5;
        end.links = [{ line: best.line, at: best.at, dir: 0 }];
        const open = lines[e.line].halfWidth + 1;
        info[best.line].gaps.push({ from: best.at - open, to: best.at + open, side: best.side });
        info[best.line].junctions.push({ at: best.at, clear: lines[e.line].halfWidth + 0.5 });
      }
    }
  }
  // 3. Roads that cross without a node (lines not split at the junction).
  const seen = new Set();
  const nearEnd = (li, x, z) => {
    const pts = lines[li].points;
    const a = pts[0];
    const b = pts[pts.length - 1];
    return Math.hypot(a[0] - x, a[1] - z) <= snap || Math.hypot(b[0] - x, b[1] - z) <= snap;
  };
  for (const segs of segGrid.values()) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const p = segs[i];
        const q = segs[j];
        if (p.line === q.line) continue;
        const key = p.id < q.id ? `${p.id}:${q.id}` : `${q.id}:${p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const rx = p.bx - p.ax, rz = p.bz - p.az;
        const sx = q.bx - q.ax, sz = q.bz - q.az;
        const den = rx * sz - rz * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((q.ax - p.ax) * sz - (q.az - p.az) * sx) / den;
        const u = ((q.ax - p.ax) * rz - (q.az - p.az) * rx) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const x = p.ax + rx * t;
        const z = p.az + rz * t;
        if (nearEnd(p.line, x, z) || nearEnd(q.line, x, z)) continue;
        info[p.line].junctions.push({ at: p.along + t * Math.hypot(rx, rz), clear: lines[q.line].halfWidth + 0.5 });
        info[q.line].junctions.push({ at: q.along + u * Math.hypot(sx, sz), clear: lines[p.line].halfWidth + 0.5 });
      }
    }
  }
  info.forEach((l) => {
    if (l.start.junction) l.junctions.push({ at: 0, clear: l.start.clear });
    if (l.end.junction) l.junctions.push({ at: l.length, clear: l.end.clear });
    l.junctions.sort((a, b) => a.at - b.at);
  });
  return info;
}

/**
 * Pick where to go at the end of a line: a link at random (deterministic for
 * a given rand in [0, 1)), or turn around on the same line at a dead end.
 * @param {NetworkLineInfo[]} network
 * @param {number} line
 * @param {number} dir travel direction on `line` (+1 reaches its end)
 * @param {number} rand
 * @param {(line: number, dir: number) => boolean} [accept] which lines and
 *   directions may be taken (car-free streets, one-way streets).
 * @returns {{ line: number, at: number, dir: number }}
 */
export function nextLineAtEnd(network, line, dir, rand, accept = () => true) {
  const info = network[line];
  const end = dir > 0 ? info.end : info.start;
  // Any way on (a closed loop links back to its own start); a U-turn only
  // at a true dead end.
  const here = dir > 0 ? info.length : 0;
  const options = [];
  for (const l of end.links) {
    if (l.line === line && Math.abs(l.at - here) < 1e-6) continue;
    for (const d of l.dir !== 0 ? [l.dir] : [1, -1]) {
      if (accept(l.line, d)) options.push({ line: l.line, at: l.at, dir: d });
    }
  }
  if (!options.length) return { line, at: here, dir: -dir };
  return options[Math.min(options.length - 1, Math.floor(rand * options.length))];
}
