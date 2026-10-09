// Ground layers: city blocks (islands) with category styles, parcels,
// hardscape, fences and water lines.
import * as THREE from 'three';
import { textureSets } from '../catalog.js';
import { getPolygonRings } from '../geo.js';
import { propFirst, normalizeHexColor, presetValue, parseNumberProp } from '../props.js';
import {
  createIslandTexturePreset, createTintedIslandTexturePreset, createWaterTexture, createSteelFenceTexture,
  createWoodFenceTexture, createSoftNoiseTexture
} from '../textures.js';
import { state } from '../core/state.js';
import { islandGroup, parcelGroup, hardscapeGroup, fenceGroup, waterlineGroup, LAYER } from '../core/scene.js';
import { settings, blockCategoryValue, ensureBlockCategoryStyle } from '../core/settings.js';
import { textureFromSet, metersToLocal } from '../core/data.js';
import {
  clearGroup, shapeFromLocalPolygon, isSceneBuildStale, indexAndMergeNonIndexed, subdivideShapeGeometry
} from '../core/scene_util.js';
import { islandPlateauCache, applyIslandMaterialVisibility, terrainLocalYAt } from '../terrain/terrain.js';

// --- Fences & Waterlines Layers implementation ---
export function buildFencesLayer(fences) {
  clearGroup(fenceGroup);
  if (!settings.showFences || !fences?.features?.length) return;
  
  const height = settings.fenceHeight;
  const thickness = settings.fenceThickness;
  const type = settings.fenceTexture;
  const color = new THREE.Color(settings.fenceColor);
  
  let mat;
  if (type === 'steel_fence') {
    mat = new THREE.MeshStandardMaterial({
      color: color,
      map: createSteelFenceTexture(),
      transparent: true,
      alphaTest: 0.1,
      roughness: 0.5,
      metalness: 0.8,
      side: THREE.DoubleSide
    });
  } else if (type === 'wood_fence') {
    mat = new THREE.MeshStandardMaterial({
      color: color,
      map: createWoodFenceTexture(),
      transparent: true,
      alphaTest: 0.1,
      roughness: 0.9,
      side: THREE.DoubleSide
    });
  } else if (type === 'pipeline') {
    mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.9
    });
  } else {
    mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.9,
      bumpMap: createSoftNoiseTexture(),
      bumpScale: 0.05
    });
  }
  
  const postMat = new THREE.MeshStandardMaterial({
    color: color.clone().multiplyScalar(0.8),
    roughness: 0.6,
    metalness: type === 'pipeline' || type === 'steel_fence' ? 0.8 : 0.2
  });
  
  for (const f of fences.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      
      const pts = [];
      for (const pt of outer) {
        if (!pt || pt.length < 2) continue;
        const [x, z] = metersToLocal(pt[0], pt[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const y = terrainLocalYAt(x, z) + LAYER.island;
        pts.push(new THREE.Vector3(x, y, z));
      }
      if (pts.length < 3) continue;
      
      for (let i = 0; i < pts.length; i++) {
        const A = pts[i];
        const B = pts[(i + 1) % pts.length];
        const distance = A.distanceTo(B);
        if (distance < 0.1) continue;
        
        let geom;
        if (type === 'pipeline') {
          geom = new THREE.CylinderGeometry(thickness, thickness, distance, 8);
          geom.rotateX(Math.PI / 2);
          geom.translate(0, height, 0);
        } else {
          geom = new THREE.BoxGeometry(thickness, height, distance);
          geom.translate(0, height / 2, 0);
        }
        
        const segmentMesh = new THREE.Mesh(geom, mat);
        segmentMesh.castShadow = true;
        segmentMesh.receiveShadow = true;
        
        const midpoint = new THREE.Vector3().addVectors(A, B).multiplyScalar(0.5);
        segmentMesh.position.copy(midpoint);
        segmentMesh.lookAt(B);
        fenceGroup.add(segmentMesh);
        
        if (type !== 'wall') {
          const postH = height;
          const postR = thickness * (type === 'pipeline' ? 1.2 : 1.3);
          const postGeom = new THREE.CylinderGeometry(postR, postR, postH, 8);
          postGeom.translate(0, postH / 2, 0);
          const postMesh = new THREE.Mesh(postGeom, postMat);
          postMesh.castShadow = true;
          postMesh.receiveShadow = true;
          postMesh.position.copy(A);
          fenceGroup.add(postMesh);
        }
      }
    }
  }
}

export function buildWaterlinesLayer(waterlines) {
  clearGroup(waterlineGroup);
  if (!settings.showWaterlines || !waterlines?.features?.length) return;

  const defaultWidth = settings.waterlineWidth;
  const widthField = state.projectManifest?.fieldMappings?.waterline_width_field;

  const mat = new THREE.MeshStandardMaterial({
    color: '#0f5e9c',
    map: createWaterTexture(),
    roughness: 0.06,
    metalness: 0.0,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  // Water mirrors the sky: full environment reflection (walls get a share).
  mat.userData.planxEnvBoost = 3;

  for (const f of waterlines.features) {
    if (f.geometry?.type !== 'LineString' && f.geometry?.type !== 'MultiLineString') continue;

    const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const featureWidth = parseNumberProp(f.properties || {}, widthField ? [widthField] : [], defaultWidth);

    for (const coords of lines) {
      if (coords.length < 2) continue;

      const pts = [];
      for (const pt of coords) {
        if (!pt || pt.length < 2) continue;
        const [x, z] = metersToLocal(pt[0], pt[1]);
        if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
        const y = terrainLocalYAt(x, z) + LAYER.waterline;
        pts.push(new THREE.Vector3(x, y, z));
      }
      if (pts.length < 2) continue;

      for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i];
        const B = pts[i + 1];
        const distance = A.distanceTo(B);
        if (distance < 0.1) continue;

        const dx = B.x - A.x;
        const dz = B.z - A.z;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) continue;

        const nx = -dz / len;
        const nz = dx / len;

        const wHalf = featureWidth / 2;
        
        const p0x = A.x - nx * wHalf;
        const p0z = A.z - nz * wHalf;
        const p0y = terrainLocalYAt(p0x, p0z) + LAYER.waterline;

        const p1x = A.x + nx * wHalf;
        const p1z = A.z + nz * wHalf;
        const p1y = terrainLocalYAt(p1x, p1z) + LAYER.waterline;

        const p2x = B.x - nx * wHalf;
        const p2z = B.z - nz * wHalf;
        const p2y = terrainLocalYAt(p2x, p2z) + LAYER.waterline;

        const p3x = B.x + nx * wHalf;
        const p3z = B.z + nz * wHalf;
        const p3y = terrainLocalYAt(p3x, p3z) + LAYER.waterline;

        const geom = new THREE.BufferGeometry();
        const vertices = new Float32Array([
          p0x, p0y, p0z,
          p1x, p1y, p1z,
          p2x, p2y, p2z,

          p1x, p1y, p1z,
          p3x, p3y, p3z,
          p2x, p2y, p2z
        ]);

        const uvs = new Float32Array([
          0, 0,
          1, 0,
          0, distance / featureWidth,

          1, 0,
          1, distance / featureWidth,
          0, distance / featureWidth
        ]);

        geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geom.computeVertexNormals();

        const mesh = new THREE.Mesh(geom, mat);
        mesh.receiveShadow = true;
        waterlineGroup.add(mesh);
      }
    }
  }
}

export async function buildIslandLayer(blocksFc, buildToken = state.sceneBuildToken) {
  clearGroup(islandGroup);
  if (!blocksFc?.features?.length) return;
  const plateauByFeature = new Map(islandPlateauCache.map((c) => [c.feature, c]));
  
  const categories = [...new Set(blocksFc.features.map(f => String(blockCategoryValue(f.properties))))];
  categories.forEach((cat, i) => {
    ensureBlockCategoryStyle(cat, i);
  });

  const customMaterials = {};
  const categoryMode = categories.length > 0;
  
  for (const f of blocksFc.features) {
    const cat = String(blockCategoryValue(f.properties));
    const catStyle = ensureBlockCategoryStyle(cat, categories.indexOf(cat));
    
    const fallbackColor = categoryMode ? catStyle.color : settings.islandColor;
    const fallbackTexture = categoryMode ? catStyle.texture : settings.islandTexture;
    const featureColor = normalizeHexColor(propFirst(f.properties || {}, ['planx_color', 'color']), fallbackColor);
    const featureTexture = presetValue(propFirst(f.properties || {}, ['planx_texture', 'planx_island_texture', 'texture']), textureSets.island, fallbackTexture);
    const featureTextureMap = categoryMode
      ? createTintedIslandTexturePreset(featureTexture, featureColor)
      : createIslandTexturePreset(featureTexture);
    
    const matKey = `${featureColor}_${featureTexture}`;
    if (!customMaterials[matKey]) {
      customMaterials[matKey] = applyIslandMaterialVisibility(new THREE.MeshStandardMaterial({
        color: featureTextureMap ? 0xffffff : new THREE.Color(featureColor),
        map: featureTextureMap,
        roughness: 0.92,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }));
    }
    const mat = customMaterials[matKey];

    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const rawGeo = new THREE.ShapeGeometry(shape);
      rawGeo.rotateX(Math.PI / 2);
      const cacheEntry = settings.flattenIslands ? plateauByFeature.get(f) : null;
      const plateauY = cacheEntry?.plateauY;
      let g;
      if (plateauY != null) {
        g = rawGeo;
      } else {
        const subdivided = subdivideShapeGeometry(rawGeo, 6);
        g = indexAndMergeNonIndexed(subdivided, 0.1);
      }
      const pos = g.attributes.position;
      if (plateauY != null) {
        const flatY = plateauY + LAYER.island;
        for (let vi = 0; vi < pos.count; vi++) {
          pos.setY(vi, flatY);
        }
      } else {
        for (let vi = 0; vi < pos.count; vi++) {
          const vx = pos.getX(vi);
          const vz = pos.getZ(vi);
          pos.setY(vi, terrainLocalYAt(vx, vz) + LAYER.island);
        }
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 0;
      islandGroup.add(m);
    }
  }
}

export function buildParcelLayer(parcelsFc) {
  clearGroup(parcelGroup);
  if (!parcelsFc?.features?.length) return;
  /* Parcels: boundary lines only, no fill.
   * Every vertex takes its own DEM height. */
  const lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(settings.parcelBoundaryColor),
    transparent: true,
    opacity: settings.parcelBoundaryOpacity,
    depthWrite: false          // avoids depth-fighting with block surfaces
  });

  for (const f of parcelsFc.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const pts = [];
      outer.forEach((c) => {
        const [x, z] = metersToLocal(c[0], c[1]);
        const y = terrainLocalYAt(x, z) + LAYER.parcel;
        pts.push(new THREE.Vector3(x, y, z));
      });
      const lg = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.LineLoop(lg, lineMat);
      l.renderOrder = 5;
      parcelGroup.add(l);
    }
  }
}

export async function buildHardscapeLayer(hardscape, buildToken = state.sceneBuildToken) {
  clearGroup(hardscapeGroup);
  if (!hardscape?.features?.length) return;
  const t = await textureFromSet('hardscape', settings.hardscapeStyle, 8, 8);
  if (isSceneBuildStale(buildToken)) return;
  const mat = new THREE.MeshStandardMaterial({
    map: t, roughness: 0.94, metalness: 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  for (const f of hardscape.features) {
    for (const poly of getPolygonRings(f.geometry)) {
      const outer = poly[0];
      if (!outer || outer.length < 3) continue;
      const shape = shapeFromLocalPolygon(poly);
      if (!shape) continue;
      const raw = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
      raw.rotateX(Math.PI / 2);
      const g = indexAndMergeNonIndexed(subdivideShapeGeometry(raw, 8), 0.1);
      /* -- Per-vertex DEM elevation -- */
      const pos = g.attributes.position;
      for (let vi = 0; vi < pos.count; vi++) {
        const vx = pos.getX(vi);
        const vz = pos.getZ(vi);
        const origY = pos.getY(vi);
        const t = (origY - (-1)) / 1;
        const clampedT = Math.max(0, Math.min(1, t));
        const offset = clampedT * settings.hardscapeHeight;
        const baseDem = terrainLocalYAt(vx, vz);
        pos.setY(vi, baseDem + LAYER.hardscape + offset);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
      if (isSceneBuildStale(buildToken)) return;
      const m = new THREE.Mesh(g, mat);
      m.receiveShadow = true;
      m.renderOrder = 5;
      hardscapeGroup.add(m);
    }
  }
}
