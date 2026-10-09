// node --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCityJson } from '../../web/src/cityjson.js';

const sq = (x, y, w) => [[x, y], [x + w, y], [x + w, y + w], [x, y + w], [x, y]];

function realVertices(cj) {
  const { scale, translate } = cj.transform;
  return cj.vertices.map((v) => v.map((q, i) => q * scale[i] + translate[i]));
}

// Newell normal of a ring of vertex indices.
function normal(ring, V) {
  const n = [0, 0, 0];
  for (let i = 0; i < ring.length; i++) {
    const a = V[ring[i]];
    const b = V[ring[(i + 1) % ring.length]];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return n;
}

function checkClosedOutward(shell, V) {
  // Every directed edge appears once and its reverse once: a closed,
  // consistently oriented shell.
  const edges = new Map();
  for (const surface of shell) {
    for (const ring of surface) {
      for (let i = 0; i < ring.length; i++) {
        const k = `${ring[i]}>${ring[(i + 1) % ring.length]}`;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
  }
  for (const [k, c] of edges) {
    assert.equal(c, 1, `edge ${k} used ${c} times`);
    const [a, b] = k.split('>');
    assert.ok(edges.has(`${b}>${a}`), `edge ${k} has no twin`);
  }
  // Signed volume (divergence theorem) is positive for outward normals.
  let vol = 0;
  for (const surface of shell) {
    for (const ring of surface) {
      const p0 = V[ring[0]];
      for (let i = 1; i + 1 < ring.length; i++) {
        const p1 = V[ring[i]];
        const p2 = V[ring[i + 1]];
        vol += (p0[0] * (p1[1] * p2[2] - p1[2] * p2[1]) - p0[1] * (p1[0] * p2[2] - p1[2] * p2[0]) + p0[2] * (p1[0] * p2[1] - p1[1] * p2[0])) / 6;
      }
    }
  }
  return vol;
}

test('box building: closed, outward, right volume', () => {
  const cj = buildCityJson([{ id: 'b1', polygons: [[sq(500000, 4400000, 10)]], base: 850, height: 12, attributes: { floors: 4, function: 'RESIDENTIAL', empty: '' } }], { crs: 'EPSG:32636' });
  assert.equal(cj.type, 'CityJSON');
  assert.equal(cj.version, '2.0');
  assert.equal(cj.metadata.referenceSystem, 'https://www.opengis.net/def/crs/EPSG/0/32636');
  const V = realVertices(cj);
  assert.equal(V.length, 8);
  const geom = cj.CityObjects.b1.geometry[0];
  assert.equal(geom.type, 'Solid');
  assert.equal(geom.boundaries[0].length, 6);
  const vol = checkClosedOutward(geom.boundaries[0], V);
  assert.ok(Math.abs(vol - 1200) < 1e-6, `volume ${vol}`);
  // Roof faces up, floor faces down.
  assert.ok(normal(geom.boundaries[0][0][0], V)[2] > 0);
  assert.ok(normal(geom.boundaries[0][1][0], V)[2] < 0);
  assert.deepEqual(cj.CityObjects.b1.attributes, { floors: 4, function: 'RESIDENTIAL' });
});

test('clockwise input and a courtyard', () => {
  const outer = sq(0, 0, 30).reverse();
  const hole = sq(10, 10, 10);
  const cj = buildCityJson([{ id: 7, polygons: [[outer, hole]], base: 0, height: 10, attributes: {} }], { crs: 'EPSG:2320' });
  const V = realVertices(cj);
  const shell = cj.CityObjects['7'].geometry[0].boundaries[0];
  assert.equal(shell.length, 2 + 4 + 4);
  assert.equal(shell[0].length, 2, 'roof keeps its hole');
  const vol = checkClosedOutward(shell, V);
  assert.ok(Math.abs(vol - (900 - 100) * 10) < 1e-6, `volume ${vol}`);
});

test('multi-part buildings become MultiSolid; zero height is skipped', () => {
  const cj = buildCityJson([
    { id: 'm', polygons: [[sq(0, 0, 5)], [sq(10, 0, 5)]], base: 1, height: 3, attributes: {} },
    { id: 'z', polygons: [[sq(0, 0, 5)]], base: 0, height: 0, attributes: {} }
  ]);
  assert.equal(cj.CityObjects.m.geometry[0].type, 'MultiSolid');
  assert.equal(cj.CityObjects.m.geometry[0].boundaries.length, 2);
  assert.equal(cj.CityObjects.z, undefined);
  assert.equal(cj.metadata.referenceSystem, undefined);
});
