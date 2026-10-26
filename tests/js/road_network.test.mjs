import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadNetwork, nextLineAtEnd, polylineLength } from '../../web/src/road_network.js';

test('polyline length', () => {
  assert.equal(polylineLength([[0, 0], [3, 4], [3, 10]]), 11);
});

test('four-way junction: clearance from the widest crossing road, links to the others', () => {
  const lines = [
    { points: [[-50, 0], [0, 0]], halfWidth: 4 },
    { points: [[0, 0], [50, 0]], halfWidth: 4 },
    { points: [[0, -50], [0.4, 0.3]], halfWidth: 6 },
    { points: [[0, 0], [0, 50]], halfWidth: 3 }
  ];
  const net = buildRoadNetwork(lines);
  assert.equal(net[0].end.junction, true);
  assert.equal(net[0].end.clear, 6.5);
  assert.equal(net[2].end.clear, 4.5);
  assert.equal(net[0].start.junction, false);
  assert.equal(net[0].end.links.length, 3);
  assert.deepEqual(net[0].end.links.find((l) => l.line === 2), { line: 2, at: net[2].length, dir: -1 });
});

test('two ends only continue the street', () => {
  const net = buildRoadNetwork([
    { points: [[0, 0], [10, 0]], halfWidth: 4 },
    { points: [[10, 0], [20, 5]], halfWidth: 4 }
  ]);
  assert.equal(net[0].end.junction, false);
  assert.equal(net[0].end.clear, 0);
  assert.deepEqual(nextLineAtEnd(net, 0, 1, 0.3), { line: 1, at: 0, dir: 1 });
  assert.deepEqual(nextLineAtEnd(net, 1, -1, 0.3), { line: 0, at: 10, dir: -1 });
});

test('dead end on the side of another road is a T junction', () => {
  const net = buildRoadNetwork([
    { points: [[-40, 0], [40, 0]], halfWidth: 5 },
    { points: [[10, 30], [10, 4]], halfWidth: 3 }
  ]);
  assert.equal(net[1].end.junction, true);
  assert.equal(net[1].end.clear, 1.5);
  assert.equal(net[1].end.links[0].line, 0);
  assert.equal(net[1].end.links[0].at, 50);
  assert.equal(net[1].start.junction, false);
});

test('true dead end turns around', () => {
  const net = buildRoadNetwork([{ points: [[0, 0], [10, 0]], halfWidth: 4 }]);
  assert.deepEqual(nextLineAtEnd(net, 0, 1, 0.9), { line: 0, at: 10, dir: -1 });
  assert.deepEqual(nextLineAtEnd(net, 0, -1, 0.9), { line: 0, at: 0, dir: 1 });
});

test('closed loop drives on', () => {
  const net = buildRoadNetwork([{ points: [[0, 0], [10, 0], [10, 10], [0, 0]], halfWidth: 4 }]);
  assert.deepEqual(nextLineAtEnd(net, 0, 1, 0.5), { line: 0, at: 0, dir: 1 });
});

test('side street opens the sidewalk on its side of the main road', () => {
  const net = buildRoadNetwork([
    { points: [[-40, 0], [40, 0]], halfWidth: 5 },
    { points: [[10, 30], [10, 4]], halfWidth: 3 },
    { points: [[-10, -30], [-10, -4]], halfWidth: 2 }
  ]);
  // Line 0 runs +x; its right side (-dz, dx) = (0, 1) is +z.
  assert.deepEqual(net[0].gaps, [{ from: 46, to: 54, side: 1 }, { from: 27, to: 33, side: -1 }]);
});

test('accept filters car-free and wrong-way streets', () => {
  const net = buildRoadNetwork([
    { points: [[-50, 0], [0, 0]], halfWidth: 4 },
    { points: [[0, 0], [50, 0]], halfWidth: 4 },
    { points: [[0, 0], [0, 50]], halfWidth: 3 }
  ]);
  const noLine1 = (line) => line !== 1;
  assert.deepEqual(nextLineAtEnd(net, 0, 1, 0.99, noLine1), { line: 2, at: 0, dir: 1 });
  assert.deepEqual(nextLineAtEnd(net, 0, 1, 0.5, () => false), { line: 0, at: 50, dir: -1 });
});

test('roads crossing without a node get a junction on both lines', () => {
  const net = buildRoadNetwork([
    { points: [[-50, 0], [50, 0]], halfWidth: 4 },
    { points: [[10, -50], [10, 20], [10, 50]], halfWidth: 6 }
  ]);
  assert.deepEqual(net[0].junctions, [{ at: 60, clear: 6.5 }]);
  assert.deepEqual(net[1].junctions, [{ at: 50, clear: 4.5 }]);
  assert.equal(net[0].start.junction, false);
});

test('junction list includes junction ends in order', () => {
  const net = buildRoadNetwork([
    { points: [[-50, 0], [0, 0]], halfWidth: 4 },
    { points: [[0, 0], [50, 0]], halfWidth: 4 },
    { points: [[0, 0], [0, 50]], halfWidth: 3 },
    { points: [[-30, -20], [-30, 20]], halfWidth: 2 }
  ]);
  assert.deepEqual(net[0].junctions, [{ at: 20, clear: 2.5 }, { at: 50, clear: 4.5 }]);
});
