// @ts-check
// CityJSON 2.0 writer for buildings: LoD1 solids (footprint extruded from
// its ground height to its roof height) in the export CRS, with the source
// attributes. Pure data in, plain object out, so it is tested in node.
//
// Surfaces follow the CityJSON/CityGML rule: seen from outside the solid,
// outer rings are counter-clockwise (normals point out), inner rings
// clockwise.

function ringSignedArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

// Open ring without the closing duplicate or repeated points.
function cleanRing(ring) {
  const out = [];
  for (const p of ring || []) {
    if (!p || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) out.push([p[0], p[1]]);
  }
  if (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < 1e-6 && Math.abs(out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  return out.length >= 3 ? out : null;
}

/**
 * @param buildings [{ id, polygons: [[outerRing, ...holes]], base, height,
 *                    attributes }] coordinates in the export CRS (metres),
 *                    base = ground elevation, height = building height
 * @param crs       e.g. 'EPSG:32636' (only EPSG codes become a URL)
 * @param precision vertex resolution in metres (default 1 mm)
 */
export function buildCityJson(buildings, { crs = '', precision = 0.001, title = 'PlanX 3D City' } = {}) {
  const verts = [];
  const index = new Map();
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  // First pass: real coordinates, to fix the transform's translate.
  for (const b of buildings) {
    for (const poly of b.polygons || []) {
      for (const ring of poly) {
        for (const p of ring || []) {
          if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
          min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], b.base)];
          max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], b.base + b.height)];
        }
      }
    }
  }
  if (!Number.isFinite(min[0])) min = [0, 0, 0];
  const translate = min.map((v) => Math.floor(v));
  const vertex = (x, y, z) => {
    const q = [Math.round((x - translate[0]) / precision), Math.round((y - translate[1]) / precision), Math.round((z - translate[2]) / precision)];
    const key = q.join(',');
    let i = index.get(key);
    if (i === undefined) {
      i = verts.length;
      verts.push(q);
      index.set(key, i);
    }
    return i;
  };

  const cityObjects = {};
  for (const b of buildings) {
    if (!(b.height > 0)) continue;
    const solids = [];
    for (const poly of b.polygons || []) {
      const rings = poly.map(cleanRing).filter(Boolean);
      if (!rings.length) continue;
      // Outer counter-clockwise from above, holes clockwise.
      const outer = ringSignedArea(rings[0]) < 0 ? rings[0].slice().reverse() : rings[0];
      const holes = rings.slice(1).map((r) => (ringSignedArea(r) > 0 ? r.slice().reverse() : r));
      const z0 = b.base;
      const z1 = b.base + b.height;
      const bottom = (r) => r.map(([x, y]) => vertex(x, y, z0));
      const top = (r) => r.map(([x, y]) => vertex(x, y, z1));
      const shell = [];
      // Roof: as seen from above (outside) the outer ring is CCW.
      shell.push([top(outer), ...holes.map(top)]);
      // Floor: seen from below, so every ring is reversed.
      shell.push([bottom(outer).reverse(), ...holes.map((h) => bottom(h).reverse())]);
      // Walls along every ring edge: bottom a, bottom b, top b, top a is
      // counter-clockwise from outside for a CCW outer ring and for a CW
      // hole (whose outside is the courtyard).
      for (const r of [outer, ...holes]) {
        for (let i = 0; i < r.length; i++) {
          const a = r[i];
          const c = r[(i + 1) % r.length];
          shell.push([[vertex(a[0], a[1], z0), vertex(c[0], c[1], z0), vertex(c[0], c[1], z1), vertex(a[0], a[1], z1)]]);
        }
      }
      solids.push([shell]);
    }
    if (!solids.length) continue;
    const geometry = solids.length === 1
      ? { type: 'Solid', lod: '1', boundaries: solids[0] }
      : { type: 'MultiSolid', lod: '1', boundaries: solids };
    cityObjects[String(b.id)] = { type: 'Building', attributes: cleanAttributes(b.attributes), geometry: [geometry] };
  }

  const epsg = /^EPSG:(\d+)$/i.exec(String(crs || '').trim());
  const metadata = {
    title,
    geographicalExtent: [...min, ...max].map((v) => Math.round(v * 1000) / 1000)
  };
  if (epsg) metadata.referenceSystem = `https://www.opengis.net/def/crs/EPSG/0/${epsg[1]}`;
  return {
    type: 'CityJSON',
    version: '2.0',
    transform: { scale: [precision, precision, precision], translate },
    metadata,
    CityObjects: cityObjects,
    vertices: verts
  };
}

// CityJSON attributes are plain JSON values; drop empty and nested ones.
function cleanAttributes(attrs) {
  const out = {};
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    if (typeof v === 'object') continue;
    out[k] = v;
  }
  return out;
}
