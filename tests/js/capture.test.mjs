// node --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureSize, captureTiles, decodeView, encodeView, hashWithView, viewFromHash } from '../../web/src/capture.js';

const view = { position: [12.345, 80.04, -310.96], target: [0, 1.25, -5], fov: 58, timeOfDay: 17.5 };

test('view round trip at 0.1 m', () => {
  const back = decodeView(encodeView(view));
  assert.deepEqual(back, { position: [12.3, 80, -311], target: [0, 1.3, -5], fov: 58, timeOfDay: 17.5 });
});
test('malformed views are rejected', () => {
  for (const bad of ['', '1,2,3', '1,2,3,4,5,6,abc', '1,2,3,4,5,6,0', '1,2,3,4,5,6,200', null]) {
    assert.equal(decodeView(bad), null, String(bad));
  }
  assert.equal(decodeView('1,2,3,4,5,6,60,99').timeOfDay, undefined);
});
test('hash keeps other parameters', () => {
  const hash = hashWithView('#tour=a&x=1', view);
  assert.match(hash, /^#tour=a&x=1&view=12\.3,80,-311,/);
  assert.deepEqual(viewFromHash(hash).position, [12.3, 80, -311]);
  assert.equal(viewFromHash('#nothing=1'), null);
});
test('tiles cover the image exactly once', () => {
  const tiles = captureTiles(7680, 4320, 1100, 700);
  let area = 0;
  for (const t of tiles) {
    assert.ok(t.width > 0 && t.height > 0 && t.x + t.width <= 7680 && t.y + t.height <= 4320);
    area += t.width * t.height;
  }
  assert.equal(area, 7680 * 4320);
  assert.equal(tiles.length, 7 * 7);
});
test('capture sizes keep the aspect ratio', () => {
  assert.deepEqual(captureSize('8k', 16 / 9, 1100), { width: 7680, height: 4320 });
  assert.deepEqual(captureSize('2x', 2, 1100), { width: 2200, height: 1100 });
  assert.deepEqual(captureSize('screen', 1.5, 900), { width: 900, height: 600 });
});
