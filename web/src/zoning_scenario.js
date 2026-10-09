// @ts-check
// Zoning "what if" rules: the building capacity of a plot under site
// coverage, floor area ratio (FAR), maximum height and setback limits, and
// scenario totals against the existing buildings. Pure numbers (no three.js)
// so the rules are tested in node; the viewer does the geometry.

/**
 * @typedef {{ coverage: number, far: number, maxHeight: number, floorHeight: number }} ZoningRules
 *   coverage 0-1, maxHeight and floorHeight in metres
 * @typedef {{ footprint: number, floors: number, height: number, gfa: number, limitedBy: string }} PlotCapacity
 *   limitedBy: 'coverage' | 'setback' (footprint) and 'far' | 'height'
 *   (floors), joined with '+', or 'none' when nothing can be built
 */

/**
 * Capacity of one plot.
 * @param {number} plotArea m² of the plot
 * @param {number} buildableArea m² left inside the setback (<= plotArea)
 * @param {ZoningRules} rules
 * @returns {PlotCapacity}
 */
export function plotCapacity(plotArea, buildableArea, rules) {
  const coverage = clamp(rules.coverage, 0, 1);
  const far = Math.max(0, rules.far || 0);
  const floorHeight = Math.max(2, rules.floorHeight || 3);
  const maxFloorsByHeight = Math.floor((Math.max(0, rules.maxHeight || 0) + 1e-9) / floorHeight);
  const coverageArea = coverage * Math.max(0, plotArea);
  const setbackArea = Math.max(0, Math.min(plotArea, buildableArea));
  const footprint = Math.min(coverageArea, setbackArea);
  if (footprint <= 0.5 || maxFloorsByHeight < 1 || far <= 0) {
    return { footprint: 0, floors: 0, height: 0, gfa: 0, limitedBy: 'none' };
  }
  const maxGfa = far * plotArea;
  const floorsByFar = Math.floor(maxGfa / footprint + 1e-9);
  let floors = Math.min(floorsByFar, maxFloorsByHeight);
  let fp = footprint;
  if (floors < 1) {
    // FAR allows less than one full floor on the whole footprint: build one
    // floor on the share of the footprint that FAR permits.
    floors = 1;
    fp = maxGfa;
  }
  const footprintLimit = coverageArea <= setbackArea ? 'coverage' : 'setback';
  const floorLimit = floorsByFar <= maxFloorsByHeight ? 'far' : 'height';
  return {
    footprint: fp,
    floors,
    height: floors * floorHeight,
    gfa: fp * floors,
    limitedBy: `${footprintLimit}+${floorLimit}`
  };
}

/**
 * Scenario totals against the existing state.
 * plots: [{ area, existingGfa, existingFootprint, capacity }]
 * existingPopulation: people living in the existing buildings (for the
 * people-per-m² ratio), or null when unknown.
 */
export function scenarioTotals(plots, existingPopulation = null) {
  const t = { plotArea: 0, existingGfa: 0, existingFootprint: 0, gfa: 0, footprint: 0, plots: plots.length };
  for (const p of plots) {
    t.plotArea += p.area;
    t.existingGfa += p.existingGfa;
    t.existingFootprint += p.existingFootprint;
    t.gfa += p.capacity.gfa;
    t.footprint += p.capacity.footprint;
  }
  const ratio = (a, b) => (b > 0 ? a / b : 0);
  t.existingFar = ratio(t.existingGfa, t.plotArea);
  t.far = ratio(t.gfa, t.plotArea);
  t.existingCoverage = ratio(t.existingFootprint, t.plotArea);
  t.coverage = ratio(t.footprint, t.plotArea);
  t.gfaChange = t.gfa - t.existingGfa;
  const perM2 = existingPopulation > 0 && t.existingGfa > 0 ? existingPopulation / t.existingGfa : null;
  t.existingPopulation = existingPopulation > 0 ? existingPopulation : null;
  t.population = perM2 ? Math.round(t.gfa * perM2) : null;
  return t;
}

/** Colour key of a plot: how its capacity compares with what stands there. */
export function capacityChange(existingGfa, gfa) {
  if (gfa <= 0) return existingGfa > 0 ? 'loss' : 'none';
  if (existingGfa <= 0) return 'gain';
  const r = gfa / existingGfa;
  if (r > 1.1) return 'gain';
  if (r < 0.9) return 'loss';
  return 'same';
}

/** Shoelace area of a ring of [x, y] points (absolute value). */
export function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

/** Area of a polygon given as rings (outer first, holes after). */
export function polygonArea(rings) {
  if (!rings?.length) return 0;
  let a = ringArea(rings[0]);
  for (let i = 1; i < rings.length; i++) a -= ringArea(rings[i]);
  return Math.max(0, a);
}

/** Even-odd point in polygon test on [x, y] rings. */
export function pointInRings(x, y, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function clamp(v, lo, hi) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
