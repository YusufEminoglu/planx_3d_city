// Street furniture: lights (glowing at night), benches, bins and bus stops,
// turned to face the nearest road.
import * as THREE from 'three';
import { numericPropFirst } from '../props.js';
import { state } from '../core/state.js';
import { furnitureGroup } from '../core/scene.js';
import { assetPoolVariants, namesWithMapping, settings } from '../core/settings.js';
import { metersToLocal } from '../core/data.js';
import { clearGroup } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';
import { uploadedModels } from '../core/model_store.js';

function nearestRoadInfo(x, z) {
  let bestDist = Infinity;
  let bestAngle = 0;
  let bestSide = 1;
  for (const curve of state.roadCurves || []) {
    const samples = 28;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d < bestDist) {
        const tangent = curve.getTangentAt(t);
        bestDist = d;
        bestAngle = Math.atan2(tangent.x, tangent.z);
        const cross = tangent.x * (z - p.z) - tangent.z * (x - p.x);
        bestSide = cross >= 0 ? 1 : -1;
      }
    }
  }
  return { angle: bestAngle, side: bestSide, distance: Math.sqrt(bestDist) };
}

function furnitureRotationY(feature, x, z, mappedKey) {
  const props = feature?.properties || {};
  const fieldNames = namesWithMapping(mappedKey, [
    'planx_angle', 'planx_rotation', 'angle', 'rotation', 'rot', 'heading', 'bearing', 'azimuth', 'direction'
  ]);
  const deg = numericPropFirst(props, fieldNames);
  if (deg !== null) return -THREE.MathUtils.degToRad(deg);
  const info = nearestRoadInfo(x, z);
  if (mappedKey === 'light_angle_field') return info.angle + Math.PI;
  if (mappedKey === 'bench_angle_field' || mappedKey === 'busstop_angle_field') return info.angle + info.side * Math.PI / 2;
  if (mappedKey === 'trashbin_angle_field') return info.angle;
  return info.angle;
}

export function buildFurnitureLayer() {
  clearGroup(furnitureGroup);
  const db = state.layerDataCache.furniture || {};
  const { lights, benches, bins, busstops } = db;
  
  // Materials
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6e4b2d, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6 });
  const poolStyle = (category, current, fallbacks) => {
    const variants = assetPoolVariants(category);
    const allowed = variants.length ? variants : fallbacks;
    return allowed.includes(current) ? current : allowed[0];
  };
  const activeLightStyle = poolStyle('lights', settings.lightStyle, ['Modern Arc', 'Classic Post', 'Dual Head']);
  const activeBenchStyle = poolStyle('benches', settings.benchStyle, ['Wood Plank', 'Concrete Slab', 'Curved Metal']);
  const activeBinStyle = poolStyle('bins', settings.binStyle, ['Square Box', 'Cylinder', 'Dual Recycle']);
  const activeStopStyle = poolStyle('busstops', settings.stopStyle, ['Glass Shelter', 'Minimal Canopy', 'Wood Cabin']);

  function getLightGeo() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4, 8), metalMat);
    pole.position.y = 2;
    const isNight = (state.solar.elevationDeg ?? 30) < -3;
    const lampMat = new THREE.MeshStandardMaterial({
      color: isNight ? 0xffffee : 0xdddddd, 
      emissive: isNight ? 0xffcc88 : 0x000000,
      emissiveIntensity: isNight ? 2.0 : 0
    });
    if (activeLightStyle === 'Classic Post') {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), lampMat);
      lamp.position.set(0, 4.2, 0);
      g.add(pole, lamp);
    } else if (activeLightStyle === 'Heritage Lantern') {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.18, 6), metalMat);
      cap.position.y = 4.35;
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), lampMat);
      lantern.position.y = 4.08;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.018, 6, 16), metalMat);
      ring.position.y = 4.34;
      g.add(pole, cap, lantern, ring);
    } else if (activeLightStyle === 'Slim Post') {
      pole.scale.set(0.62, 0.88, 0.62);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.55), lampMat);
      head.position.set(0.18, 3.55, 0);
      g.add(pole, head);
    } else if (activeLightStyle === 'Bollard Path') {
      pole.scale.set(1.05, 0.32, 1.05);
      pole.position.y = 0.65;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 12), lampMat);
      cap.position.y = 1.32;
      g.add(pole, cap);
    } else if (activeLightStyle === 'Campus Twin') {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.08), metalMat);
      cross.position.y = 3.7;
      const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 8), lampMat);
      l1.position.set(0.42, 3.65, 0);
      const l2 = l1.clone();
      l2.position.set(-0.42, 3.65, 0);
      g.add(pole, cross, l1, l2);
    } else if (activeLightStyle === 'Dual Head') {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), metalMat);
      cross.position.y = 4;
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.2), lampMat);
      l1.position.set(0.5, 4, 0);
      const l2 = l1.clone();
      l2.position.set(-0.5, 4, 0);
      g.add(pole, cross, l1, l2);
    } else { // Modern Arc
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), metalMat);
      arm.position.set(0.3, 4, 0);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.2), lampMat);
      lamp.position.set(0.5, 3.95, 0);
      g.add(pole, arm, lamp);
    }
    return g;
  }

  function getBenchGeo() {
    const g = new THREE.Group();
    if (activeBenchStyle === 'Concrete Slab') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), new THREE.MeshStandardMaterial({color: 0x999999, roughness: 0.9}));
      b.position.y = 0.25;
      g.add(b);
    } else if (activeBenchStyle === 'Stone Seat') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.58), new THREE.MeshStandardMaterial({ color: 0xb9b0a2, roughness: 0.96 }));
      b.position.y = 0.24;
      const groove = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.04, 0.08), new THREE.MeshStandardMaterial({ color: 0x8e8578, roughness: 0.98 }));
      groove.position.set(0, 0.47, -0.18);
      g.add(b, groove);
    } else if (activeBenchStyle === 'Curved Metal') {
      const mMat = new THREE.MeshStandardMaterial({color: 0x555555, metalness: 0.6, roughness: 0.4});
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 12, 1, false, 0, Math.PI), mMat);
      seat.rotation.z = Math.PI/2;
      seat.position.y = 0.3;
      const l1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.4), mMat);
      l1.position.set(0.7, 0.2, 0);
      const l2 = l1.clone();
      l2.position.set(-0.7, 0.2, 0);
      g.add(seat, l1, l2);
    } else if (activeBenchStyle === 'Slim Urban') {
      const mMat = new THREE.MeshStandardMaterial({ color: 0x3f464d, metalness: 0.55, roughness: 0.34 });
      for (let i = 0; i < 4; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.055, 0.08), mMat);
        slat.position.set(0, 0.42 + i * 0.1, -0.18 + i * 0.08);
        g.add(slat);
      }
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.36), mMat);
      leg1.position.set(0.62, 0.21, 0.02);
      const leg2 = leg1.clone();
      leg2.position.x = -0.62;
      g.add(leg1, leg2);
    } else if (activeBenchStyle === 'Eco Timber') {
      const ecoMat = new THREE.MeshStandardMaterial({ color: 0x8a6138, roughness: 0.94 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.12, 0.55), ecoMat);
      seat.position.y = 0.42;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.58, 0.10), ecoMat);
      back.position.set(0, 0.76, -0.26);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.22, 0.18), ecoMat);
      leg.position.set(0, 0.16, 0.06);
      g.add(seat, back, leg);
    } else if (activeBenchStyle === 'Classic Iron') {
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.72, roughness: 0.28 });
      for (let i = 0; i < 3; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.07, 0.12), woodMat);
        slat.position.set(0, 0.42 + i * 0.18, -0.16 + i * 0.1);
        g.add(slat);
      }
      const side1 = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 8, 18, Math.PI), ironMat);
      side1.rotation.z = Math.PI / 2;
      side1.position.set(0.78, 0.3, 0.02);
      const side2 = side1.clone();
      side2.position.x = -0.78;
      g.add(side1, side2);
    } else { // Wood Plank
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.5), woodMat);
      seat.position.y = 0.4;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), woodMat);
      back.position.set(0, 0.7, -0.21);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.4), metalMat);
      leg1.position.set(0.6, 0.2, 0);
      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.4), metalMat);
      leg2.position.set(-0.6, 0.2, 0);
      g.add(seat, back, leg1, leg2);
    }
    return g;
  }

  function getBinGeo() {
    if (activeBinStyle === 'Square Box') {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), new THREE.MeshStandardMaterial({color: 0x222222}));
      b.position.y = 0.4;
      return b;
    } else if (activeBinStyle === 'Compact') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.42), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78 }));
      body.position.y = 0.31;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.52), new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.72 }));
      lid.position.y = 0.66;
      g.add(body, lid);
      return g;
    } else if (activeBinStyle === 'Solar Compactor') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.92, 0.48), new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 }));
      body.position.y = 0.46;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.36), new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.4, roughness: 0.22 }));
      panel.position.set(0, 0.96, -0.02);
      panel.rotation.x = -0.22;
      g.add(body, panel);
      return g;
    } else if (activeBinStyle === 'Dual Recycle') {
      const g = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.4), new THREE.MeshStandardMaterial({color: 0x225588}));
      b1.position.set(-0.22, 0.35, 0);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.7, 0.4), new THREE.MeshStandardMaterial({color: 0x226622}));
      b2.position.set(0.22, 0.35, 0);
      g.add(b1, b2);
      return g;
    } else { // Cylinder
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 12), new THREE.MeshStandardMaterial({color: 0x2d3748}));
      b.position.y = 0.4;
      return b;
    }
  }

  function getStopGeo() {
    const g = new THREE.Group();
    if (activeStopStyle === 'Compact Marker') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2), metalMat);
      pole.position.y = 1.1;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.52, 0.06), new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.58 }));
      sign.position.y = 2.0;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.08, 10), metalMat);
      base.position.y = 0.04;
      g.add(pole, sign, base);
    } else if (activeStopStyle === 'Minimal Canopy') {
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.8), metalMat);
      pole1.position.set(-1.5, 1.4, -0.5);
      const pole2 = pole1.clone();
      pole2.position.set(1.5, 1.4, -0.5);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.1, 1.8), new THREE.MeshStandardMaterial({color: 0xdddddd}));
      roof.position.set(0, 2.8, 0);
      g.add(pole1, pole2, roof);
    } else if (activeStopStyle === 'Wood Cabin') {
      const wBase = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.1, 1.6), woodMat);
      const wBack = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.1), woodMat);
      wBack.position.set(0, 1.2, -0.75);
      const wRoof = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.8), woodMat);
      wRoof.position.set(0, 2.4, 0);
      const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, 1.5), woodMat);
      s1.position.set(-1.75, 1.2, 0);
      const s2 = s1.clone();
      s2.position.set(1.75, 1.2, 0);
      g.add(wBase, wBack, wRoof, s1, s2);
    } else if (activeStopStyle === 'Steel Canopy') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.55), metalMat);
      const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.5), metalMat);
      pole1.position.set(-1.65, 1.25, -0.52);
      const pole2 = pole1.clone();
      pole2.position.x = 1.65;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.35, 0.12, 1.95), new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.45, roughness: 0.38 }));
      roof.position.y = 2.55;
      roof.rotation.x = -0.08;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.42), woodMat);
      bench.position.set(0, 0.48, 0.18);
      g.add(base, pole1, pole2, roof, bench);
    } else { // Glass Shelter
      const base = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 1.5), metalMat);
      const wall1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), glassMat);
      wall1.position.set(-1.95, 1.25, 0);
      const wall2 = wall1.clone();
      wall2.position.set(1.95, 1.25, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 0.1), glassMat);
      back.position.set(0, 1.25, -0.7);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.1, 1.8), metalMat);
      roof.position.y = 2.55;
      g.add(base, wall1, wall2, back, roof);
    }
    return g;
  }

  const customLightEntry = settings.activeLightModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeLightModel)
    : null;
  const lightGeo = customLightEntry ? customLightEntry.scene : getLightGeo();

  const customBenchEntry = settings.activeBenchModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeBenchModel)
    : null;
  const benchGeo = customBenchEntry ? customBenchEntry.scene : getBenchGeo();

  const customBinEntry = settings.activeBinModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeBinModel)
    : null;
  const binMesh = customBinEntry ? customBinEntry.scene : getBinGeo();

  const customStopEntry = settings.activeBusStopModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeBusStopModel)
    : null;
  const stopGeo = customStopEntry ? customStopEntry.scene : getStopGeo();
  const angleFieldKeyByKind = {
    lights: 'light_angle_field',
    benches: 'bench_angle_field',
    bins: 'trashbin_angle_field',
    busstops: 'busstop_angle_field'
  };

  const furnitureElevationByKind = {
    lights: settings.lightElevation || 0,
    benches: settings.benchElevation || 0,
    bins: settings.binElevation || 0,
    busstops: settings.busstopElevation || 0
  };
  const furnitureScaleByKind = {
    lights: ['lightScaleX', 'lightScaleY', 'lightScaleZ'],
    benches: ['benchScaleX', 'benchScaleY', 'benchScaleZ'],
    bins: ['binScaleX', 'binScaleY', 'binScaleZ'],
    busstops: ['busstopScaleX', 'busstopScaleY', 'busstopScaleZ']
  };
  const furnitureRotationByKind = {
    lights: settings.lightRotation || 0,
    benches: settings.benchRotation || 0,
    bins: settings.binRotation || 0,
    busstops: settings.busstopRotation || 0
  };
  const placeItem = (feats, modelTemplate, kind) => {
    if (!feats || !feats.features) return;
    const elevOffset = furnitureElevationByKind[kind] || 0;
    const sk = furnitureScaleByKind[kind];
    const sx = sk && settings[sk[0]] !== undefined ? settings[sk[0]] : 1.0;
    const sy = sk && settings[sk[1]] !== undefined ? settings[sk[1]] : 1.0;
    const sz = sk && settings[sk[2]] !== undefined ? settings[sk[2]] : 1.0;
    // Manual rotation offset (deg) added on top of the road-aligned/attribute angle.
    const rotOffset = THREE.MathUtils.degToRad(furnitureRotationByKind[kind] || 0);
    feats.features.forEach(f => {
      if (!f.geometry || f.geometry.type !== 'Point') return;
      const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
      // Furniture meshes are modelled pivot-at-base; place directly on terrain
      // with a tiny anti-z-fighting offset. Earlier (LAYER.content + LAYER.road)
      // sum lifted them ~1 m into the air.
      const y = terrainLocalYAt(x, z) + (settings.furnitureGroundOffset ?? 0.02) + elevOffset;
      const m = modelTemplate.clone();
      m.position.set(x, y, z);
      if (sx !== 1.0 || sy !== 1.0 || sz !== 1.0) m.scale.set(sx, sy, sz);
      m.rotation.y = furnitureRotationY(f, x, z, angleFieldKeyByKind[kind]) - rotOffset;
      furnitureGroup.add(m);
    });
  };

  const isNight = (state.solar.elevationDeg ?? 30) < -3;
  if (settings.showLights) {
    placeItem(lights, lightGeo, 'lights');
    if (isNight && lights && lights.features) {
      lights.features.forEach((f) => {
        if (!f.geometry || f.geometry.type !== 'Point') return;
        const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
        const y = terrainLocalYAt(x, z) + (settings.furnitureGroundOffset ?? 0.02) + (settings.lightElevation || 0) + 4.2;
        const pl = new THREE.PointLight(0xffcc88, 1.4, 24);
        pl.position.set(x, y, z);
        furnitureGroup.add(pl);
      });
    }
  }
  if (settings.showBenches) placeItem(benches, benchGeo, 'benches');
  if (settings.showBins) placeItem(bins, binMesh, 'bins');
  if (settings.showBusStops) placeItem(busstops, stopGeo, 'busstops');
}
