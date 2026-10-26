import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../web/assets/vendor/three/build/three.module.js';
import { prismGeometry } from '../../web/src/building_geometry.js';

const rect = (w, d) => new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(w, 0), new THREE.Vector2(w, d), new THREE.Vector2(0, d)]);

function walls(geo) {
  const g = geo.groups[1];
  const P = geo.attributes.position.array;
  const N = geo.attributes.normal.array;
  const U = geo.attributes.uv.array;
  const out = [];
  for (let i = g.start; i < g.start + g.count; i++) out.push({ x: P[i * 3], y: P[i * 3 + 1], z: P[i * 3 + 2], nx: N[i * 3], nz: N[i * 3 + 2], u: U[i * 2], v: U[i * 2 + 1] });
  return out;
}

test('walls get whole bays and floors, restarting at corners', () => {
  const geo = prismGeometry(rect(10, 6), 9, { bay: 3, floor: 3, z0: 0 });
  const w = walls(geo);
  // 10 m wall: 3 bays; 6 m wall: 2 bays.
  const along10 = w.filter((p) => Math.abs(p.nz) > 0.9);
  const along6 = w.filter((p) => Math.abs(p.nx) > 0.9);
  assert.deepEqual([...new Set(along10.map((p) => +p.u.toFixed(6)))].sort(), [0, 3]);
  assert.deepEqual([...new Set(along6.map((p) => +p.u.toFixed(6)))].sort(), [0, 2]);
  assert.deepEqual([...new Set(w.map((p) => +p.v.toFixed(6)))].sort(), [0, 3]);
});

test('wall normals point out of the outline, either winding', () => {
  for (const shape of [rect(10, 6), new THREE.Shape(rect(10, 6).getPoints().reverse())]) {
    for (const p of walls(prismGeometry(shape, 3, { bay: 3, floor: 3 }))) {
      const cx = p.x - 5;
      const cz = p.z - 3;
      assert.ok(p.nx * cx + p.nz * cz > 0, `normal (${p.nx}, ${p.nz}) at (${p.x}, ${p.z}) faces in`);
    }
  }
});

test('courtyard walls face into the courtyard; upper volumes continue the floor count', () => {
  const s = rect(30, 30);
  s.holes.push(new THREE.Path([new THREE.Vector2(10, 10), new THREE.Vector2(20, 10), new THREE.Vector2(20, 20), new THREE.Vector2(10, 20)]));
  const w = walls(prismGeometry(s, 6, { bay: 3, floor: 3, z0: 6 }));
  const inner = w.filter((p) => p.x > 9 && p.x < 21 && p.z > 9 && p.z < 21);
  assert.ok(inner.length > 0);
  for (const p of inner) assert.ok(p.nx * (p.x - 15) + p.nz * (p.z - 15) < 0);
  assert.deepEqual([...new Set(w.map((p) => +p.v.toFixed(6)))].sort(), [2, 4]);
});

test('walls shorter than half a bay are plain wall', () => {
  const w = walls(prismGeometry(rect(1, 8), 3, { bay: 3, floor: 3 }));
  const short = w.filter((p) => Math.abs(p.nz) > 0.9);
  assert.ok(short.every((p) => p.u === Math.fround(0.02)));
});
