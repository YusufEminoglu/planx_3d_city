// node --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { skeletonRoof } from '../../web/src/roof_skeleton.js';

const area = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
};
const P = (arr) => arr.map(([x, y]) => ({ x, y }));

function check(name, ring, { gable = false } = {}) {
  const roof = skeletonRoof(ring, 4, { gable });
  assert.ok(roof, `${name}: no roof`);
  assert.equal(roof.faces.length, ring.length, `${name}: one face per edge`);
  let sum = 0;
  let maxH = 0;
  for (const f of roof.faces) {
    if (!f.vertical) sum += area(f.points);
    for (const p of f.points) maxH = Math.max(maxH, p.h);
  }
  // Faces are counter-clockwise and cover the footprint exactly.
  assert.ok(Math.abs(sum - Math.abs(area(ring))) < 1e-6 * Math.abs(area(ring)) + (gable ? Infinity : 0), `${name}: area ${sum} vs ${Math.abs(area(ring))}`);
  assert.ok(Math.abs(maxH - 4) < 1e-9, `${name}: max height ${maxH}`);
  return roof;
}

const square = P([[0, 0], [10, 0], [10, 10], [0, 10]]);
const rect = P([[0, 0], [20, 0], [20, 8], [0, 8]]);
const L = P([[0, 0], [20, 0], [20, 8], [8, 8], [8, 20], [0, 20]]);
const T = P([[0, 0], [24, 0], [24, 8], [16, 8], [16, 20], [8, 20], [8, 8], [0, 8]]);
const U = P([[0, 0], [24, 0], [24, 20], [16, 20], [16, 8], [8, 8], [8, 20], [0, 20]]);
const irregular = P([[0, 0], [13, -2], [17, 6], [11, 9], [12, 15], [3, 13], [-2, 6]]);
const notch = P([[0, 0], [30, 0], [30, 12], [18, 12], [18, 10], [12, 10], [12, 12], [0, 12]]);

test('square: four triangles meeting at the centre', () => {
  const roof = check('square', square);
  for (const f of roof.faces) assert.equal(f.points.length, 3);
});
test('rectangle: two trapezoids and two hip triangles', () => {
  const roof = check('rect', rect);
  assert.deepEqual(roof.faces.map((f) => f.points.length).sort(), [3, 3, 4, 4]);
});
test('L, T, U, irregular and notched footprints', () => {
  for (const [name, ring] of Object.entries({ L, T, U, irregular, notch })) {
    check(name, ring);
    check(`${name} reversed`, ring.slice().reverse());
  }
});
test('gable: hip ends become vertical', () => {
  const roof = skeletonRoof(rect, 4, { gable: true });
  const vertical = roof.faces.filter((f) => f.vertical);
  assert.equal(vertical.length, 2);
  for (const f of vertical) {
    const apex = f.points.find((p) => p.h > 0);
    assert.ok(Math.abs(apex.x) < 1e-9 || Math.abs(apex.x - 20) < 1e-9, 'apex above the end wall');
  }
});
test('collinear and duplicate points are ignored', () => {
  const ring = P([[0, 0], [5, 0], [10, 0], [10, 0], [10, 10], [0, 10]]);
  const roof = skeletonRoof(ring, 3);
  assert.equal(roof.faces.length, 4);
});
test('random orthogonal blocks', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let failures = 0;
  for (let k = 0; k < 200; k++) {
    // Staircase polygon: monotone orthogonal outline.
    const steps = 2 + Math.floor(rnd() * 4);
    const top = [];
    let x = 0;
    for (let s = 0; s < steps; s++) {
      const h = 4 + rnd() * 12;
      const w = 3 + rnd() * 10;
      top.push([x, h], [x + w, h]);
      x += w;
    }
    const ring = P([[0, 0], [x, 0], ...top.reverse()]);
    const roof = skeletonRoof(ring, 4);
    if (!roof) { failures++; continue; }
    let sum = 0;
    for (const f of roof.faces) sum += area(f.points);
    if (Math.abs(sum - Math.abs(area(ring))) > 1e-6 * Math.abs(area(ring))) failures++;
  }
  assert.ok(failures <= 2, `${failures} of 200 failed`);
});
