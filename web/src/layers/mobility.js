// Mobility: roads (asphalt with painted markings, curbs and paved
// sidewalks, amenity and access colouring), pedestrian paths and bike lanes,
// and the traffic on them: instanced cars, buses and taxis driving in lanes
// through the road network, walking people and bicycles.
import * as THREE from 'three';
import { assetColor } from '../catalog.js';
import { getPolygonRings } from '../geo.js';
import { propFirst, parseNumberProp, featureLabelText, normalizeAccessText, keywordList } from '../props.js';
import { colorObjectFromHex, rgbaFromColor, mixedColor, rendererMaxAnisotropy } from '../textures.js';
import { buildRoadNetwork, nextLineAtEnd } from '../road_network.js';
import {
  ASPHALT_TILE_M, PAVER_TILE_M, createAsphaltSurface, createPaverSurface, createRoadMaterial, setRoadMarkingFlags
} from '../road_surface.js';
import {
  VEHICLE_TYPES, createVehicleGeometry, createVehicleMaterial, setVehicleNight, createPersonGeometry,
  createPersonMaterial, setPeopleTime, createBlobShadowGeometry, createBlobShadowMaterial, createHeadlightPoolMaterial
} from '../traffic_models.js';
import { state } from '../core/state.js';
import {
  roadGroup, carGroup, bikeLaneGroup, bikeGroup, pedestrianGroup, sidewalkGroup, pedestrianPathGroup,
  crosswalkGroup, LAYER, camera
} from '../core/scene.js';
import { assetPoolVariants, mappedField, buildingFunctionValue, settings } from '../core/settings.js';
import { textureFromSet, metersToLocal, EMPTY_GEOJSON } from '../core/data.js';
import { clearGroup, shapeFromLocalPolygon, isSceneBuildStale } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

function roadAllowsCars(feature) {
  const access = state.projectManifest?.roadAccess;
  const field = access?.field;
  if (!field) return true;
  const props = feature?.properties || {};
  const raw = props[field];
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  const value = normalizeAccessText(raw);
  const noCar = keywordList(access.noCarKeywords || ['pedestrian', 'foot', 'walk', 'path']);
  const vehicle = keywordList(access.vehicleKeywords || ['vehicle', 'car', 'motor_vehicle']);
  const hasNoCar = noCar.some((kw) => value.includes(kw));
  const hasVehicle = vehicle.some((kw) => value.includes(kw));
  return !hasNoCar || hasVehicle;
}

function roadModeText(feature) {
  const access = state.projectManifest?.roadAccess;
  const field = access?.field;
  const props = feature?.properties || {};
  const hierarchy = mappedField('road_hierarchy_field');
  if (hierarchy) return featureLabelText(props, [hierarchy], '');
  return field ? featureLabelText(props, [field], '') : featureLabelText(props, ['road_type', 'highway', 'type', 'access', 'mode'], '');
}

function estimateAmenityPoints() {
  const points = [];
  const data = state.layerDataCache || {};
  const furniture = data.furniture || {};
  for (const collection of [furniture.busstops, furniture.lights, data.treesFc]) {
    for (const f of collection?.features || []) {
      if (f.geometry?.type === 'Point') points.push(f.geometry.coordinates);
    }
  }
  for (const f of data.buildingsFc?.features || []) {
    const fn = normalizeAccessText(buildingFunctionValue(f.properties || {}));
    if (!/(educat|school|park|health|commerc|retail|social|cultur|sport|green|amenit)/.test(fn)) continue;
    const rings = getPolygonRings(f.geometry);
    const outer = rings?.[0]?.[0];
    if (!outer?.length) continue;
    const c = outer.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
    points.push([c[0] / outer.length, c[1] / outer.length]);
  }
  return points;
}

function featureMidpoint(feature) {
  const coords = feature?.geometry?.coordinates || [];
  if (!coords.length) return null;
  const mid = coords[Math.floor(coords.length / 2)];
  return Array.isArray(mid) ? mid : null;
}

function minDistanceToPoints(point, points) {
  if (!point || !points.length) return Infinity;
  let min = Infinity;
  for (const p of points) {
    const dx = point[0] - p[0];
    const dy = point[1] - p[1];
    min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
  }
  return min;
}

function roadVisualColor(feature, amenityPoints = []) {
  if (settings.roadColorMode === 'Amenity distance') {
    const d = minDistanceToPoints(featureMidpoint(feature), amenityPoints);
    const t = Math.max(0, Math.min(1, d / 450));
    return new THREE.Color(0x16a34a).lerp(new THREE.Color(0x9ca3af), t);
  }
  if (settings.roadColorMode === 'Access / traffic') {
    if (!roadAllowsCars(feature)) return new THREE.Color(0x0ea5e9);
    const mode = normalizeAccessText(roadModeText(feature));
    if (/(arterial|boulevard|motorway|primary|trunk)/.test(mode)) return new THREE.Color(0xef4444);
    if (/(avenue|collector|secondary)/.test(mode)) return new THREE.Color(0xf59e0b);
    return new THREE.Color(0x64748b);
  }
  return new THREE.Color(settings.roadColor);
}

function featureRoadWidth(feature) {
  const widthField = mappedField('road_width_field');
  if (widthField && feature?.properties) {
    const raw = feature.properties[widthField];
    const value = parseFloat(raw);
    if (Number.isFinite(value) && value > 0) {
      // Right-of-way width minus ~1.5 m sidewalk on each side, clamped to 5-20 m road surface.
      return Math.max(5, Math.min(20, value - 3));
    }
  }
  return Math.max(5, Math.min(20, settings.roadWidth));
}

const bikeLaneTextureCache = new Map();
function createBikeLaneTexture(baseColor = settings.bikeLaneColor) {
  const base = colorObjectFromHex(baseColor, '#16a34a');
  const cacheKey = `bike:${base.getHexString()}`;
  if (bikeLaneTextureCache.has(cacheKey)) return bikeLaneTextureCache.get(cacheKey);

  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = rgbaFromColor(mixedColor(base, 0xffffff, 0.65), 0.45);
  ctx.lineWidth = 4;
  for (let y = 16; y < c.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(c.width - 16, y);
    ctx.stroke();
  }
  ctx.strokeStyle = rgbaFromColor(mixedColor(base, 0x000000, 0.35), 0.18);
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, c.width - 6, c.height - 6);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 10);
  t.colorSpace = THREE.SRGBColorSpace;
  bikeLaneTextureCache.set(cacheKey, t);
  return t;
}

function bikeLaneFeatureWidth(feature) {
  const width = parseNumberProp(
    feature?.properties || {},
    ['planx_width', 'bike_lane_width', 'cycleway_width', 'width'],
    settings.bikeLaneWidth
  );
  return Math.max(1.5, Math.min(5, width || 3));
}

function createBikeLaneMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createBikeLaneTexture(settings.bikeLaneColor),
    roughness: 0.88,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5
  });
}

function createBikeLaneCurve(coords, closed = false) {
  const xzPts = [];
  for (const c of coords || []) {
    if (!c || c.length < 2) continue;
    const [x, z] = metersToLocal(c[0], c[1]);
    xzPts.push(new THREE.Vector3(x, 0, z));
  }
  if (xzPts.length < 2) return null;
  const xzCurve = new THREE.CatmullRomCurve3(xzPts, closed, 'centripetal');
  const laneLen = Math.max(1, xzCurve.getLength());
  const nSamples = Math.max(xzPts.length, Math.ceil(laneLen / 3) + 1);
  const terrainPts = [];
  for (let i = 0; i <= nSamples; i++) {
    const tp = xzCurve.getPointAt(i / nSamples);
    tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.bikeLane + 0.045;
    terrainPts.push(tp);
  }
  return new THREE.CatmullRomCurve3(terrainPts, closed, 'centripetal');
}

function buildBikeLaneStrip(coords, width, mat, buildToken) {
  const curve = createBikeLaneCurve(coords, false);
  if (!curve) return;
  state.bikeLaneCurves.push(curve);
  if (!settings.showBikeLanes) return;

  const curveLen = Math.max(1, curve.getLength());
  const centers = curve.getPoints(Math.max(16, Math.ceil(curveLen / 3))); // ~3 m per quad
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i < centers.length; i++) {
    const p = centers[i];
    const tangent = curve.getTangent(i / Math.max(1, centers.length - 1));
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width * 0.5);
    positions.push(p.x + normal.x, p.y, p.z + normal.z, p.x - normal.x, p.y, p.z - normal.z);
    const v = i / Math.max(1, centers.length - 1);
    uvs.push(0, v * Math.max(1, curveLen / 16), 1, v * Math.max(1, curveLen / 16));
  }

  for (let i = 0; i < centers.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, c, d, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  if (isSceneBuildStale(buildToken)) return;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 32;
  bikeLaneGroup.add(mesh);
}

function buildBikeLanePolygon(poly, mat, buildToken) {
  if (settings.showBikes && poly?.[0]?.length >= 3) {
    const ring = poly[0];
    const first = ring[0];
    const last = ring[ring.length - 1];
    const closed = first && last && first[0] === last[0] && first[1] === last[1];
    const route = createBikeLaneCurve(closed ? ring.slice(0, -1) : ring, closed);
    if (route) state.bikeLaneCurves.push(route);
  }
  if (!settings.showBikeLanes) return;
  const shape = shapeFromLocalPolygon(poly);
  if (!shape) return;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position;
  for (let vi = 0; vi < pos.count; vi++) {
    const vx = pos.getX(vi);
    const vz = pos.getZ(vi);
    const origY = pos.getY(vi);
    const t = (origY - (-0.08)) / 0.08;
    const clampedT = Math.max(0, Math.min(1, t));
    const offset = -0.02 + clampedT * 0.07;
    pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.bikeLane + offset);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  if (isSceneBuildStale(buildToken)) return;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 32;
  bikeLaneGroup.add(mesh);
}

export function buildBikeLaneLayer(bikeLanes = EMPTY_GEOJSON, buildToken = state.sceneBuildToken) {
  clearGroup(bikeLaneGroup);
  clearGroup(bikeGroup);
  state.bikeLaneCurves = [];
  state.bikes = [];
  if ((!settings.showBikeLanes && !settings.showBikes) || !bikeLanes?.features?.length) return;

  const mat = createBikeLaneMaterial();
  for (const f of bikeLanes.features) {
    if (!f.geometry) continue;
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      for (const poly of getPolygonRings(f.geometry)) {
        buildBikeLanePolygon(poly, mat, buildToken);
        if (isSceneBuildStale(buildToken)) return;
      }
      continue;
    }
    const width = bikeLaneFeatureWidth(f);
    for (const line of lineSetsFromGeometry(f.geometry)) {
      buildBikeLaneStrip(line, width, mat, buildToken);
      if (isSceneBuildStale(buildToken)) return;
    }
  }
  buildBicycleTraffic();
}

function createBicycleModel(index = 0) {
  const root = new THREE.Group();
  const frameColor = [0x0f172a, 0x0f766e, 0x1d4ed8, 0x7c2d12][index % 4];
  const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.45, metalness: 0.25 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.62, metalness: 0.15 });
  const riderMat = new THREE.MeshStandardMaterial({ color: [0xf97316, 0x38bdf8, 0xa3e635, 0xe879f9][index % 4], roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd7a67f, roughness: 0.65 });

  const wheelGeo = new THREE.TorusGeometry(0.32, 0.035, 8, 20);
  wheelGeo.rotateY(Math.PI / 2);
  const rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
  rearWheel.position.set(0, 0.35, 0.52);
  const frontWheel = new THREE.Mesh(wheelGeo.clone(), wheelMat);
  frontWheel.position.set(0, 0.35, -0.52);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.05), frameMat);
  frame.position.set(0, 0.68, 0);
  frame.rotation.x = 0.18;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.08), frameMat);
  handle.position.set(0, 0.92, -0.56);
  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.54, 0.18), riderMat);
  rider.position.set(0, 1.08, 0.05);
  rider.rotation.x = -0.25;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
  head.position.set(0, 1.45, -0.06);
  root.add(rearWheel, frontWheel, frame, handle, rider, head);
  root.scale.setScalar(1.05);
  return { mesh: root, wheels: [rearWheel, frontWheel] };
}

function buildBicycleTraffic() {
  state.bikes = [];
  clearGroup(bikeGroup);
  if (!settings.showBikes || !state.bikeLaneCurves.length) return;
  const density = Math.max(0, Math.min(0.4, Number(settings.bikeDensity) || 0));
  const spawnCount = density <= 0 ? 0 : Math.min(60, Math.max(1, Math.round(state.bikeLaneCurves.length * density * 2)));
  for (let i = 0; i < spawnCount; i++) {
    const curve = state.bikeLaneCurves[i % state.bikeLaneCurves.length];
    const model = createBicycleModel(i);
    model.mesh.renderOrder = 42;
    bikeGroup.add(model.mesh);
    state.bikes.push({
      mesh: model.mesh,
      wheels: model.wheels,
      curve,
      direction: Math.random() < 0.5 ? -1 : 1,
      t: Math.random(),
      speed: 0.00012 + Math.random() * 0.00024
    });
  }
}

// --- Road network -----------------------------------------------------------
// Centre lines, widths, access, one-way and lanes per road, plus the junction
// topology (road_network.js) shared by the road surface, the sidewalks and
// the traffic. Rebuilt when the roads or the width settings change; the
// terrain-following curves are rebuilt with every road build.

const ONEWAY_FORWARD = /^(yes|true|1|forward)$/;
function roadOneway(props) {
  const raw = String(propFirst(props, ['oneway', 'one_way']) ?? '').trim().toLowerCase();
  if (raw === '-1' || raw === 'reverse' || raw === 'backward') return 2;
  return ONEWAY_FORWARD.test(raw) ? 1 : 0;
}

function roadLanesPerDirection(props, width, oneway) {
  const lanes = parseNumberProp(props, ['lanes'], null);
  if (lanes && lanes > 0) return Math.max(1, Math.min(4, oneway ? Math.round(lanes) : Math.ceil(lanes / 2)));
  return Math.max(1, Math.min(4, Math.floor((oneway ? width : width / 2) / 3.25)));
}

function roadLinesFrom(roadsFc) {
  const lines = [];
  for (const f of roadsFc?.features || []) {
    for (const coords of lineSetsFromGeometry(f.geometry)) {
      const points = [];
      for (const c of coords || []) {
        if (!c || c.length < 2) continue;
        const [x, z] = metersToLocal(c[0], c[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const last = points[points.length - 1];
        if (last && Math.hypot(last[0] - x, last[1] - z) < 0.01) continue;
        points.push([x, z]);
      }
      if (points.length < 2) continue;
      const width = featureRoadWidth(f);
      const props = f.properties || {};
      const oneway = roadOneway(props);
      lines.push({
        feature: f,
        points,
        width,
        halfWidth: width / 2,
        oneway,
        lanes: roadLanesPerDirection(props, width, oneway),
        allowsCars: roadAllowsCars(f),
        curve: null
      });
    }
  }
  return lines;
}

let roadNetworkCache = { fc: null, key: '', lines: [], network: [] };
function roadNetworkFor(roadsFc) {
  const key = `${settings.roadWidth}|${mappedField('road_width_field') || ''}|${JSON.stringify(state.projectManifest?.roadAccess || null)}`;
  if (roadNetworkCache.fc !== roadsFc || roadNetworkCache.key !== key) {
    const lines = roadLinesFrom(roadsFc);
    roadNetworkCache = { fc: roadsFc, key, lines, network: buildRoadNetwork(lines) };
  }
  return roadNetworkCache;
}

// Centre-line curve resampled every ~3 m with the terrain height baked in,
// so it hugs the DEM; y is the road surface.
function makeTerrainCurve(points, lift, step = 3) {
  const xzCurve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const len = xzCurve.getLength();
  const n = Math.max(points.length, Math.ceil(len / step) + 1);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const tp = xzCurve.getPointAt(i / n);
    tp.y = terrainLocalYAt(tp.x, tp.z) + lift;
    pts.push(tp);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = Math.max(200, Math.ceil(len / 2));
  return curve;
}

function roadCurve(line) {
  if (!line.curve) line.curve = makeTerrainCurve(line.points, LAYER.road);
  return line.curve;
}

// Frames along a curve between two distances: point, right-hand normal
// (horizontal, right of the curve's direction) and distance along. Sampled
// every `step` metres, then frames that lie on a straight, evenly sloped
// stretch are dropped (long straight streets on flat ground need few).
const FRAME_TOLERANCE = 0.03; // m
const FRAME_MAX_GAP = 45; // m
function curveFrames(curve, from, to, step = 3) {
  const len = curve.getLength();
  const a = Math.max(0, Math.min(len, from));
  const b = Math.max(0, Math.min(len, to));
  if (b - a < 0.05) return [];
  const n = Math.max(1, Math.ceil((b - a) / step));
  const all = [];
  for (let i = 0; i <= n; i++) {
    const along = a + ((b - a) * i) / n;
    const u = Math.min(1, along / len);
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const h = Math.hypot(t.x, t.z) || 1;
    all.push({ p, rx: -t.z / h, rz: t.x / h, along });
  }
  if (all.length <= 2) return all;
  const out = [all[0]];
  for (let i = 1; i < all.length - 1; i++) {
    const s0 = out[out.length - 1];
    const s2 = all[i + 1];
    if (s2.along - s0.along > FRAME_MAX_GAP) {
      out.push(all[i]);
      continue;
    }
    // Every skipped frame between s0 and s2 must stay on the chord.
    let straight = Math.abs(s0.rx * s2.rz - s0.rz * s2.rx) < 0.004;
    for (let j = all.indexOf(s0) + 1; straight && j <= i; j++) {
      const f = all[j];
      const k = (f.along - s0.along) / (s2.along - s0.along);
      const dx = f.p.x - (s0.p.x + (s2.p.x - s0.p.x) * k);
      const dy = f.p.y - (s0.p.y + (s2.p.y - s0.p.y) * k);
      const dz = f.p.z - (s0.p.z + (s2.p.z - s0.p.z) * k);
      straight = Math.abs(dx) < FRAME_TOLERANCE && Math.abs(dy) < FRAME_TOLERANCE && Math.abs(dz) < FRAME_TOLERANCE;
    }
    if (!straight) out.push(all[i]);
  }
  out.push(all[all.length - 1]);
  return out;
}

// Indexed triangle strips collected into one geometry.
class StripMesh {
  constructor(extra = []) {
    this.pos = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
    this.extra = Object.fromEntries(extra.map(([name, size]) => [name, { size, data: [] }]));
  }

  /**
   * Two rows of vertices [x, y, z] joined into quads; `facing` is the
   * direction the faces should look (the winding is chosen to match).
   */
  strip(rowA, rowB, facing, color, uvA = null, uvB = null, extraA = null, extraB = null) {
    const n = Math.min(rowA.length, rowB.length);
    if (n < 2) return;
    const base = this.pos.length / 3;
    let flip = false;
    for (let i = 0; i < n - 1; i++) {
      const a = rowA[i], b = rowB[i], c = rowA[i + 1];
      const ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2];
      const vx = b[0] - a[0], vy = b[1] - a[1], vz = b[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const d = nx * facing[0] + ny * facing[1] + nz * facing[2];
      if (Math.abs(d) > 1e-9) { flip = d < 0; break; }
    }
    for (let i = 0; i < n; i++) {
      for (const [row, uvs, ex] of [[rowA, uvA, extraA], [rowB, uvB, extraB]]) {
        this.pos.push(row[i][0], row[i][1], row[i][2]);
        this.col.push(color.r, color.g, color.b);
        if (uvs) this.uv.push(uvs[i][0], uvs[i][1]);
        if (ex) for (const [name, values] of Object.entries(ex)) this.extra[name].data.push(...values[i]);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (flip) this.idx.push(a, b, c, c, b, d);
      else this.idx.push(a, c, b, c, d, b);
    }
  }

  build() {
    if (!this.idx.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv.length) geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    for (const [name, { size, data }] of Object.entries(this.extra)) {
      if (data.length) geo.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
    }
    geo.setIndex(this.idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

const UP = [0, 1, 0];

export async function buildRoadsAndTraffic(roadsFc, buildToken = state.sceneBuildToken) {
  clearGroup(roadGroup);
  clearGroup(carGroup);
  clearGroup(pedestrianGroup);
  state.roadCurves = [];
  state.vehicleRoadCurves = [];
  state.cars = [];
  state.pedestrians = [];
  traffic.lanes = new Map();
  traffic.vehiclePools = [];
  traffic.carShadows = null;
  traffic.headlightPools = null;
  traffic.roadNetwork = null;
  if (!roadsFc?.features?.length) return;

  let surface = null;
  let tile = ASPHALT_TILE_M;
  if (settings.roadStyle === 'Asphalt') {
    surface = createAsphaltSurface();
  } else if (settings.roadStyle === 'Cobblestone' || settings.roadStyle === 'SharedStreet') {
    tile = settings.roadStyle === 'Cobblestone' ? 3 : 4;
    const map = await textureFromSet('road', settings.roadStyle, 1, 1);
    if (map) map.anisotropy = rendererMaxAnisotropy();
    surface = { map, normalMap: null };
  }
  if (isSceneBuildStale(buildToken)) return;

  const { lines, network } = roadNetworkFor(roadsFc);
  traffic.roadNetwork = { lines, network };
  const amenityPoints = settings.roadColorMode === 'Amenity distance' ? estimateAmenityPoints() : [];
  const roads = new StripMesh([['aRoad', 4], ['aRoadB', 4]]);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    line.curve = null;
    const curve = roadCurve(line);
    curve.planxRoad = line;
    state.roadCurves.push(curve);
    if (line.allowsCars) state.vehicleRoadCurves.push(curve);
    const len = curve.getLength();
    const scale = len / Math.max(1e-6, network[li].length);
    const ends = network[li];
    const hw = line.halfWidth;
    // Photo / drawn paving keeps its own colours unless a colour mode is on;
    // the neutral asphalt takes the road colour (lifted for its grey).
    let color;
    if (surface?.map && settings.roadStyle !== 'Asphalt' && settings.roadColorMode === 'Default') color = new THREE.Color(0xffffff);
    else color = roadVisualColor(line.feature, amenityPoints).multiplyScalar(settings.roadStyle === 'Asphalt' ? 1.3 : 1);
    // Each stretch of road knows its nearest junction (signed distance and
    // clearance): split the ribbon where that changes.
    const junctions = ends.junctions.map((j) => ({ at: j.at * scale, clear: j.clear * scale }));
    const cuts = [0];
    for (let j = 1; j < junctions.length; j++) cuts.push((junctions[j - 1].at + junctions[j].at) / 2);
    cuts.push(len);
    for (let k = 0; k < cuts.length - 1; k++) {
      const jn = junctions[k] || null;
      const frames = curveFrames(curve, cuts[k], cuts[k + 1], 3);
      const rowA = [], rowB = [], uvA = [], uvB = [], exA = { aRoad: [], aRoadB: [] }, exB = { aRoad: [], aRoadB: [] };
      for (const { p, rx, rz, along } of frames) {
        const ax = p.x + rx * hw, az = p.z + rz * hw;
        const bx = p.x - rx * hw, bz = p.z - rz * hw;
        rowA.push([ax, p.y, az]);
        rowB.push([bx, p.y, bz]);
        // World-space texture coordinates: overlapping roads match.
        uvA.push([ax / tile, az / tile]);
        uvB.push([bx / tile, bz / tile]);
        const roadB = [line.lanes, line.oneway, jn ? along - jn.at : 1e4, jn ? jn.clear : 0];
        exA.aRoad.push([hw, along, hw, len]);
        exB.aRoad.push([-hw, along, hw, len]);
        exA.aRoadB.push(roadB);
        exB.aRoadB.push(roadB);
      }
      roads.strip(rowA, rowB, UP, color, uvA, uvB, exA, exB);
    }
  }
  if (isSceneBuildStale(buildToken)) return;
  const roadGeo = roads.build();
  if (roadGeo) {
    const mat = createRoadMaterial({
      map: surface?.map || null,
      normalMap: surface?.normalMap || null,
      markings: settings.roadStyle !== 'SharedStreet'
    });
    if (!settings.showRoads) {
      mat.transparent = true;
      mat.opacity = 0;
    }
    setRoadMarkingFlags({
      markings: settings.showRoadMarkings && settings.showRoads,
      crosswalks: settings.showCrosswalks && settings.showRoads
    });
    const mesh = new THREE.Mesh(roadGeo, mat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 30;
    roadGroup.add(mesh);
  }

  if (settings.showCars) spawnVehicles(lines);
  buildBicycleTraffic();
}

// --- Sidewalks and curbs ------------------------------------------------------

const SIDEWALK_WIDTH = 1.9;
const CURB_WIDTH = 0.18;
const CURB_COLOR = 0xb4b1a9;

function sidewalkMaterial(withNormals) {
  const paver = createPaverSurface();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: paver.map,
    normalMap: withNormals ? paver.normalMap : null,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  if (withNormals) mat.normalScale.set(0.8, 0.8);
  return mat;
}

function buildSidewalkPolygonLayer(sidewalks, buildToken = state.sceneBuildToken) {
  // Plain material (no normal map) so the static batcher can merge them.
  const mat = sidewalkMaterial(false);
  mat.vertexColors = false;
  mat.color = colorObjectFromHex(settings.sidewalkColor, '#c9bfa2');
  mat.map = mat.map.clone();
  mat.map.repeat.set(1 / PAVER_TILE_M, 1 / PAVER_TILE_M);
  mat.map.needsUpdate = true;
  for (const f of sidewalks.features || []) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      if (isSceneBuildStale(buildToken)) return;
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        const origY = pos.getY(vi);
        const t = (origY - (-0.18)) / 0.18;
        const clampedT = Math.max(0, Math.min(1, t));
        const offset = -0.08 + clampedT * (0.05 - (-0.08));
        const baseDem = terrainLocalYAt(vx, vz);
        pos.setY(vi, baseDem + LAYER.sidewalk + offset);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      if (isSceneBuildStale(buildToken)) return;
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 33;
      sidewalkGroup.add(mesh);
    }
  }
}

// [from, to] minus the gaps on one side of a line.
function openIntervals(from, to, gaps, side, scale) {
  let parts = [[from, to]];
  for (const g of gaps) {
    if (g.side !== side) continue;
    const a = g.from * scale;
    const b = g.to * scale;
    parts = parts.flatMap(([p, q]) => (b <= p || a >= q ? [[p, q]] : [[p, Math.min(q, a)], [Math.max(p, b), q]]));
  }
  return parts.filter(([p, q]) => q - p > 0.5);
}

// Paved sidewalks along both sides of every road, with a raised curb (top
// stone and face down to the carriageway) and an outer skirt down to the
// block. They stop at junctions and leave openings where side streets join.
function buildProceduralSidewalkStrips(roadsFc, buildToken = state.sceneBuildToken) {
  if (!roadsFc?.features?.length) return;
  const { lines, network } = roadNetworkFor(roadsFc);
  const walk = new StripMesh();
  const curb = new StripMesh();
  const walkColor = colorObjectFromHex(settings.sidewalkColor, '#c9bfa2');
  const curbColor = new THREE.Color(CURB_COLOR);
  const skirtColor = new THREE.Color(CURB_COLOR).multiplyScalar(0.8);
  const lift = LAYER.sidewalk - LAYER.road;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const curve = roadCurve(line);
    const len = curve.getLength();
    const info = network[li];
    const scale = len / Math.max(1e-6, info.length);
    const hw = line.halfWidth;
    // Sidewalks stop at the kerb line of every crossing road.
    const cuts = info.gaps.concat(info.junctions.flatMap((j) => {
      const r = Math.max(0, j.clear - 0.5);
      return [{ from: j.at - r, to: j.at + r, side: -1 }, { from: j.at - r, to: j.at + r, side: 1 }];
    }));
    for (const side of [-1, 1]) {
      for (const [a, b] of openIntervals(0, len, cuts, side, scale)) {
        const frames = curveFrames(curve, a, b, 3);
        if (frames.length < 2) continue;
        const at = (f, off, y) => [f.p.x + f.rx * off * side, y, f.p.z + f.rz * off * side];
        const top = (f) => f.p.y + lift;
        const inner = frames.map((f) => at(f, hw, f.p.y - 0.02));
        const curbIn = frames.map((f) => at(f, hw, top(f) + 0.012));
        const curbOut = frames.map((f) => at(f, hw + CURB_WIDTH, top(f) + 0.012));
        const walkIn = frames.map((f) => at(f, hw + CURB_WIDTH, top(f)));
        const walkOut = frames.map((f) => at(f, hw + SIDEWALK_WIDTH, top(f)));
        const skirt = frames.map((f) => at(f, hw + SIDEWALK_WIDTH, top(f) - 1.1));
        const towardRoad = [-frames[0].rx * side, 0, -frames[0].rz * side];
        const awayFromRoad = [frames[0].rx * side, 0, frames[0].rz * side];
        curb.strip(inner, curbIn, towardRoad, curbColor);
        curb.strip(curbIn, curbOut, UP, curbColor);
        curb.strip(walkOut, skirt, awayFromRoad, skirtColor);
        // Pavers run along the street.
        const uvIn = frames.map((f) => [f.along / PAVER_TILE_M, CURB_WIDTH / PAVER_TILE_M]);
        const uvOut = frames.map((f) => [f.along / PAVER_TILE_M, SIDEWALK_WIDTH / PAVER_TILE_M]);
        walk.strip(walkIn, walkOut, UP, walkColor, uvIn, uvOut);
      }
    }
    if (isSceneBuildStale(buildToken)) return;
  }
  const walkGeo = walk.build();
  if (walkGeo) {
    const mesh = new THREE.Mesh(walkGeo, sidewalkMaterial(true));
    mesh.receiveShadow = true;
    mesh.renderOrder = 32;
    sidewalkGroup.add(mesh);
  }
  const curbGeo = curb.build();
  if (curbGeo) {
    const mesh = new THREE.Mesh(curbGeo, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.82, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3
    }));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.renderOrder = 32;
    sidewalkGroup.add(mesh);
  }
}

export function buildSidewalkLayer(roadsFc, sidewalks = EMPTY_GEOJSON, buildToken = state.sceneBuildToken) {
  clearGroup(sidewalkGroup);
  if (!settings.showSidewalks) return;
  if (sidewalks?.features?.length) {
    buildSidewalkPolygonLayer(sidewalks, buildToken);
    if (isSceneBuildStale(buildToken)) return;
  }
  buildProceduralSidewalkStrips(roadsFc, buildToken);
}

function pedestrianPathWidth(feature) {
  const width = parseNumberProp(
    feature?.properties || {},
    ['width', 'path_width', 'walkway_width'],
    2.2
  );
  return Math.max(0.8, Math.min(6.0, width || 2.2));
}

export function lineSetsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates || [];
  return [];
}

function buildPedestrianPathStrip(coords, width, mat, buildToken) {
  const xzPts = [];
  for (const c of coords || []) {
    if (!c || c.length < 2) continue;
    const [x, z] = metersToLocal(c[0], c[1]);
    xzPts.push(new THREE.Vector3(x, 0, z));
  }
  if (xzPts.length < 2) return;
  const xzCurve = new THREE.CatmullRomCurve3(xzPts, false, 'centripetal');
  const pathLen = xzCurve.getLength();
  const nSamples = Math.max(xzPts.length, Math.ceil(pathLen / 3) + 1);
  const terrainPts = [];
  for (let i = 0; i <= nSamples; i++) {
    const tp = xzCurve.getPointAt(i / nSamples);
    tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.path + 0.04;
    terrainPts.push(tp);
  }
  const curve = new THREE.CatmullRomCurve3(terrainPts, false, 'centripetal');
  state.pedestrianPathCurves.push(curve);
  const centers = curve.getPoints(Math.max(16, terrainPts.length)); // one quad per 3 m sample
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < centers.length; i++) {
    const p = centers[i];
    const tng = curve.getTangent(i / Math.max(1, centers.length - 1));
    const n = new THREE.Vector3(-tng.z, 0, tng.x).normalize().multiplyScalar(width * 0.5);
    positions.push(p.x + n.x, p.y, p.z + n.z, p.x - n.x, p.y, p.z - n.z);
    const v = i / Math.max(1, centers.length - 1);
    uvs.push(0, v, 1, v);
  }
  for (let i = 0; i < centers.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    indices.push(a, c, b, c, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  if (isSceneBuildStale(buildToken)) return;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.renderOrder = 31;
  pedestrianPathGroup.add(mesh);
}

export function buildPedestrianPathLayer(paths = EMPTY_GEOJSON, buildToken = state.sceneBuildToken) {
  clearGroup(pedestrianPathGroup);
  state.pedestrianPathCurves = [];
  if (!settings.showPedestrianPaths || !paths?.features?.length) return;
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xb7ad93,
    roughness: 0.98,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });

  for (const f of paths.features) {
    if (!f.geometry) continue;
    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
      for (const poly of getPolygonRings(f.geometry)) {
        const shape = shapeFromLocalPolygon(poly);
        if (!shape) continue;
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        const pos = geo.attributes.position;
        for (let vi = 0; vi < pos.count; vi++) {
          const vx = pos.getX(vi);
          const vz = pos.getZ(vi);
          const origY = pos.getY(vi);
          const t = (origY - (-0.08)) / 0.08;
          const clampedT = Math.max(0, Math.min(1, t));
          const offset = -0.02 + clampedT * (0.06 - (-0.02));
          pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.path + offset);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
        if (isSceneBuildStale(buildToken)) return;
        const mesh = new THREE.Mesh(geo, pathMat);
        mesh.receiveShadow = true;
        mesh.renderOrder = 31;
        pedestrianPathGroup.add(mesh);
      }
      continue;
    }

    const width = pedestrianPathWidth(f);
    for (const line of lineSetsFromGeometry(f.geometry)) {
      buildPedestrianPathStrip(line, width, pathMat, buildToken);
    }
  }
}

// Crosswalks are painted by the road shader in front of every junction end
// (road_surface.js); this only switches them on or off.
export function buildCrosswalkLayer(roadsFc) {
  clearGroup(crosswalkGroup);
  setRoadMarkingFlags({
    markings: settings.showRoadMarkings && settings.showRoads,
    crosswalks: settings.showCrosswalks && settings.showRoads
  });
}

// --- Traffic --------------------------------------------------------------------
// Cars drive on the right in lanes, keep their distance (intelligent driver
// model), slow down for junctions and turn into a connected street at the
// end of theirs. People walk both ways on the sidewalks and paths. All of
// them are instanced, one draw call per vehicle model and per outfit, and
// only those near the camera and in view are drawn (InstancePool).

const MAX_CARS = 600;
const MAX_PEOPLE = 900;
const CAR_LENGTH_GAP = 2.0; // s0: standstill gap, m
const CAR_HEADWAY = 1.3; // T: time gap, s
const CAR_ACCEL = 1.6; // m/s2
const CAR_BRAKE = 2.6; // comfortable deceleration, m/s2
const TURN_SPEED = 5; // m/s through junctions
const CAR_DRAW_DISTANCE = 450; // m
const PERSON_DRAW_DISTANCE = 240; // m

const traffic = {
  lanes: new Map(),
  vehiclePools: [],
  carShadows: null,
  headlightPools: null,
  personPools: [],
  peopleShadows: null,
  roadNetwork: null,
  pathNetwork: null,
  pathLines: []
};

const tmpP = new THREE.Vector3();
const tmpT = new THREE.Vector3();
const tmpX = new THREE.Vector3();
const tmpY = new THREE.Vector3();
const tmpZ = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpPos = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const viewFrustum = new THREE.Frustum();
const viewMatrix = new THREE.Matrix4();
const viewSphere = new THREE.Sphere();

// Instances near the camera and in view are packed at the front of an
// InstancedMesh each frame and mesh.count is set to how many there are, so
// far and hidden ones cost nothing. Per-instance attributes follow their
// owner when it changes slot.
class InstancePool {
  /** @param {any} mesh THREE.InstancedMesh  @param {string[]} attrs per-instance attribute names */
  constructor(mesh, attrs = []) {
    this.mesh = mesh;
    this.attrs = attrs.map((name) => (name === 'instanceColor' ? mesh.instanceColor : mesh.geometry.attributes[name]));
    this.n = 0;
    this.moved = false;
    mesh.count = 0;
  }

  begin() {
    this.n = 0;
    this.moved = false;
  }

  /** @param {{ slot?: number, data?: number[][] }} owner  @param {any} matrix */
  push(owner, matrix) {
    const k = this.n++;
    this.mesh.setMatrixAt(k, matrix);
    if (owner && owner.slot !== k) {
      owner.slot = k;
      this.attrs.forEach((attr, i) => {
        const v = owner.data[i];
        attr.array.set(v, k * v.length);
      });
      this.moved = true;
    }
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.moved) for (const attr of this.attrs) attr.needsUpdate = true;
  }
}

function makePooledMesh(geometry, material, capacity, renderOrder, attrs = []) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, capacity));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Instances move every frame: the mesh-level bounds would be stale.
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return new InstancePool(mesh, attrs);
}

function updateViewFrustum() {
  camera.updateMatrixWorld();
  viewMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  viewFrustum.setFromProjectionMatrix(viewMatrix);
}

function inView(pos, radius, maxDistance) {
  if (camera.position.distanceToSquared(pos) > maxDistance * maxDistance) return false;
  viewSphere.center.copy(pos);
  viewSphere.radius = radius;
  return viewFrustum.intersectsSphere(viewSphere);
}

function weightedPick(items, rand) {
  let total = 0;
  for (const [, w] of items) total += w;
  let r = rand * total;
  for (const [v, w] of items) {
    r -= w;
    if (r <= 0) return v;
  }
  return items[items.length - 1][0];
}

// Real-world paint shares, plus the asset theme's palette.
const CAR_PAINTS = [
  [0xf1f1ee, 24], [0x15171b, 14], [0x6f747b, 13], [0xb6babf, 15], [0x1d3a70, 8], [0x8b1a1a, 8],
  [0x2b4a3b, 3], [0x5e4330, 3], [0xc8b796, 3], [0x3b6e8f, 3]
];
function carPaint(rand) {
  const theme = assetPoolVariants('cars');
  if (theme.length && rand() < 0.3) return assetColor(theme[Math.floor(rand() * theme.length)], 0x6f747b);
  return weightedPick(CAR_PAINTS, rand());
}
const TAXI_YELLOW = 0xf2c200;
const BUS_PAINTS = [0xf4f4f0, 0x2f6fb3, 0xd9e4ea];
const VEHICLE_MIX = [['sedan', 30], ['hatchback', 26], ['suv', 16], ['van', 9], ['taxi', 12], ['bus', 4]];

function laneKey(line, dir, lane) {
  return `${line}:${dir}:${lane}`;
}
function joinLane(car) {
  car.laneKey = laneKey(car.line, car.dir, car.lane);
  if (!traffic.lanes.has(car.laneKey)) traffic.lanes.set(car.laneKey, []);
  traffic.lanes.get(car.laneKey).push(car);
}
function leaveLane(car) {
  const list = traffic.lanes.get(car.laneKey);
  if (!list) return;
  const i = list.indexOf(car);
  if (i >= 0) list.splice(i, 1);
}

// Right of the direction of travel: lane 0 is the kerb lane.
function laneOffset(line, lane) {
  if (line.oneway) {
    const laneW = line.width / line.lanes;
    return line.halfWidth - laneW * (lane + 0.5);
  }
  const laneW = line.halfWidth / line.lanes;
  return laneW * (lane + 0.5);
}

function carDirectionAllowed(line, dir) {
  if (!line?.allowsCars) return false;
  if (line.oneway === 1) return dir > 0;
  if (line.oneway === 2) return dir < 0;
  return true;
}

function spawnVehicles(lines) {
  const rand = Math.random;
  const lanes = [];
  let total = 0;
  lines.forEach((line, li) => {
    if (!line.allowsCars || !line.curve) return;
    const len = line.curve.getLength();
    if (len < 8) return;
    for (const dir of [1, -1]) {
      if (!carDirectionAllowed(line, dir)) continue;
      for (let lane = 0; lane < line.lanes; lane++) {
        lanes.push({ li, dir, lane, len, from: total });
        total += len;
      }
    }
  });
  if (!lanes.length) return;
  const density = Math.max(0, Math.min(1, Number(settings.carDensity) || 0));
  const count = Math.min(MAX_CARS, Math.round(total * (0.0015 + 0.02 * density)));
  if (count <= 0) return;

  // Place cars, then drop any that would overlap in their lane.
  const placed = [];
  for (let i = 0; i < count; i++) {
    const at = rand() * total;
    let lo = 0;
    let hi = lanes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lanes[mid].from <= at) lo = mid; else hi = mid - 1;
    }
    const ln = lanes[lo];
    const line = lines[ln.li];
    let type = weightedPick(VEHICLE_MIX, rand());
    if (type === 'bus' && (line.halfWidth < 3.4 || ln.len < 60 || ln.lane !== 0)) type = 'sedan';
    const spec = VEHICLE_TYPES.find((v) => v.name === type);
    placed.push({ line: ln.li, dir: ln.dir, lane: ln.lane, s: at - ln.from, spec });
  }
  placed.sort((a, b) => (a.line - b.line) || (a.dir - b.dir) || (a.lane - b.lane) || (a.s - b.s));
  const kept = [];
  for (const c of placed) {
    const prev = kept[kept.length - 1];
    if (prev && prev.line === c.line && prev.dir === c.dir && prev.lane === c.lane
      && c.s - prev.s < (prev.spec.L + c.spec.L) / 2 + 6) continue;
    kept.push(c);
  }

  const material = createVehicleMaterial();
  const byType = new Map();
  for (const c of kept) {
    if (!byType.has(c.spec.name)) byType.set(c.spec.name, []);
    byType.get(c.spec.name).push(c);
  }
  const color = new THREE.Color();
  for (const [name, cars] of byType) {
    const spec = cars[0].spec;
    const pool = makePooledMesh(createVehicleGeometry(spec), material, cars.length, 40);
    // Allocate instanceColor, then let the pool move it with the cars.
    pool.mesh.setColorAt(0, color.setHex(0xffffff));
    pool.attrs = [pool.mesh.instanceColor];
    pool.mesh.receiveShadow = true;
    pool.mesh.name = `vehicles:${name}`;
    for (const c of cars) {
      const paint = name === 'taxi' ? TAXI_YELLOW : name === 'bus' ? BUS_PAINTS[Math.floor(rand() * BUS_PAINTS.length)] : carPaint(rand);
      color.setHex(paint);
      const v0 = (name === 'bus' ? 9 : 10 + rand() * 4) * (lines[c.line].halfWidth >= 5 ? 1.25 : 1);
      const car = {
        pool,
        slot: -1,
        data: [[color.r, color.g, color.b]],
        spec,
        line: c.line,
        dir: c.dir,
        lane: c.lane,
        s: c.s,
        v: v0 * (0.5 + rand() * 0.5),
        v0,
        latR: laneOffset(lines[c.line], c.lane),
        pos: new THREE.Vector3(),
        quat: new THREE.Quaternion(),
        placed: false,
        laneKey: ''
      };
      joinLane(car);
      state.cars.push(car);
    }
    carGroup.add(pool.mesh);
    traffic.vehiclePools.push(pool);
  }

  traffic.carShadows = makePooledMesh(createBlobShadowGeometry(), createBlobShadowMaterial(0.6), state.cars.length, 39);
  carGroup.add(traffic.carShadows.mesh);
  traffic.headlightPools = makePooledMesh(createBlobShadowGeometry(), createHeadlightPoolMaterial(), state.cars.length, 39);
  carGroup.add(traffic.headlightPools.mesh);
  updateVehicles(0, true);
}

function updateVehicles(dt, force = false) {
  const net = traffic.roadNetwork;
  if (!net || !state.cars.length) return;
  const { lines, network } = net;
  if (dt > 0) {
    // Leaders: sort every lane by distance travelled.
    for (const list of traffic.lanes.values()) list.sort((a, b) => a.s - b.s);
    for (const list of traffic.lanes.values()) {
      for (let i = 0; i < list.length; i++) {
        const car = list[i];
        const len = lines[car.line].curve.getLength();
        // Slow down towards a junction (or a turn-around at a dead end).
        const toEnd = len - car.s;
        const vMax = Math.min(car.v0, TURN_SPEED + Math.sqrt(2 * CAR_BRAKE * Math.max(0, toEnd - 4)));
        let interaction = 0;
        const leader = list[i + 1];
        if (leader) {
          const gap = Math.max(0.1, leader.s - car.s - (leader.spec.L + car.spec.L) / 2);
          const sStar = CAR_LENGTH_GAP + car.v * CAR_HEADWAY + (car.v * (car.v - leader.v)) / (2 * Math.sqrt(CAR_ACCEL * CAR_BRAKE));
          interaction = (Math.max(0, sStar) / gap) ** 2;
        }
        const a = CAR_ACCEL * (1 - (car.v / Math.max(0.1, vMax)) ** 4 - interaction);
        car.v = Math.max(0, Math.min(car.v0 * 1.05, car.v + Math.max(-9, a) * dt));
      }
    }
    for (const car of state.cars) {
      car.s += car.v * dt;
      let guard = 0;
      while (guard++ < 4) {
        const len = lines[car.line].curve.getLength();
        if (car.s <= len) break;
        const over = car.s - len;
        const next = nextLineAtEnd(network, car.line, car.dir, Math.random(), (li, d) => carDirectionAllowed(lines[li], d));
        leaveLane(car);
        const target = lines[next.line];
        const tLen = target.curve.getLength();
        const at = next.at * (tLen / Math.max(1e-6, network[next.line].length));
        if (next.line === car.line && !carDirectionAllowed(target, next.dir)) {
          // Dead end of a one-way street: re-enter at its start.
          car.s = 0;
        } else {
          car.dir = next.dir;
          car.s = (car.dir > 0 ? at : tLen - at) + over;
        }
        car.line = next.line;
        car.lane = Math.min(car.lane, target.lanes - 1);
        car.v = Math.min(car.v, TURN_SPEED + 1);
        joinLane(car);
      }
    }
  }

  const k = force ? 1 : 1 - Math.exp(-dt * 12);
  const kr = force ? 1 : 1 - Math.exp(-dt * 9);
  for (const car of state.cars) {
    const line = lines[car.line];
    const curve = line.curve;
    const len = curve.getLength();
    const u = Math.min(1, Math.max(0, (car.dir > 0 ? car.s : len - car.s) / len));
    curve.getPointAt(u, tmpP);
    curve.getTangentAt(u, tmpT).multiplyScalar(car.dir);
    const h = Math.hypot(tmpT.x, tmpT.z) || 1;
    // Lane changes after a turn glide over.
    car.latR += (laneOffset(line, car.lane) - car.latR) * (force ? 1 : Math.min(1, dt * 1.5));
    tmpPos.set(tmpP.x - (tmpT.z / h) * car.latR, tmpP.y + 0.02, tmpP.z + (tmpT.x / h) * car.latR);
    tmpZ.copy(tmpT).normalize();
    tmpX.crossVectors(Y_AXIS, tmpZ).normalize();
    tmpY.crossVectors(tmpZ, tmpX);
    tmpM.makeBasis(tmpX, tmpY, tmpZ);
    tmpQ.setFromRotationMatrix(tmpM);
    if (!car.placed || force) {
      car.pos.copy(tmpPos);
      car.quat.copy(tmpQ);
      car.placed = true;
    } else {
      car.pos.lerp(tmpPos, k);
      car.quat.slerp(tmpQ, kr);
    }
  }
  writeVehicleMatrices();
}

function writeVehicleMatrices() {
  const night = (state.solar.elevationDeg ?? 30) < -3;
  setVehicleNight(night);
  for (const pool of traffic.vehiclePools) pool.begin();
  traffic.carShadows?.begin();
  traffic.headlightPools?.begin();
  for (const car of state.cars) {
    if (!inView(car.pos, car.spec.L, CAR_DRAW_DISTANCE)) continue;
    tmpS.set(1, 1, 1);
    tmpM.compose(car.pos, car.quat, tmpS);
    car.pool.push(car, tmpM);
    if (traffic.carShadows) {
      tmpS.set(car.spec.W * 1.25, 1, car.spec.L * 1.08);
      tmpPos.copy(car.pos).addScaledVector(Y_AXIS, 0.015);
      tmpM.compose(tmpPos, car.quat, tmpS);
      traffic.carShadows.push(null, tmpM);
    }
    if (night && traffic.headlightPools) {
      tmpZ.set(0, 0, 1).applyQuaternion(car.quat);
      tmpS.set(car.spec.W * 1.7, 1, 11);
      tmpPos.copy(car.pos).addScaledVector(tmpZ, car.spec.L / 2 + 5.2).addScaledVector(Y_AXIS, 0.03);
      tmpM.compose(tmpPos, car.quat, tmpS);
      traffic.headlightPools.push(null, tmpM);
    }
  }
  for (const pool of traffic.vehiclePools) pool.end();
  traffic.carShadows?.end();
  traffic.headlightPools?.end();
}

// --- People ---------------------------------------------------------------------

const SKIN_TONES = [[0xf1c8a5, 3], [0xe0ac86, 4], [0xc68e66, 4], [0xa06f4c, 3], [0x7a4f34, 2], [0x5a3a26, 1]];
const SHIRTS = [[0xf2f2ef, 5], [0x1f2a44, 4], [0x18181b, 4], [0x6b7280, 3], [0x9b2c2c, 2], [0x2f5d50, 2], [0xc9b28f, 2],
  [0x8fb3d9, 3], [0xd97706, 1], [0x7c3a6b, 1], [0x3f6212, 1]];
const PANTS = [[0x2a3a5a, 6], [0x1b1c20, 5], [0x5b5f66, 3], [0x8a7a5c, 3], [0x3c3530, 2], [0xd6cfc2, 1]];
const SKIRTS = [[0x1b1c20, 3], [0x7c2d3a, 2], [0x2a3a5a, 2], [0xa3a3a3, 1], [0x5f6f52, 1], [0xc9a37e, 1]];
const HAIR = [[0x16110d, 6], [0x3b2617, 5], [0x6b4a2e, 3], [0xb08d57, 1], [0x9a9a9a, 1]];
const STRIDE = 1.45; // m per walking cycle
const PERSON_ATTRS = ['iWalk', 'iSkin', 'iShirt', 'iPants', 'iHair'];

function sidewalkCentre(line) {
  return line.halfWidth + CURB_WIDTH + (SIDEWALK_WIDTH - CURB_WIDTH) / 2;
}

function personRoutes() {
  const routes = [];
  traffic.roadNetwork.lines.forEach((line, li) => {
    if (!line.curve) return;
    const len = line.curve.getLength();
    if (len < 4) return;
    for (const side of [-1, 1]) routes.push({ kind: 'road', li, side, len, offset: sidewalkCentre(line) });
  });
  traffic.pathLines = [];
  traffic.pathNetwork = null;
  if (settings.showPedestrianPaths && state.pedestrianPathCurves.length) {
    traffic.pathLines = state.pedestrianPathCurves.map((curve) => ({
      curve,
      points: curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 6))).map((p) => [p.x, p.z]),
      halfWidth: 1
    }));
    traffic.pathNetwork = buildRoadNetwork(traffic.pathLines);
    traffic.pathLines.forEach((pl, li) => {
      const len = pl.curve.getLength();
      if (len >= 4) routes.push({ kind: 'path', li, side: 1, len, offset: 0 });
    });
  }
  return routes;
}

export function buildPedestrianLayer() {
  clearGroup(pedestrianGroup);
  state.pedestrians = [];
  traffic.personPools = [];
  traffic.peopleShadows = null;
  if (!settings.showPedestrians) return;
  if (!traffic.roadNetwork) traffic.roadNetwork = { lines: roadNetworkCache.lines, network: roadNetworkCache.network };
  const routes = personRoutes();
  if (!routes.length) return;
  const rand = Math.random;
  let total = 0;
  for (const r of routes) total += r.len;
  const density = Math.max(0, Math.min(1, Number(settings.pedestrianDensity) || 0));
  const count = Math.min(MAX_PEOPLE, Math.round(total * (0.0015 + 0.012 * density)));
  if (count <= 0) return;
  const theme = assetPoolVariants('pedestrians');
  const color = new THREE.Color();
  const rgb = (hex) => color.setHex(hex).toArray();
  const people = [];
  for (let i = 0; i < count; i++) {
    let at = rand() * total;
    let route = routes[0];
    for (const r of routes) {
      if (at <= r.len) { route = r; break; }
      at -= r.len;
    }
    const idle = rand() < 0.1;
    const v = idle ? 0 : 0.95 + rand() * 0.6;
    const outfit = rand() < 0.38 ? 1 : 0;
    const shirt = theme.length && rand() < 0.35 ? assetColor(theme[Math.floor(rand() * theme.length)], 0x334155) : weightedPick(SHIRTS, rand());
    people.push({
      outfit,
      slot: -1,
      // Same order as PERSON_ATTRS: gait (phase, angular frequency, swing, bob) and colours.
      data: [
        [rand() * Math.PI * 2, (2 * Math.PI * v) / STRIDE, v > 0 ? 0.42 + rand() * 0.12 : 0, v > 0 ? 0.035 : 0],
        rgb(weightedPick(SKIN_TONES, rand())),
        rgb(shirt),
        rgb(weightedPick(outfit === 1 ? SKIRTS : PANTS, rand())),
        rgb(weightedPick(HAIR, rand()))
      ],
      kind: route.kind,
      line: route.li,
      side: route.side,
      dir: rand() < 0.5 ? 1 : -1,
      s: at,
      v,
      latAbs: route.offset + (route.kind === 'road' ? (rand() - 0.5) * 0.9 : (rand() - 0.5) * 0.6),
      yaw: rand() * Math.PI * 2,
      height: rand() < 0.07 ? 0.62 + rand() * 0.15 : 0.92 + rand() * 0.16,
      hitAt: -1,
      pos: new THREE.Vector3(),
      yawSmooth: 0,
      placed: false
    });
  }

  const material = createPersonMaterial();
  for (const outfit of [0, 1]) {
    const group = people.filter((p) => p.outfit === outfit);
    if (!group.length) continue;
    const geo = createPersonGeometry(outfit === 1 ? 'skirt' : 'trousers');
    for (const [i, name] of PERSON_ATTRS.entries()) {
      const size = group[0].data[i].length;
      geo.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(group.length * size), size));
    }
    const pool = makePooledMesh(geo, material, group.length, 41, PERSON_ATTRS);
    pool.mesh.receiveShadow = true;
    pool.mesh.name = outfit === 1 ? 'people:skirt' : 'people:trousers';
    for (const p of group) p.pool = pool;
    pedestrianGroup.add(pool.mesh);
    traffic.personPools.push(pool);
  }
  state.pedestrians = people;
  traffic.peopleShadows = makePooledMesh(createBlobShadowGeometry(), createBlobShadowMaterial(0.42), people.length, 40);
  pedestrianGroup.add(traffic.peopleShadows.mesh);
  updatePeople(0, 0, true);
}

function personLine(p) {
  if (p.kind === 'path') return traffic.pathLines[p.line];
  return traffic.roadNetwork?.lines[p.line];
}

function updatePeople(dt, now, force = false) {
  if (!state.pedestrians.length) return;
  const k = force ? 1 : 1 - Math.exp(-dt * 8);
  const lift = LAYER.sidewalk - LAYER.road;
  for (const pool of traffic.personPools) pool.begin();
  traffic.peopleShadows?.begin();
  for (const p of state.pedestrians) {
    let line = personLine(p);
    if (!line?.curve) continue;
    let len = line.curve.getLength();
    if (dt > 0 && p.v > 0) {
      p.s += p.v * dt;
      if (p.s > len) {
        const isPath = p.kind === 'path';
        const network = isPath ? traffic.pathNetwork : traffic.roadNetwork?.network;
        const next = network ? nextLineAtEnd(network, p.line, p.dir, Math.random()) : { line: p.line, at: p.dir > 0 ? len : 0, dir: -p.dir };
        const target = isPath ? traffic.pathLines[next.line] : traffic.roadNetwork.lines[next.line];
        const tLen = target.curve.getLength();
        const at = next.at * (tLen / Math.max(1e-6, network ? network[next.line].length : len));
        p.line = next.line;
        p.dir = next.dir;
        p.s = Math.min(tLen, (p.dir > 0 ? at : tLen - at) + (p.s - len));
        if (!isPath) p.latAbs = sidewalkCentre(target) + (Math.random() - 0.5) * 0.9;
        line = target;
        len = tLen;
      }
    }
    const curve = line.curve;
    const u = Math.min(1, Math.max(0, (p.dir > 0 ? p.s : len - p.s) / len));
    curve.getPointAt(u, tmpP);
    curve.getTangentAt(u, tmpT);
    const h = Math.hypot(tmpT.x, tmpT.z) || 1;
    const off = p.kind === 'path' ? p.latAbs : p.latAbs * p.side;
    tmpPos.set(tmpP.x - (tmpT.z / h) * off, tmpP.y + (p.kind === 'path' ? 0.03 : lift + 0.005), tmpP.z + (tmpT.x / h) * off);
    const yaw = p.v > 0 ? Math.atan2(tmpT.x * p.dir, tmpT.z * p.dir) : p.yaw;
    if (!p.placed || force) {
      p.pos.copy(tmpPos);
      p.yawSmooth = yaw;
      p.placed = true;
    } else {
      p.pos.lerp(tmpPos, k);
      let dy = yaw - p.yawSmooth;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.yawSmooth += dy * Math.min(1, dt * 6);
    }
    if (!inView(p.pos, 1.2, PERSON_DRAW_DISTANCE)) continue;
    // Slingshot hit: squash, then stretch back.
    let sx = p.height;
    let sy = p.height;
    if (p.hitAt >= 0) {
      const age = now - p.hitAt;
      if (age < 0.12) { sx *= 1.45; sy *= 0.45; }
      else if (age < 0.3) { sx *= 0.85; sy *= 1.6; }
      else p.hitAt = -1;
    }
    tmpQ.setFromAxisAngle(Y_AXIS, p.yawSmooth);
    tmpS.set(sx, sy, sx);
    tmpM.compose(p.pos, tmpQ, tmpS);
    p.pool.push(p, tmpM);
    if (traffic.peopleShadows) {
      tmpS.set(0.75 * p.height, 1, 0.75 * p.height);
      tmpPos.copy(p.pos).addScaledVector(Y_AXIS, 0.01);
      tmpM.compose(tmpPos, tmpQ, tmpS);
      traffic.peopleShadows.push(null, tmpM);
    }
  }
  for (const pool of traffic.personPools) pool.end();
  traffic.peopleShadows?.end();
}

/**
 * Slingshot game: the person hit by the ray (within maxDistance) squashes.
 * @returns {boolean} whether someone was hit
 */
export function hitPedestrian(raycaster, maxDistance = 40) {
  let best = null;
  for (const pool of traffic.personPools) {
    const mesh = pool.mesh;
    if (!mesh.parent || !mesh.count) continue;
    mesh.computeBoundingSphere();
    for (const hit of raycaster.intersectObject(mesh, false)) {
      if (hit.distance < maxDistance && (!best || hit.distance < best.distance)) best = { ...hit, pool };
    }
  }
  if (!best) return false;
  const person = state.pedestrians.find((p) => p.pool === best.pool && p.slot === best.instanceId);
  if (person) person.hitAt = performance.now() / 1000;
  return true;
}

// Moves the traffic every frame: cars, bicycles (wheels spinning) and
// walking people (limbs swing in the shader).
export function updateTraffic(time, delta) {
  const dt = Math.min(0.1, Math.max(0, delta || 0));
  if (state.cars.length || state.pedestrians.length) updateViewFrustum();
  updateVehicles(dt * Math.max(0, Number(settings.trafficSpeed) || 0));
  setPeopleTime(time / 1000);
  updatePeople(dt, time / 1000);
  for (const b of state.bikes) {
    b.t += b.speed * Math.max(0, settings.bikeSpeed || 0);
    if (b.t > 1) b.t = 0;
    const sample = b.direction > 0 ? b.t : 1 - b.t;
    const safe = Math.min(Math.max(sample, 0.01), 0.99);
    const pos = b.curve.getPointAt(safe);
    const tan = b.curve.getTangentAt(safe).multiplyScalar(b.direction);
    const bikeY = terrainLocalYAt(pos.x, pos.z) + LAYER.bikeLane + 0.08;
    b.mesh.position.set(pos.x, bikeY, pos.z);
    const horiz = Math.sqrt(tan.x * tan.x + tan.z * tan.z);
    if (horiz > 0.001) {
      b.mesh.lookAt(pos.x - tan.x / horiz, bikeY, pos.z - tan.z / horiz);
    }
    for (const wheel of b.wheels || []) wheel.rotation.x -= delta * 8 * (settings.bikeSpeed || 0);
  }
}
