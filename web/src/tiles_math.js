// @ts-check
// Geodesy and packaging for the OGC 3D Tiles export, free of three.js so it
// runs in node tests.
//
// The viewer works in projected metres around a scene centre. The exporter
// writes three WGS84 control points (centre, 1 km east, 1 km north in the
// export CRS); an affine fit through them places the scene centre on the
// globe and gives the rotation and scale between grid axes and true
// east/north there (meridian convergence and the projection's scale factor).

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;
const DEG = Math.PI / 180;

/** Exact affine map (x, y) -> [lon, lat] through three control points. */
export function fitAffine(controlPoints) {
  if (!Array.isArray(controlPoints) || controlPoints.length < 3) return null;
  const [p0, p1, p2] = controlPoints;
  const [x0, y0] = p0.xy;
  const [x1, y1] = p1.xy;
  const [x2, y2] = p2.xy;
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-9) return null;
  // Solve each output separately: v = v0 + a (x - x0) + b (y - y0).
  const solve = (k) => {
    const v0 = p0.lonLat[k];
    const d1 = p1.lonLat[k] - v0;
    const d2 = p2.lonLat[k] - v0;
    const a = (d1 * (y2 - y0) - d2 * (y1 - y0)) / det;
    const b = ((x1 - x0) * d2 - (x2 - x0) * d1) / det;
    return { v0, a, b };
  };
  const lon = solve(0);
  const lat = solve(1);
  const map = (x, y) => [
    lon.v0 + lon.a * (x - x0) + lon.b * (y - y0),
    lat.v0 + lat.a * (x - x0) + lat.b * (y - y0)
  ];
  map.partials = { dLon: [lon.a, lon.b], dLat: [lat.a, lat.b] };
  return map;
}

/** WGS84 geodetic (degrees, metres) to ECEF metres. */
export function geodeticToEcef(lon, lat, h = 0) {
  const sl = Math.sin(lat * DEG);
  const cl = Math.cos(lat * DEG);
  const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sl * sl);
  return [
    (n + h) * cl * Math.cos(lon * DEG),
    (n + h) * cl * Math.sin(lon * DEG),
    (n * (1 - WGS84_E2) + h) * sl
  ];
}

/**
 * Column-major 4x4 matrix from local east-north-up metres at (lon, lat, h)
 * to ECEF, as 3D Tiles expects in tile.transform.
 */
export function enuToEcef(lon, lat, h = 0) {
  const sLon = Math.sin(lon * DEG);
  const cLon = Math.cos(lon * DEG);
  const sLat = Math.sin(lat * DEG);
  const cLat = Math.cos(lat * DEG);
  const east = [-sLon, cLon, 0];
  const north = [-sLat * cLon, -sLat * sLon, cLat];
  const up = [cLat * cLon, cLat * sLon, sLat];
  const o = geodeticToEcef(lon, lat, h);
  return [...east, 0, ...north, 0, ...up, 0, ...o, 1];
}

/**
 * Grid axes in local east/north metres at a point: gridEast/gridNorth are
 * where one metre along the projected x / y axis goes. Uses the affine
 * partial derivatives and the ellipsoid's radii of curvature.
 */
export function gridToEnu(affine, lat) {
  const sl = Math.sin(lat * DEG);
  const w = Math.sqrt(1 - WGS84_E2 * sl * sl);
  const n = WGS84_A / w; // prime vertical radius
  const m = (WGS84_A * (1 - WGS84_E2)) / (w * w * w); // meridian radius
  const eastPerDeg = n * Math.cos(lat * DEG) * DEG;
  const northPerDeg = m * DEG;
  const { dLon, dLat } = affine.partials;
  return {
    gridEast: [dLon[0] * eastPerDeg, dLat[0] * northPerDeg],
    gridNorth: [dLon[1] * eastPerDeg, dLat[1] * northPerDeg]
  };
}

/** Column-major 4x4 product a * b. */
export function mat4Multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

/**
 * Root transform of the tileset: tile content is in projected-grid metres
 * relative to the scene centre (x = grid east, y = grid north, z = up after
 * the glTF y-up conversion), placed at the centre's lon/lat and height.
 */
export function rootTransform(georeference, centreX, centreY, heightOffset = 0) {
  const affine = fitAffine(georeference?.controlPoints);
  if (!affine) return null;
  const [lon, lat] = affine(centreX, centreY);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const { gridEast, gridNorth } = gridToEnu(affine, lat);
  // Grid -> ENU (rotation by the meridian convergence, times the scale
  // factor), then ENU -> ECEF. Heights are kept as they are, plus the
  // offset (e.g. geoid undulation when the DEM is above sea level).
  const gridToLocal = [
    gridEast[0], gridEast[1], 0, 0,
    gridNorth[0], gridNorth[1], 0, 0,
    0, 0, 1, 0,
    0, 0, heightOffset, 1
  ];
  return { lon, lat, transform: mat4Multiply(enuToEcef(lon, lat, 0), gridToLocal) };
}

/**
 * tileset.json for one root with one child tile per content file.
 * children: [{ uri, min: [x, y, z], max: [x, y, z] }] in tile-local metres
 * (z up). A box volume is centre + three half-axis vectors.
 */
export function tilesetJson({ transform, children, generator = 'PlanX 3D City' }) {
  const box = (min, max) => {
    const c = min.map((v, i) => (v + max[i]) / 2);
    const h = min.map((v, i) => Math.max(0.01, (max[i] - v) / 2));
    return [c[0], c[1], c[2], h[0], 0, 0, 0, h[1], 0, 0, 0, h[2]];
  };
  const all = children.reduce((acc, ch) => ({
    min: acc.min.map((v, i) => Math.min(v, ch.min[i])),
    max: acc.max.map((v, i) => Math.max(v, ch.max[i]))
  }), { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
  const diag = Math.hypot(all.max[0] - all.min[0], all.max[1] - all.min[1], all.max[2] - all.min[2]);
  const round = (a) => a.map((v) => Math.round(v * 1000) / 1000);
  return {
    asset: { version: '1.1', generator },
    geometricError: Math.max(10, diag / 4),
    root: {
      transform: transform.map((v) => Number(v.toPrecision(15))),
      boundingVolume: { box: round(box(all.min, all.max)) },
      geometricError: Math.max(10, diag / 8),
      refine: 'ADD',
      children: children.map((ch) => ({
        boundingVolume: { box: round(box(ch.min, ch.max)) },
        geometricError: 0,
        content: { uri: ch.uri }
      }))
    }
  };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Uncompressed ("stored") ZIP of [{ name, data: Uint8Array }]. */
export function zipStore(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}
