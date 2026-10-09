// @ts-check
// Geography helpers free of viewer state: scene axes, compass and solar
// directions, GeoJSON polygon access, bounds and footprint area/centroid in
// projected metres.
import * as THREE from 'three';

// Match the viewer's local X axis to the QGIS map orientation.
export const LOCAL_X_SIGN = -1;

/* Solar position via simplified NOAA formula.
 * timeHours = local solar time (0-24), dayOfYear = 1-365, latitudeDeg = WGS84 lat.
 * Returns elevation + azimuth in RADIANS. Azimuth follows compass convention:
 * 0 = North, π/2 = East, π = South, 3π/2 = West. */
export function solarPosition(timeHours, dayOfYear, latitudeDeg) {
  const declRad = THREE.MathUtils.degToRad(23.45) *
    Math.sin(THREE.MathUtils.degToRad((360 / 365) * (284 + dayOfYear)));
  const hourAngleRad = THREE.MathUtils.degToRad(15 * (timeHours - 12));
  const latRad = THREE.MathUtils.degToRad(latitudeDeg);
  const sinElev = Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinElev)));
  const cosElev = Math.cos(elevation) || 1e-9;
  const cosLat = Math.cos(latRad) || 1e-9;
  const cosAz = (Math.sin(declRad) - Math.sin(elevation) * Math.sin(latRad)) / (cosElev * cosLat);
  const azRaw = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  const azimuth = hourAngleRad > 0 ? (2 * Math.PI - azRaw) : azRaw;
  return { elevation, azimuth };
}

// Unit vector towards a compass bearing (radians clockwise from north) at an
// elevation above the horizon, in scene axes: north is +Z (northing) and east
// is LOCAL_X_SIGN * X, as metersToLocal places the data. (The sun used to
// assume north = -Z and east = +X, which put it on the opposite side of the
// sky: morning shadows fell east and noon shadows south.)
export function compassDirection(azimuth, elevation = 0) {
  const c = Math.cos(elevation);
  return new THREE.Vector3(LOCAL_X_SIGN * Math.sin(azimuth) * c, Math.sin(elevation), Math.cos(azimuth) * c);
}

export function getPolygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  return [];
}

export function geometryBounds(features) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of features) {
    if (!f.geometry) continue;
    const type = f.geometry.type;
    // Handle Polygon / MultiPolygon
    if (type === 'Polygon' || type === 'MultiPolygon') {
      for (const poly of getPolygonRings(f.geometry)) {
        for (const ring of poly) {
          for (const c of ring) {
            minX = Math.min(minX, c[0]);
            minY = Math.min(minY, c[1]);
            maxX = Math.max(maxX, c[0]);
            maxY = Math.max(maxY, c[1]);
          }
        }
      }
    }
    // Handle LineString
    else if (type === 'LineString') {
      for (const c of f.geometry.coordinates) {
        minX = Math.min(minX, c[0]);
        minY = Math.min(minY, c[1]);
        maxX = Math.max(maxX, c[0]);
        maxY = Math.max(maxY, c[1]);
      }
    }
    // Handle MultiLineString
    else if (type === 'MultiLineString') {
      for (const line of f.geometry.coordinates) {
        for (const c of line) {
          minX = Math.min(minX, c[0]);
          minY = Math.min(minY, c[1]);
          maxX = Math.max(maxX, c[0]);
          maxY = Math.max(maxY, c[1]);
        }
      }
    }
    // Handle Point
    else if (type === 'Point') {
      const c = f.geometry.coordinates;
      minX = Math.min(minX, c[0]);
      minY = Math.min(minY, c[1]);
      maxX = Math.max(maxX, c[0]);
      maxY = Math.max(maxY, c[1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

export function mergeBounds(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

export function pointInLocalPolys(x, z, localPolys) {
  for (const localRings of localPolys) {
    const outer = localRings[0];
    if (!outer || outer.length < 3) continue;
    if (pointInRingLocal(x, z, outer)) {
      let inHole = false;
      for (let h = 1; h < localRings.length; h++) {
        if (pointInRingLocal(x, z, localRings[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

export function polygonCentroidGeo(ring) {
  if (!ring?.length) return null;
  const sum = ring.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

export function polygonAreaGeo(ring) {
  if (!ring?.length) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(sum) * 0.5;
}

export function pointInRingLocal(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], zi = ring[i][1];
    const xj = ring[j][0], zj = ring[j][1];
    const crosses = (zi > z) !== (zj > z);
    if (crosses) {
      const xAtZ = ((xj - xi) * (z - zi)) / ((zj - zi) || 1e-9) + xi;
      if (x < xAtZ) inside = !inside;
    }
  }
  return inside;
}
