// Trees: stylized or realistic variants from the tree catalogue, merged per
// variant into instanced crowns and trunks, with optional wind sway.
import * as THREE from 'three';
import { applyWindSway, setWind } from '../wind.js';
import { TREE_VARIANT_CATALOG, TREE_PROFILE_DEFAULT, TREE_VARIANT_PROFILES, assetColor } from '../catalog.js';
import { compassDirection } from '../geo.js';
import { parseNumberProp } from '../props.js';
import { treeLeafTextureForVariant } from '../textures.js';
import { treeGroup, LAYER } from '../core/scene.js';
import { assetPoolVariants, mappedField, settings } from '../core/settings.js';
import { setStatus } from '../ui/status.js';
import { metersToLocal } from '../core/data.js';
import { clearGroup } from '../core/scene_util.js';
import { terrainLocalYAt } from '../terrain/terrain.js';
import { uploadedModels } from '../core/model_store.js';

// Legacy tree renderer retained only for regression reference.
function parseRandRangeExpr(expr) {
  const text = String(expr || '').trim();
  if (!text) return null;
  const match = /^rand\s*\(\s*([-+]?\d+(?:[.,]\d+)?)\s*,\s*([-+]?\d+(?:[.,]\d+)?)\s*\)$/i.exec(text);
  if (!match) return null;
  let min = Number(match[1].replace(',', '.'));
  let max = Number(match[2].replace(',', '.'));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max < min) [min, max] = [max, min];
  return { min, max };
}

function deterministicUnitHash(x, z, salt = 0) {
  const raw = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453123;
  return raw - Math.floor(raw);
}

function treeLeafMaterial(variantName, profile, realisticMode = false) {
  if (!realisticMode) {
    return new THREE.MeshStandardMaterial({
      color: assetColor(variantName, 0x3b6e2e),
      roughness: profile.shape === 'columnar' || profile.shape === 'cypress' ? 0.86 : 0.9
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: treeLeafTextureForVariant(variantName),
    roughness: 0.88,
    metalness: 0.02
  });
}

function treeCrownGeometry(shape, realisticMode = false) {
  switch (shape) {
    case 'linden': return new THREE.SphereGeometry(1, realisticMode ? 16 : 8, realisticMode ? 12 : 6);
    case 'plane': return realisticMode ? new THREE.SphereGeometry(1, 14, 10) : new THREE.DodecahedronGeometry(1, 1);
    case 'compact': return realisticMode ? new THREE.IcosahedronGeometry(1, 2) : new THREE.IcosahedronGeometry(1, 1);
    case 'columnar': return new THREE.CylinderGeometry(0.62, 0.78, 2.1, realisticMode ? 14 : 10);
    case 'olive': return new THREE.SphereGeometry(1, realisticMode ? 14 : 7, realisticMode ? 10 : 5);
    case 'cypress': return new THREE.ConeGeometry(1, 2.8, realisticMode ? 14 : 10);
    case 'palm': return new THREE.ConeGeometry(1, 1.2, realisticMode ? 10 : 6);
    case 'jacaranda': return realisticMode ? new THREE.SphereGeometry(1, 14, 10) : new THREE.DodecahedronGeometry(1, 0);
    case 'pine': return new THREE.ConeGeometry(1, 2.5, realisticMode ? 14 : 9);
    case 'broadleaf': return new THREE.SphereGeometry(1, realisticMode ? 16 : 10, realisticMode ? 12 : 7);
    default: return new THREE.SphereGeometry(1, realisticMode ? 16 : 8, realisticMode ? 12 : 6);
  }
}

function crownGeometryMinY(geometry, fallback = -1) {
  if (!geometry) return fallback;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return Number.isFinite(geometry.boundingBox?.min?.y) ? geometry.boundingBox.min.y : fallback;
}

function activeTreeVariantsForBuild() {
  const fromTheme = assetPoolVariants('trees');
  const unique = [];
  const addUnique = (name) => {
    const clean = String(name || '').trim();
    if (clean && !unique.includes(clean)) unique.push(clean);
  };
  fromTheme.forEach(addUnique);
  TREE_VARIANT_CATALOG.forEach(addUnique);
  let count = Math.round(Number(settings.treeVariantCount) || 8);
  if (!Number.isFinite(count)) count = 8;
  count = Math.max(1, Math.min(TREE_VARIANT_CATALOG.length, count));
  return unique.slice(0, Math.max(1, Math.min(count, unique.length)));
}

function isFiniteCoord(coord) {
  return Array.isArray(coord) && coord.length >= 2 && Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
}

function centroidFromCoords(coords) {
  const pts = (coords || []).filter(isFiniteCoord);
  if (!pts.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
  return [(minX + maxX) * 0.5, (minY + maxY) * 0.5];
}

function representativeTreeCoords(geometry) {
  if (!geometry || !geometry.type) return [];
  const c = geometry.coordinates;
  if (geometry.type === 'Point') return isFiniteCoord(c) ? [c] : [];
  if (geometry.type === 'MultiPoint') return Array.isArray(c) ? c.filter(isFiniteCoord) : [];
  if (geometry.type === 'LineString') {
    if (!Array.isArray(c) || !c.length) return [];
    const mid = c[Math.floor(c.length / 2)];
    return isFiniteCoord(mid) ? [mid] : [];
  }
  if (geometry.type === 'MultiLineString') {
    if (!Array.isArray(c) || !c.length) return [];
    for (const line of c) {
      if (!Array.isArray(line) || !line.length) continue;
      const mid = line[Math.floor(line.length / 2)];
      if (isFiniteCoord(mid)) return [mid];
    }
    return [];
  }
  if (geometry.type === 'Polygon') {
    const ring = Array.isArray(c) && c.length ? c[0] : null;
    const centroid = centroidFromCoords(ring);
    return centroid ? [centroid] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    if (!Array.isArray(c) || !c.length) return [];
    for (const poly of c) {
      const ring = Array.isArray(poly) && poly.length ? poly[0] : null;
      const centroid = centroidFromCoords(ring);
      if (centroid) return [centroid];
    }
    return [];
  }
  if (geometry.type === 'GeometryCollection') {
    const geoms = Array.isArray(geometry.geometries) ? geometry.geometries : [];
    for (const g of geoms) {
      const coords = representativeTreeCoords(g);
      if (coords.length) return coords;
    }
  }
  return [];
}

// InstancedMesh trees — dynamic variant buckets (up to 10 presets) with optional randomize + rand(min,max) heights.
// Tree crowns sway with the analysis wind direction while the setting is on
// (the viewer then keeps drawing frames).
export function syncWind() {
  const dir = compassDirection(THREE.MathUtils.degToRad(settings.windDirectionDeg));
  setWind(settings.treeWind ? 0.05 : 0, dir.x, dir.z);
}

export function buildTreeLayer(treesFc, treeModel) {
  clearGroup(treeGroup);
  syncWind();
  if (!treesFc?.features?.length) return;
  const treeSamples = [];
  for (const feat of treesFc.features || []) {
    const coords = representativeTreeCoords(feat?.geometry);
    if (!coords.length) continue;
    for (const coord of coords) treeSamples.push({ feature: feat, coord });
  }
  if (!treeSamples.length) {
    setStatus('Trees layer has no usable coordinates (Point/MultiPoint/Polygon centroid).', true);
    return;
  }
  const mappedHeightField = mappedField('tree_height_field');
  const fallbackHeightFields = ['planx_tree_height', 'tree_height', 'height'];
  const heightFields = mappedHeightField ? [mappedHeightField, ...fallbackHeightFields] : fallbackHeightFields;
  const randomHeightExpr = parseRandRangeExpr(settings.treeHeightRandomExpr);
  const randomizeTrees = !!settings.treeRandomize;
  const realisticTrees = String(settings.treeRenderMode || 'Stylized') === 'Realistic';
  // Tree model pool (Model Studio): one or more uploaded GLB tree models. When
  // the pool has entries, each tree picks a model from it at random (deterministic).
  const treePoolScenes = (Array.isArray(settings.treeModelPool) ? settings.treeModelPool : [])
    .map(id => uploadedModels.find(m => m.id === id && m.category === 'tree'))
    .filter(Boolean)
    .map(m => m.scene);
  const modelBasedTrees = String(settings.treeRenderMode || 'Stylized') === 'Model-based'
    || settings.activeTreeModel !== 'default'
    || treePoolScenes.length > 0;
  const mustUseDefaultHeightRandom = !mappedHeightField && !randomHeightExpr;
  const treeVariants = activeTreeVariantsForBuild();
  if (!treeVariants.length) return;

  const variantsForBuild = randomizeTrees ? treeVariants : treeVariants.slice(0, 1);
  const buckets = variantsForBuild.map(() => []);
  treeSamples.forEach((entry, i) => {
    const coord = entry.coord;
    const feature = entry.feature;
    if (!isFiniteCoord(coord)) return;
    const [x, z] = metersToLocal(coord[0], coord[1]);
    const y = terrainLocalYAt(x, z) + LAYER.content + (settings.treeElevation || 0);
    const baseRandom = 1 + deterministicUnitHash(x, z, i + 101) * 6;
    const sourceHeight = parseNumberProp(feature?.properties || {}, heightFields, NaN);
    let treeH = Number.isFinite(sourceHeight) && sourceHeight > 0.5 ? sourceHeight : baseRandom;
    if (randomHeightExpr) {
      const ratio = deterministicUnitHash(x, z, i + 11);
      treeH = randomHeightExpr.min + ratio * (randomHeightExpr.max - randomHeightExpr.min);
    } else if (mustUseDefaultHeightRandom) {
      treeH = baseRandom;
    }
    treeH = Math.max(0.8, treeH);
    const variantIndex = randomizeTrees
      ? Math.floor(deterministicUnitHash(x, z, i + 5) * variantsForBuild.length) % variantsForBuild.length
      : i % variantsForBuild.length;
    buckets[variantIndex].push({ x, y, z, h: treeH });
  });

  const customModelEntry = settings.activeTreeModel !== 'default'
    ? uploadedModels.find(m => m.id === settings.activeTreeModel)
    : null;
  // Priority: random pool > single active model > bundled default tree.glb.
  const modelScenes = treePoolScenes.length
    ? treePoolScenes
    : (customModelEntry ? [customModelEntry.scene] : (treeModel ? [treeModel] : []));

  if (modelBasedTrees && modelScenes.length) {
    const tsx = settings.treeScaleX !== undefined ? settings.treeScaleX : 1.0;
    const tsy = settings.treeScaleY !== undefined ? settings.treeScaleY : 1.0;
    const tsz = settings.treeScaleZ !== undefined ? settings.treeScaleZ : 1.0;
    buckets.forEach((trees) => {
      trees.forEach(({ x, y, z, h }) => {
        const pick = modelScenes.length > 1
          ? modelScenes[Math.floor(deterministicUnitHash(x, z, 73) * modelScenes.length) % modelScenes.length]
          : modelScenes[0];
        const m = pick.clone();
        m.position.set(x, y, z);
        const scaleFactor = h / 8.0;
        m.scale.set(scaleFactor * tsx, scaleFactor * tsy, scaleFactor * tsz);
        const rot = ((x * 13.7 + z * 7.3) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        m.rotation.y = rot;
        m.traverse(child => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        treeGroup.add(m);
      });
    });
    return;
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.95 });
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1, 6);
  const dummy = new THREE.Object3D();

  buckets.forEach((trees, vi) => {
    if (!trees.length) return;
    const variantName = variantsForBuild[vi] || TREE_VARIANT_CATALOG[0];
    const profile = TREE_VARIANT_PROFILES[variantName] || TREE_PROFILE_DEFAULT;
    const crownGeo = treeCrownGeometry(profile.shape, realisticTrees);
    const crownMinY = crownGeometryMinY(crownGeo, -1);
    const leafMat = applyWindSway(treeLeafMaterial(variantName, profile, realisticTrees));
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
    trunkInst.frustumCulled = false;
    trunkInst.castShadow = true;
    const crownInst = new THREE.InstancedMesh(crownGeo, leafMat, trees.length);
    crownInst.frustumCulled = false;
    crownInst.castShadow = true;
    crownInst.userData.planxTreeVariant = variantName;
    let canopyUpperInst = null;
    if (realisticTrees && profile.shape !== 'palm') {
      const upperGeo = treeCrownGeometry(profile.shape, true);
      const upperMat = applyWindSway(treeLeafMaterial(variantName, profile, true));
      canopyUpperInst = new THREE.InstancedMesh(upperGeo, upperMat, trees.length);
      canopyUpperInst.frustumCulled = false;
      canopyUpperInst.castShadow = true;
      canopyUpperInst.userData.planxTreeVariant = `${variantName}-upper`;
    }

    trees.forEach(({ x, y, z, h }, idx) => {
      const trunkH = Math.max(1.1, h * profile.trunkRatio);
      const crownH = Math.max(1.4, h - trunkH);
      const rot = ((x * 13.7 + z * 7.3) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

      dummy.position.set(x, y + trunkH * 0.5, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, trunkH, 1);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      const crownRadius = crownH * profile.crownWidth;
      const crownVertical = crownH * profile.crownHeight;
      const crownEmbed = Number.isFinite(profile.crownEmbed) ? profile.crownEmbed : 0.08;
      const coneLike = profile.shape === 'cypress' || profile.shape === 'pine' || profile.shape === 'palm';
      const crownY = coneLike
        ? (y + trunkH - crownH * crownEmbed - crownMinY * crownVertical)
        : (y + trunkH + crownVertical * 0.5 - crownH * crownEmbed);
      dummy.position.set(x, crownY, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(crownRadius, crownVertical, crownRadius);
      dummy.updateMatrix();
      crownInst.setMatrixAt(idx, dummy.matrix);
      if (canopyUpperInst) {
        const upperRadius = crownRadius * 0.76;
        const upperVertical = crownVertical * 0.62;
        const upperY = crownY + upperVertical * 0.56;
        dummy.position.set(x, upperY, z);
        dummy.rotation.set(0, rot + 0.45, 0);
        dummy.scale.set(upperRadius, upperVertical, upperRadius);
        dummy.updateMatrix();
        canopyUpperInst.setMatrixAt(idx, dummy.matrix);
      }
    });

    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    crownInst.computeBoundingSphere();
    if (canopyUpperInst) {
      canopyUpperInst.instanceMatrix.needsUpdate = true;
      canopyUpperInst.computeBoundingSphere();
      treeGroup.add(trunkInst, crownInst, canopyUpperInst);
    } else {
      treeGroup.add(trunkInst, crownInst);
    }
  });
}
