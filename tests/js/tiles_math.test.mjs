// node --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, enuToEcef, fitAffine, geodeticToEcef, rootTransform, tilesetJson, zipStore } from '../../web/src/tiles_math.js';

// UTM forward projection (Snyder 1987, eqs. 8-9/8-10), WGS84.
function utm(lon, lat, zone) {
  const a = 6378137.0;
  const e2 = 6.69437999014e-3;
  const k0 = 0.9996;
  const ep2 = e2 / (1 - e2);
  const d = Math.PI / 180;
  const lon0 = (zone * 6 - 183) * d;
  const phi = lat * d;
  const n = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const t = Math.tan(phi) ** 2;
  const c = ep2 * Math.cos(phi) ** 2;
  const A = Math.cos(phi) * (lon * d - lon0);
  const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
    - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const x = k0 * n * (A + (1 - t + c) * A ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * A ** 5 / 120) + 500000;
  const y = k0 * (M + n * Math.tan(phi) * (A * A / 2 + (5 - t + 9 * c + 4 * c * c) * A ** 4 / 24
    + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * A ** 6 / 720));
  return [x, y];
}

// Control points as the exporter writes them, built from lon/lat (inverse
// direction, but the same relation): centre, ~1 km east, ~1 km north.
function controlPoints(lon, lat, zone) {
  const pts = [[lon, lat], [lon + 0.0118, lat], [lon, lat + 0.009]];
  return pts.map(([lo, la]) => ({ xy: utm(lo, la, zone), lonLat: [lo, la] }));
}

const apply = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);

test('affine fit reproduces its control points', () => {
  const cps = controlPoints(32.85, 39.92, 36);
  const f = fitAffine(cps);
  for (const cp of cps) {
    const [lon, lat] = f(...cp.xy);
    assert.ok(Math.abs(lon - cp.lonLat[0]) < 1e-12 && Math.abs(lat - cp.lonLat[1]) < 1e-12);
  }
  assert.equal(fitAffine([cps[0], cps[0], cps[1]]), null);
});

test('ENU frame: origin and up direction', () => {
  const m = enuToEcef(32.85, 39.92, 0);
  assert.deepEqual(apply(m, [0, 0, 0]).map((v) => Math.round(v)), geodeticToEcef(32.85, 39.92, 0).map((v) => Math.round(v)));
  const up = apply(m, [0, 0, 100]);
  const ref = geodeticToEcef(32.85, 39.92, 100);
  assert.ok(Math.hypot(up[0] - ref[0], up[1] - ref[1], up[2] - ref[2]) < 1e-6);
});

test('scene points land within a few centimetres of their true place', () => {
  // Off the zone's central meridian (Ankara in UTM 36: ~3 degrees east of
  // it), where grid north and true north differ by ~2 degrees.
  const centreLL = [32.85, 39.92];
  const cps = controlPoints(...centreLL, 36);
  const [cx, cy] = utm(...centreLL, 36);
  const { transform } = rootTransform({ controlPoints: cps }, cx, cy, 0);
  let worst = 0;
  for (const [dlon, dlat, h] of [[0.004, 0.003, 950], [-0.005, 0.002, 900], [0.0035, -0.004, 1010], [0, 0, 0]]) {
    const lon = centreLL[0] + dlon;
    const lat = centreLL[1] + dlat;
    const [x, y] = utm(lon, lat, 36);
    const got = apply(transform, [x - cx, y - cy, h]);
    const want = geodeticToEcef(lon, lat, h);
    worst = Math.max(worst, Math.hypot(got[0] - want[0], got[1] - want[1], got[2] - want[2]));
  }
  // Within ~500 m of the centre: curvature and projection non-linearity
  // stay at the centimetre level.
  assert.ok(worst < 0.1, `worst error ${worst} m`);
});

test('height offset moves the scene up', () => {
  const cps = controlPoints(29, 41, 35);
  const [cx, cy] = utm(29, 41, 35);
  const a = rootTransform({ controlPoints: cps }, cx, cy, 0).transform;
  const b = rootTransform({ controlPoints: cps }, cx, cy, 36.5).transform;
  const pa = apply(a, [0, 0, 0]);
  const pb = apply(b, [0, 0, 0]);
  assert.ok(Math.abs(Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) - 36.5) < 1e-6);
});

test('tileset json structure', () => {
  const ts = tilesetJson({
    transform: enuToEcef(0, 0, 0),
    children: [{ uri: 'tiles/a.glb', min: [0, 0, 0], max: [10, 20, 30] }, { uri: 'tiles/b.glb', min: [-10, 0, 0], max: [0, 5, 5] }]
  });
  assert.equal(ts.asset.version, '1.1');
  assert.equal(ts.root.children.length, 2);
  assert.deepEqual(ts.root.children[0].boundingVolume.box, [5, 10, 15, 5, 0, 0, 0, 10, 0, 0, 0, 15]);
  assert.deepEqual(ts.root.boundingVolume.box.slice(0, 3), [0, 10, 15]);
  assert.equal(ts.root.refine, 'ADD');
});

test('zip: valid structure and CRCs', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [{ name: 'tileset.json', data: new TextEncoder().encode('{}') }, { name: 'tiles/x.glb', data: new Uint8Array([1, 2, 3]) }];
  const zip = zipStore(files);
  const dv = new DataView(zip.buffer);
  assert.equal(dv.getUint32(0, true), 0x04034b50);
  const end = zip.length - 22;
  assert.equal(dv.getUint32(end, true), 0x06054b50);
  assert.equal(dv.getUint16(end + 10, true), 2);
  const cdOffset = dv.getUint32(end + 16, true);
  assert.equal(dv.getUint32(cdOffset, true), 0x02014b50);
});
