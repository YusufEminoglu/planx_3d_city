// Landmarks: mosques and tumuli, from uploaded glTF models or procedural
// stand-ins, with per-feature customisations.
import * as THREE from 'three';
import { parseNumberProp, numericPropFirst } from '../props.js';
import { state } from '../core/state.js';
import { mosqueGroup, tumulusGroup, LAYER } from '../core/scene.js';
import { settings } from '../core/settings.js';
import { metersToLocal } from '../core/data.js';
import { clearGroup } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';
import { uploadedModels } from '../core/model_store.js';

function createProceduralMosque() {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.2 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 });
  
  const main = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), wallMat);
  main.position.y = 1.5;
  main.castShadow = true;
  main.receiveShadow = true;
  group.add(main);
  
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    domeMat
  );
  dome.position.y = 3;
  dome.castShadow = true;
  group.add(dome);
  
  const minaretOffsets = [
    [-1.9, 1.9],
    [1.9, 1.9]
  ];
  minaretOffsets.forEach(([mx, mz]) => {
    const minaret = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 5, 8), wallMat);
    body.position.y = 2.5;
    body.castShadow = true;
    const balcony = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.3, 8), wallMat);
    balcony.position.y = 4.5;
    balcony.castShadow = true;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1, 8), wallMat);
    top.position.y = 5.1;
    top.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 8), coneMat);
    cap.position.y = 5.9;
    cap.castShadow = true;
    minaret.add(body, balcony, top, cap);
    minaret.position.set(mx, 0, mz);
    group.add(minaret);
  });
  
  return group;
}

export function buildMosqueLayer(mosques, mosqueModel) {
  clearGroup(mosqueGroup);
  if (!settings.showMosques || !mosques?.features?.length) return;
  
  const globalActiveMosqueEntry = settings.activeMosqueModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeMosqueModel)
    : null;
  const globalTemplate = globalActiveMosqueEntry ? globalActiveMosqueEntry.scene : (mosqueModel ? mosqueModel : createProceduralMosque());
  
  mosques.features.forEach((f, index) => {
    if (!f.geometry || f.geometry.type !== 'Point') return;
    const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
    const cust = state.mosqueCustomizations[index] || {};
    const y = terrainLocalYAt(x, z) + LAYER.content + (settings.mosqueElevation || 0) + (Number(cust.elevation) || 0);

    let template = globalTemplate;
    if (cust.modelId === 'procedural') {
      template = createProceduralMosque();
    } else if (cust.modelId && cust.modelId !== 'default') {
      const modelEntry = uploadedModels.find(m => m.id === cust.modelId);
      if (modelEntry) template = modelEntry.scene;
    }
    
    const m = template.clone();
    m.position.set(x, y, z);
    
    const globalScaleX = settings.mosqueScaleX !== undefined ? settings.mosqueScaleX : 1.0;
    const globalScaleY = settings.mosqueScaleY !== undefined ? settings.mosqueScaleY : 1.0;
    const globalScaleZ = settings.mosqueScaleZ !== undefined ? settings.mosqueScaleZ : 1.0;
    
    const props = f.properties || {};
    // The Model Studio global mosque scale is a base; per-placement overrides
    // (or attribute scales) multiply on top so the category slider stays effective.
    const px = (cust.scaleX !== undefined ? cust.scaleX : parseNumberProp(props, ['planx_scale_x', 'scale_x', 'planx_scale', 'scale'], 1.0)) * globalScaleX;
    const py = (cust.scaleY !== undefined ? cust.scaleY : parseNumberProp(props, ['planx_scale_y', 'scale_y', 'planx_scale', 'scale'], 1.0)) * globalScaleY;
    const pz = (cust.scaleZ !== undefined ? cust.scaleZ : parseNumberProp(props, ['planx_scale_z', 'scale_z', 'planx_scale', 'scale'], 1.0)) * globalScaleZ;
    m.scale.set(px, py, pz);
    
    let angleRad;
    if (cust.rotation !== undefined) {
      angleRad = -THREE.MathUtils.degToRad(cust.rotation);
    } else {
      const deg = numericPropFirst(props, ['planx_angle', 'planx_rotation', 'angle', 'rotation']);
      if (deg !== null) {
        angleRad = -THREE.MathUtils.degToRad(deg);
      } else {
        angleRad = -THREE.MathUtils.degToRad(settings.mosqueRotation || 0);
      }
    }
    m.rotation.y = angleRad;
    
    const tintColor = cust.color || '#ffffff';
    m.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (cust.color && cust.color !== '#ffffff') {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const newMat = mat.clone();
              newMat.color.set(tintColor);
              return newMat;
            });
          } else {
            child.material = child.material.clone();
            child.material.color.set(tintColor);
          }
        }
      }
    });
    
    mosqueGroup.add(m);
  });
}

function createProceduralTumulus() {
  // Simple burial-mound model: a low earthy dome on a stone retaining ring,
  // used as the default when no GLB tumulus model is uploaded.
  const group = new THREE.Group();
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x7c6b4f, roughness: 0.97, metalness: 0.0 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x6f7d44, roughness: 0.95, metalness: 0.0 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x9a958c, roughness: 0.85, metalness: 0.05 });

  // Mound: a flattened half-sphere (dome) ~14 m wide, ~5 m tall.
  const radius = 7.5;
  const height = 5.0;
  const moundGeo = new THREE.SphereGeometry(radius, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2);
  moundGeo.scale(1, height / radius, 1);
  const mound = new THREE.Mesh(moundGeo, grassMat);
  mound.castShadow = true;
  mound.receiveShadow = true;
  group.add(mound);

  // Inner soil core slightly below the grass skin to avoid a hollow look at the rim.
  const coreGeo = new THREE.SphereGeometry(radius * 0.96, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  coreGeo.scale(1, (height * 0.9) / (radius * 0.96), 1);
  const core = new THREE.Mesh(coreGeo, soilMat);
  core.position.y = -0.05;
  core.receiveShadow = true;
  group.add(core);

  // Stone retaining ring (krepis) around the base.
  const ringGeo = new THREE.TorusGeometry(radius * 0.98, 0.55, 10, 40);
  const ring = new THREE.Mesh(ringGeo, stoneMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.45;
  ring.castShadow = true;
  ring.receiveShadow = true;
  group.add(ring);

  return group;
}

export function buildTumulusLayer(tumulus, tumulusModel) {
  clearGroup(tumulusGroup);
  if (!settings.showTumulus || !tumulus?.features?.length) return;

  const globalActiveEntry = settings.activeTumulusModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeTumulusModel)
    : null;
  // Global template: uploaded GLB, optional bundled GLB, or the default procedural mound.
  const globalTemplate = globalActiveEntry
    ? globalActiveEntry.scene
    : (tumulusModel ? tumulusModel : createProceduralTumulus());

  const gScaleX = settings.tumulusScaleX !== undefined ? settings.tumulusScaleX : 1.0;
  const gScaleY = settings.tumulusScaleY !== undefined ? settings.tumulusScaleY : 1.0;
  const gScaleZ = settings.tumulusScaleZ !== undefined ? settings.tumulusScaleZ : 1.0;

  tumulus.features.forEach((f, index) => {
    if (!f.geometry || f.geometry.type !== 'Point') return;
    const [x, z] = metersToLocal(f.geometry.coordinates[0], f.geometry.coordinates[1]);
    const cust = state.tumulusCustomizations[index] || {};
    const y = terrainLocalYAt(x, z) + LAYER.content + (settings.tumulusElevation || 0) + (Number(cust.elevation) || 0);

    // Per-placement model override: procedural mound, an uploaded tumulus model, or the global template.
    let template = globalTemplate;
    if (cust.modelId === 'procedural') {
      template = createProceduralTumulus();
    } else if (cust.modelId && cust.modelId !== 'default') {
      const modelEntry = uploadedModels.find(m => m.id === cust.modelId);
      if (modelEntry) template = modelEntry.scene;
    }

    const m = template.clone();
    m.position.set(x, y, z);

    const props = f.properties || {};
    // Per-feature attribute multiplier and per-placement overrides stack on the global X/Y/Z scale.
    const pScale = parseNumberProp(props, ['planx_scale', 'scale', 'tumulus_scale'], 1.0);
    const sx = (cust.scaleX !== undefined ? cust.scaleX : pScale) * gScaleX;
    const sy = (cust.scaleY !== undefined ? cust.scaleY : pScale) * gScaleY;
    const sz = (cust.scaleZ !== undefined ? cust.scaleZ : pScale) * gScaleZ;
    m.scale.set(sx, sy, sz);

    if (cust.rotation !== undefined) {
      m.rotation.y = -THREE.MathUtils.degToRad(cust.rotation);
    } else {
      const deg = numericPropFirst(props, ['planx_angle', 'planx_rotation', 'angle', 'rotation']);
      m.rotation.y = deg !== null
        ? -THREE.MathUtils.degToRad(deg)
        : -THREE.MathUtils.degToRad(settings.tumulusRotation || 0);
    }

    const tintColor = cust.color || '#ffffff';
    m.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (cust.color && cust.color !== '#ffffff') {
          if (Array.isArray(child.material)) {
            child.material = child.material.map(mat => {
              const newMat = mat.clone();
              newMat.color.set(tintColor);
              return newMat;
            });
          } else {
            child.material = child.material.clone();
            child.material.color.set(tintColor);
          }
        }
      }
    });
    tumulusGroup.add(m);
  });
}
