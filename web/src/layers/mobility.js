// Mobility: roads (with amenity and access colouring), sidewalks, pedestrian
// paths, crosswalks and bike lanes, and the traffic on them (cars, people,
// bicycles) moving along road curves.
import * as THREE from 'three';
import { assetColor } from '../catalog.js';
import { getPolygonRings } from '../geo.js';
import { parseNumberProp, featureLabelText, normalizeAccessText, keywordList } from '../props.js';
import { colorObjectFromHex, rgbaFromColor, mixedColor, createAsphaltTexture } from '../textures.js';
import { state } from '../core/state.js';
import {
  roadGroup, carGroup, bikeLaneGroup, bikeGroup, pedestrianGroup, sidewalkGroup, pedestrianPathGroup,
  crosswalkGroup, LAYER
} from '../core/scene.js';
import { assetPoolVariants, mappedField, buildingFunctionValue, settings } from '../core/settings.js';
import { textureFromSet, metersToLocal, EMPTY_GEOJSON } from '../core/data.js';
import { clearGroup, shapeFromLocalPolygon, isSceneBuildStale } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';

const sidewalkTextureCache = new Map();
function createSidewalkTexture(baseColor = settings.sidewalkColor) {
  const base = colorObjectFromHex(baseColor, settings.sidewalkColor || '#c9bfa2');
  const cacheKey = `sidewalk:${base.getHexString()}`;
  if (sidewalkTextureCache.has(cacheKey)) return sidewalkTextureCache.get(cacheKey);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = rgbaFromColor(mixedColor(base, 0x000000, 0.22), 0.34);
  ctx.lineWidth = 2;
  for (let x = 0; x <= c.width; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, c.height); ctx.stroke();
  }
  for (let y = 0; y <= c.height; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(c.width, y); ctx.stroke();
  }
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const target = Math.random() > 0.55 ? 0xffffff : 0x000000;
    ctx.fillStyle = rgbaFromColor(mixedColor(base, target, 0.10 + Math.random() * 0.18), 0.14);
    ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 12);
  t.colorSpace = THREE.SRGBColorSpace;
  sidewalkTextureCache.set(cacheKey, t);
  return t;
}

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

function createPedestrianModel(index = 0) {
  const variants = assetPoolVariants('pedestrians');
  const variant = variants[index % Math.max(1, variants.length)] || 'Commuter';
  const outfit = assetColor(variant, [0x1e293b, 0x334155, 0x475569, 0x0f766e][index % 4]);
  const accent = new THREE.Color(outfit).offsetHSL(0.02, -0.08, 0.08).getHex();
  const skin = [0xf2c7a0, 0xd7a67f, 0xb9825d, 0x8d5a3b][index % 4];
  const clothMat = new THREE.MeshStandardMaterial({ color: outfit, roughness: 0.82 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.88 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.65 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const root = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.82, 0.22), clothMat);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), skinMat);
  head.position.y = 1.58;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), skinMat);
  neck.position.y = 1.39;
  root.add(body, head, neck);

  const makeLimb = (mat, length, width, yOffset, zOffset = 0) => {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, length, width), mat);
    mesh.position.y = -length * 0.5;
    mesh.position.z = zOffset;
    pivot.position.y = yOffset;
    pivot.add(mesh);
    return pivot;
  };
  const leftArm = makeLimb(clothMat, 0.62, 0.08, 1.34, 0);
  leftArm.position.x = -0.25;
  const rightArm = makeLimb(clothMat, 0.62, 0.08, 1.34, 0);
  rightArm.position.x = 0.25;
  const leftLeg = makeLimb(pantsMat, 0.72, 0.10, 0.68, 0);
  leftLeg.position.x = -0.11;
  const rightLeg = makeLimb(pantsMat, 0.72, 0.10, 0.68, 0);
  rightLeg.position.x = 0.11;
  root.add(leftArm, rightArm, leftLeg, rightLeg);

  const leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.24), shoeMat);
  leftShoe.position.set(-0.11, 0.02, -0.04);
  const rightShoe = leftShoe.clone();
  rightShoe.position.x = 0.11;
  root.add(leftShoe, rightShoe);
  root.scale.setScalar(0.95 + (index % 5) * 0.025);
  return { mesh: root, limbRefs: { leftArm, rightArm, leftLeg, rightLeg, leftShoe, rightShoe } };
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

export async function buildRoadsAndTraffic(roadsFc, buildToken = state.sceneBuildToken) {
  clearGroup(roadGroup);
  clearGroup(carGroup);
  clearGroup(pedestrianGroup);
  state.roadCurves = [];
  state.vehicleRoadCurves = [];
  state.cars = [];
  state.pedestrians = [];
  if (!roadsFc?.features?.length) return;

  let roadTex = null;
  if (settings.roadStyle === 'Asphalt') {
    roadTex = null;
  } else if (settings.roadStyle === 'Cobblestone') {
    roadTex = await textureFromSet('road', 'Cobblestone', 2, 20);
  } else if (settings.roadStyle === 'SharedStreet') {
    roadTex = await textureFromSet('road', 'SharedStreet', 2, 16);
  }
  if (isSceneBuildStale(buildToken)) return;

  const roadMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: roadTex,
    roughness: 0.97,
    transparent: !settings.showRoads,
    opacity: settings.showRoads ? 1.0 : 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  const amenityPoints = settings.roadColorMode === 'Amenity distance' ? estimateAmenityPoints() : [];

  for (const f of roadsFc.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const xzPts = [];
    for (const c of f.geometry.coordinates) {
      const [x, z] = metersToLocal(c[0], c[1]);
      xzPts.push(new THREE.Vector3(x, 0, z));
    }
    if (xzPts.length < 2) continue;
    const featureWidth = featureRoadWidth(f);

    // Resample XZ path every ~3 m and bake terrain Y so the curve hugs DEM surface
    const xzCurve = new THREE.CatmullRomCurve3(xzPts, false, 'centripetal');
    const roadLen = xzCurve.getLength();
    const nSamples = Math.max(xzPts.length, Math.ceil(roadLen / 3) + 1);
    const terrainPts = [];
    for (let i = 0; i <= nSamples; i++) {
      const tp = xzCurve.getPointAt(i / nSamples);
      tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.road;
      terrainPts.push(tp);
    }
    const curve = new THREE.CatmullRomCurve3(terrainPts, false, 'centripetal');
    state.roadCurves.push(curve);
    if (roadAllowsCars(f)) state.vehicleRoadCurves.push(curve);
    // One ribbon vertex per terrain sample: the samples already carry the DEM
    // height, and subdividing them 3x only interpolated the spline (~1 quad/m).
    const segments = Math.max(24, terrainPts.length);
    const centers = curve.getPoints(segments);
    const left = [];
    const right = [];
    for (let i = 0; i < centers.length; i++) {
      const p = centers[i];
      const t = curve.getTangent(i / (centers.length - 1));
      const n = new THREE.Vector3(-t.z, 0, t.x).normalize().multiplyScalar(featureWidth * 0.5);
      left.push(new THREE.Vector3(p.x + n.x, p.y, p.z + n.z));
      right.push(new THREE.Vector3(p.x - n.x, p.y, p.z - n.z));
    }
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i < left.length; i++) {
      positions.push(left[i].x, left[i].y, left[i].z);
      positions.push(right[i].x, right[i].y, right[i].z);
      const v = i / Math.max(1, left.length - 1);
      uvs.push(0, v, 1, v);
    }
    for (let i = 0; i < left.length - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, c, d, b);
    }
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();
    const featureColor = roadVisualColor(f, amenityPoints);
    const featureRoadMat = roadMat.clone();
    if (settings.roadStyle === 'Asphalt') {
      featureRoadMat.map = createAsphaltTexture(`#${featureColor.getHexString()}`);
      featureRoadMat.color = new THREE.Color(0xffffff);
    } else {
      featureRoadMat.color = featureColor;
    }
    featureRoadMat.needsUpdate = true;
    if (isSceneBuildStale(buildToken)) return;
    const mesh = new THREE.Mesh(roadGeo, featureRoadMat);
    mesh.receiveShadow = true;
    mesh.renderOrder = 30;
    roadGroup.add(mesh);

    // Procedural Road Markings
    if (settings.showRoadMarkings && settings.showRoads) {
      const roadLenMark = xzCurve.getLength();
      
      const markingMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5
      });
      
      if (!buildRoadsAndTraffic.dashedTex) {
        const markCanvas = document.createElement('canvas');
        markCanvas.width = 16; markCanvas.height = 64;
        const markCtx = markCanvas.getContext('2d');
        markCtx.fillStyle = 'rgba(0,0,0,0)';
        markCtx.fillRect(0, 0, 16, 64);
        markCtx.fillStyle = '#ffffff';
        markCtx.fillRect(6, 0, 4, 32);
        const t = new THREE.CanvasTexture(markCanvas);
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(1, 1);
        buildRoadsAndTraffic.dashedTex = t;
      }

      const dashedMarkingMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: buildRoadsAndTraffic.dashedTex,
        transparent: true,
        roughness: 0.9,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5
      });

      // 1. Center Dashed Line
      if (featureWidth >= 5.0) {
        const centerPos = [];
        const centerUvs = [];
        const centerInd = [];
        const mHalf = 0.06;
        
        for (let i = 0; i < centers.length; i++) {
          const p = centers[i];
          const tangent = curve.getTangent(i / (centers.length - 1));
          const norm = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(mHalf);
          
          centerPos.push(p.x + norm.x, p.y + 0.012, p.z + norm.z);
          centerPos.push(p.x - norm.x, p.y + 0.012, p.z - norm.z);
          
          const distRatio = (i / (centers.length - 1)) * roadLenMark;
          centerUvs.push(0, distRatio / 4.0);
          centerUvs.push(1, distRatio / 4.0);
        }
        for (let i = 0; i < centers.length - 1; i++) {
          const a = i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          centerInd.push(a, c, b, c, d, b);
        }
        const centerGeo = new THREE.BufferGeometry();
        centerGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerPos, 3));
        centerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(centerUvs, 2));
        centerGeo.setIndex(centerInd);
        centerGeo.computeVertexNormals();
        
        const centerMesh = new THREE.Mesh(centerGeo, dashedMarkingMat);
        centerMesh.renderOrder = 31;
        roadGroup.add(centerMesh);
      }

      // 2. Outer Shoulder Lines
      if (featureWidth >= 6.0) {
        const shoulderOffset = (featureWidth / 2) - 0.25;
        const sHalf = 0.04;
        
        const leftShoulderPos = [];
        const rightShoulderPos = [];
        const shInd = [];
        
        for (let i = 0; i < centers.length; i++) {
          const p = centers[i];
          const tangent = curve.getTangent(i / (centers.length - 1));
          const norm = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          
          const lp = new THREE.Vector3().addScaledVector(norm, shoulderOffset).add(p);
          leftShoulderPos.push(lp.x + norm.x * sHalf, lp.y + 0.012, lp.z + norm.z * sHalf);
          leftShoulderPos.push(lp.x - norm.x * sHalf, lp.y + 0.012, lp.z - norm.z * sHalf);
          
          const rp = new THREE.Vector3().addScaledVector(norm, -shoulderOffset).add(p);
          rightShoulderPos.push(rp.x + norm.x * sHalf, rp.y + 0.012, rp.z + norm.z * sHalf);
          rightShoulderPos.push(rp.x - norm.x * sHalf, rp.y + 0.012, rp.z - norm.z * sHalf);
        }
        for (let i = 0; i < centers.length - 1; i++) {
          const a = i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          shInd.push(a, c, b, c, d, b);
        }
        
        const leftGeo = new THREE.BufferGeometry();
        leftGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftShoulderPos, 3));
        leftGeo.setIndex(shInd);
        leftGeo.computeVertexNormals();
        const leftMesh = new THREE.Mesh(leftGeo, markingMat);
        leftMesh.renderOrder = 31;
        roadGroup.add(leftMesh);
        
        const rightGeo = new THREE.BufferGeometry();
        rightGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightShoulderPos, 3));
        rightGeo.setIndex(shInd);
        rightGeo.computeVertexNormals();
        const rightMesh = new THREE.Mesh(rightGeo, markingMat);
        rightMesh.renderOrder = 31;
        roadGroup.add(rightMesh);
      }
    }
  }

  if (settings.showCars && state.vehicleRoadCurves.length > 0) {
    const carVariants = assetPoolVariants('cars');
    const carColors = carVariants.length
      ? carVariants.map((name, index) => assetColor(name, [0x1f2937, 0x334155, 0x475569, 0x64748b, 0x0f766e][index % 5]))
      : [0x1f2937, 0x334155, 0x475569, 0x64748b, 0x0f766e];
    const spawnCount = Math.min(300, state.vehicleRoadCurves.length * Math.floor(10 * settings.carDensity));
    for (let i = 0; i < spawnCount; i++) {
      const curve = state.vehicleRoadCurves[Math.floor(Math.random() * state.vehicleRoadCurves.length)];
      const car = new THREE.Group();
      const cMat = new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], roughness: 0.25, metalness: 0.4 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1 });
    
    // Base body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 4.2), cMat);
    body.position.y = 0.4;
    // Cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), cMat);
    cabin.position.set(0, 0.95, 0.2);
    // Windows
    const winF = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), glassMat);
    winF.position.set(0, 0.95, -0.91);
    winF.rotation.x = -Math.PI + 0.3;
    const winB = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), glassMat);
    winB.position.set(0, 0.95, 1.31);
    winB.rotation.x = -0.3;

    const isNight = (state.solar.elevationDeg ?? 30) < -3;
    const hMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: isNight ? 0xffffff : 0x000000, emissiveIntensity: isNight ? 5.0 : 0 });
    const bMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: isNight ? 0xff0000 : 0x000000, emissiveIntensity: isNight ? 5.0 : 0 });
    
    // Headlights (Front: -Z)
    const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), hMat);
    hlR.position.set(0.6, 0.5, -2.15);
    const hlL = hlR.clone();
    hlL.position.set(-0.6, 0.5, -2.15);

    // Headlight Beams (Fakelight cone)
    if (isNight) {
      const beamGeo = new THREE.ConeGeometry(1.5, 6, 8, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending, depthWrite: false });
      const beamR = new THREE.Mesh(beamGeo, beamMat);
      beamR.position.set(0.6, 0.2, -5.0);
      beamR.rotation.x = -Math.PI / 2;
      const beamL = beamR.clone();
      beamL.position.set(-0.6, 0.2, -5.0);
      car.add(beamR, beamL);
    }

    // Brake lights (Back: +Z)
    const blR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.1), bMat);
    blR.position.set(0.6, 0.5, 2.15);
    const blL = blR.clone();
    blL.position.set(-0.6, 0.5, 2.15);

      car.add(body, cabin, winF, winB, hlR, hlL, blR, blL);
      carGroup.add(car);
      car.renderOrder = 40;
      state.cars.push({ car, curve, t: Math.random(), speed: 0.0002 + Math.random() * 0.0006 });
    }
  }

  buildBicycleTraffic();

}

export function buildPedestrianLayer() {
  clearGroup(pedestrianGroup);
  state.pedestrians = [];
  if (!settings.showPedestrians) return;
  const candidateRoutes = state.roadCurves.map((curve) => ({ curve, surface: 'sidewalk' }))
    .concat(settings.showPedestrianPaths ? state.pedestrianPathCurves.map((curve) => ({ curve, surface: 'path' })) : []);
  if (!candidateRoutes.length) return;
  const pedCount = Math.min(600, candidateRoutes.length * Math.floor(20 * settings.pedestrianDensity));
  for (let i = 0; i < pedCount; i++) {
    const route = candidateRoutes[Math.floor(Math.random() * candidateRoutes.length)];
    const { mesh: pedGeo, limbRefs } = createPedestrianModel(i);
    pedestrianGroup.add(pedGeo);
    pedGeo.renderOrder = 41;
    state.pedestrians.push({
      mesh: pedGeo,
      limbRefs,
      curve: route.curve,
      surface: route.surface,
      t: Math.random(),
      speed: 0.0001 + Math.random() * 0.0001,
      phase: Math.random() * Math.PI * 2,
      walkAmplitude: 0.45 + Math.random() * 0.15,
      offsetDir: (Math.random() > 0.5 ? 1 : -1),
      lateralOffset: route.surface === 'path' ? (Math.random() - 0.5) * 0.45 : null
    });
  }
}

function buildSidewalkPolygonLayer(sidewalks, buildToken = state.sceneBuildToken) {
  const sidewalkTex = createSidewalkTexture(settings.sidewalkColor);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sidewalkTex,
    roughness: 0.96,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
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

function buildProceduralSidewalkStrips(roadsFc, buildToken = state.sceneBuildToken) {
  if (!roadsFc?.features?.length) return;

  const swWidth = 1.3;
  const sidewalkTex = createSidewalkTexture(settings.sidewalkColor);
  const swMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sidewalkTex,
    roughness: 0.95,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });

  for (const f of roadsFc.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const xzPtsW = [];
    for (const c of f.geometry.coordinates) {
      const [x, z] = metersToLocal(c[0], c[1]);
      xzPtsW.push(new THREE.Vector3(x, 0, z));
    }
    if (xzPtsW.length < 2) continue;
    const featureWidth = featureRoadWidth(f);
    const xzCurveW = new THREE.CatmullRomCurve3(xzPtsW, false, 'centripetal');
    const wLen = xzCurveW.getLength();
    const nW = Math.max(xzPtsW.length, Math.ceil(wLen / 6) + 1);
    const wPts = [];
    for (let i = 0; i <= nW; i++) {
      const tp = xzCurveW.getPointAt(i / nW);
      tp.y = terrainLocalYAt(tp.x, tp.z) + LAYER.sidewalk;
      wPts.push(tp);
    }
    const curve = new THREE.CatmullRomCurve3(wPts, false, 'centripetal');
    const segments = Math.max(24, wPts.length * 2); // ~3 m per quad (samples are 6 m apart)
    const centers = curve.getPoints(segments);

    for (const side of [-1, 1]) {
      const innerOff = featureWidth * 0.5 * side;
      const outerOff = (featureWidth * 0.5 + swWidth) * side;
      const positions = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i < centers.length; i++) {
        const p = centers[i];
        const tang = curve.getTangent(i / (centers.length - 1));
        const n = new THREE.Vector3(-tang.z, 0, tang.x).normalize();
        const li = new THREE.Vector3(p.x + n.x * innerOff, p.y, p.z + n.z * innerOff);
        const ri = new THREE.Vector3(p.x + n.x * outerOff, p.y, p.z + n.z * outerOff);
        positions.push(li.x, li.y, li.z, ri.x, ri.y, ri.z);
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
      const mesh = new THREE.Mesh(geo, swMat);
      mesh.receiveShadow = true;
      mesh.renderOrder = 32;
      sidewalkGroup.add(mesh);
    }
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

export function buildCrosswalkLayer(roadsFc) {
  clearGroup(crosswalkGroup);
  if (!settings.showCrosswalks) return;
  if (!roadsFc?.features?.length) return;

  const cwMat = new THREE.MeshStandardMaterial({ color: 0xf0ede5, roughness: 0.85 });
  const stripeW = 0.38;
  const stripeGap = 0.30;
  const stripeCount = 5;
  const totalLen = stripeCount * stripeW + (stripeCount - 1) * stripeGap;

  for (const f of roadsFc.features) {
    if (!f.geometry || f.geometry.type !== 'LineString') continue;
    const coords = f.geometry.coordinates;
    if (coords.length < 2) continue;
    const cwLen = featureRoadWidth(f) + 2.6;

    const [px, pz] = metersToLocal(coords[0][0], coords[0][1]);
    const [nx, nz] = metersToLocal(coords[1][0], coords[1][1]);
    const y = terrainLocalYAt(px, pz) + LAYER.road + 0.018;

    const dx = nx - px;
    const dz = nz - pz;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.001) continue;

    const rdx = dx / len;
    const rdz = dz / len;
    const roadAngle = Math.atan2(rdx, rdz);

    for (let s = 0; s < stripeCount; s++) {
      const offset = -totalLen / 2 + s * (stripeW + stripeGap) + stripeW / 2;
      const stripeGeo = new THREE.BoxGeometry(cwLen, 0.02, stripeW);
      const stripe = new THREE.Mesh(stripeGeo, cwMat);
      stripe.position.set(px + rdx * offset, y, pz + rdz * offset);
      stripe.rotation.y = roadAngle;
      stripe.renderOrder = 35;
      crosswalkGroup.add(stripe);
    }
  }
}

// Moves the traffic along its curves every frame: cars, bicycles (wheels
// spinning) and walking people (arms and legs swinging).
export function updateTraffic(time, delta) {
  for (const c of state.cars) {
    c.t += c.speed * settings.trafficSpeed;
    if (c.t > 1) c.t = 0;
    const safe = Math.min(Math.max(c.t, 0.01), 0.99);
    const pos = c.curve.getPointAt(safe);
    const tan = c.curve.getTangentAt(safe);
    const roadY = terrainLocalYAt(pos.x, pos.z) + LAYER.road + LAYER.carExtra;
    c.car.position.set(pos.x, roadY, pos.z);
    // Flatten tangent (no Y tilt) and negate (car front faces -Z)
    const horiz = Math.sqrt(tan.x * tan.x + tan.z * tan.z);
    if (horiz > 0.001) {
      c.car.lookAt(pos.x - tan.x / horiz, roadY, pos.z - tan.z / horiz);
    }
  }
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
  for (const p of state.pedestrians) {
    p.t += p.speed;
    if (p.t > 1) p.t = 0;
    const safe = Math.min(Math.max(p.t, 0.01), 0.99);
    const pos = p.curve.getPointAt(safe);
    const tan = p.curve.getTangentAt(safe);
    const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const offsetMag = p.surface === 'path'
      ? (p.lateralOffset || 0)
      : (settings.roadWidth * 0.5 + 0.3) * p.offsetDir;
    pos.add(right.multiplyScalar(offsetMag));

    const pedY = terrainLocalYAt(pos.x, pos.z) + (p.surface === 'path' ? LAYER.path + 0.10 : LAYER.sidewalk + 0.08);
    const walkT = time * 0.006 + p.phase;
    const swing = Math.sin(walkT) * p.walkAmplitude;
    const counter = -swing;
    if (p.limbRefs) {
      p.limbRefs.leftArm.rotation.x = counter;
      p.limbRefs.rightArm.rotation.x = swing;
      p.limbRefs.leftLeg.rotation.x = swing;
      p.limbRefs.rightLeg.rotation.x = counter;
      p.limbRefs.leftShoe.position.z = -0.04 + Math.max(0, swing) * 0.08;
      p.limbRefs.rightShoe.position.z = -0.04 + Math.max(0, counter) * 0.08;
    }
    p.mesh.position.set(pos.x, pedY + Math.abs(Math.sin(walkT * 2)) * 0.025, pos.z);
    p.mesh.lookAt(pos.clone().add(tan.clone().multiplyScalar(p.offsetDir))); // look along direction
  }
}
