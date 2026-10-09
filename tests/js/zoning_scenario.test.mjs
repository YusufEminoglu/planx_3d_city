// node --test tests/js/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { capacityChange, plotCapacity, pointInRings, polygonArea, scenarioTotals } from '../../web/src/zoning_scenario.js';

const rules = { coverage: 0.4, far: 2.0, maxHeight: 30, floorHeight: 3 };

test('coverage and FAR limit a large plot', () => {
  // 1000 m² plot, generous setback: footprint 400 m², FAR 2 -> 2000 m² -> 5 floors.
  const c = plotCapacity(1000, 900, rules);
  assert.equal(c.footprint, 400);
  assert.equal(c.floors, 5);
  assert.equal(c.gfa, 2000);
  assert.equal(c.height, 15);
  assert.equal(c.limitedBy, 'coverage+far');
});

test('height limits floors before FAR does', () => {
  const c = plotCapacity(1000, 900, { ...rules, far: 10, maxHeight: 12 });
  assert.equal(c.floors, 4);
  assert.equal(c.gfa, 1600);
  assert.equal(c.limitedBy, 'coverage+height');
});

test('setback can be tighter than coverage', () => {
  const c = plotCapacity(1000, 250, rules);
  assert.equal(c.footprint, 250);
  assert.equal(c.floors, 8);
  assert.equal(c.limitedBy, 'setback+far');
});

test('FAR below one floor builds one partial floor', () => {
  const c = plotCapacity(1000, 900, { ...rules, far: 0.2 });
  assert.equal(c.floors, 1);
  assert.equal(c.footprint, 200);
  assert.equal(c.gfa, 200);
});

test('nothing buildable', () => {
  assert.equal(plotCapacity(1000, 0, rules).gfa, 0);
  assert.equal(plotCapacity(1000, 900, { ...rules, maxHeight: 2 }).limitedBy, 'none');
  assert.equal(plotCapacity(1000, 900, { ...rules, far: 0 }).gfa, 0);
});

test('totals and population estimate', () => {
  const plots = [
    { area: 1000, existingGfa: 1000, existingFootprint: 300, capacity: plotCapacity(1000, 900, rules) },
    { area: 500, existingGfa: 500, existingFootprint: 200, capacity: plotCapacity(500, 400, rules) }
  ];
  const t = scenarioTotals(plots, 60);
  assert.equal(t.existingGfa, 1500);
  assert.equal(t.gfa, 3000);
  assert.equal(t.far, 2);
  assert.equal(t.existingFar, 1);
  assert.equal(t.population, 120);
  assert.equal(scenarioTotals(plots, null).population, null);
});

test('change classes', () => {
  assert.equal(capacityChange(100, 200), 'gain');
  assert.equal(capacityChange(100, 50), 'loss');
  assert.equal(capacityChange(100, 105), 'same');
  assert.equal(capacityChange(0, 50), 'gain');
  assert.equal(capacityChange(50, 0), 'loss');
});

test('polygon helpers', () => {
  const sq = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const hole = [[2, 2], [4, 2], [4, 4], [2, 4]];
  assert.equal(polygonArea([sq]), 100);
  assert.equal(polygonArea([sq, hole]), 96);
  assert.ok(pointInRings(5, 5, [sq, hole]));
  assert.ok(!pointInRings(3, 3, [sq, hole]));
  assert.ok(!pointInRings(11, 5, [sq]));
});
