// @ts-check
// OGC 3D Tiles 1.1 export of the current scene: a tileset.json whose root
// is placed on the globe from the export's georeference, with one glTF (GLB)
// per 800 m tile, zipped for download. Opens in CesiumJS, Cesium ion,
// ArcGIS, Unreal/Unity (Cesium plug-ins) and other 3D Tiles clients.
//
// Tile content is in projected-grid metres relative to the scene centre:
// glTF x = grid east, y = up, z = -grid north, which 3D Tiles turns into
// x east, y north, z up before the root transform.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { rootTransform, tilesetJson, zipStore } from './tiles_math.js';

const TILE_SIZE = 800;
const KEEP_ATTRIBUTES = ['position', 'normal', 'uv', 'color'];

// Float copies of the attributes glTF clients read; the viewer's compact
// (normalized integer) and custom attributes are dropped.
function exportGeometry(src) {
  const geo = new THREE.BufferGeometry();
  for (const name of KEEP_ATTRIBUTES) {
    const a = src.getAttribute(name);
    if (!a) continue;
    if (name === 'color' && a.itemSize !== 3 && a.itemSize !== 4) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent(i, k);
    }
    if (name === 'normal') {
      // glTF requires unit normals.
      for (let i = 0; i < out.length; i += 3) {
        const l = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
        out[i] /= l;
        out[i + 1] /= l;
        out[i + 2] /= l;
      }
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) geo.setIndex(Array.from(src.index.array));
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  return geo;
}

function exportMaterial(src, cache) {
  const m = Array.isArray(src) ? src[0] : src;
  if (!m) return new THREE.MeshStandardMaterial();
  if (cache.has(m)) return cache.get(m);
  const out = new THREE.MeshStandardMaterial({
    color: m.color ? m.color.clone() : new THREE.Color(0xffffff),
    map: m.map || null,
    vertexColors: !!m.vertexColors,
    roughness: Number.isFinite(m.roughness) ? m.roughness : 0.8,
    metalness: Number.isFinite(m.metalness) ? m.metalness : 0,
    transparent: !!m.transparent,
    opacity: Number.isFinite(m.opacity) ? m.opacity : 1,
    side: m.side ?? THREE.FrontSide,
    name: m.name || ''
  });
  cache.set(m, out);
  return out;
}

function exportable(o) {
  if (!(o.isMesh || o.isInstancedMesh) || !o.geometry?.getAttribute('position')) return false;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  // Overlays drawn without depth (heatmaps, plumes, outlines) are not scene.
  if (m && m.depthWrite === false && m.transparent) return false;
  return true;
}

function isVisible(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * @param {object} args
 * @param {any[]} args.roots Object3Ds to export (their visible meshes)
 * @param {any} args.georeference manifest.georeference (control points)
 * @param {number[]} args.centre [x, y] scene centre in the export CRS
 * @param {number} [args.xSign] the viewer's LOCAL_X_SIGN (scene x = sign * grid east)
 * @param {number} [args.heightOffset] metres added to heights (e.g. geoid undulation)
 * @param {(fraction: number) => void} [args.onProgress]
 * @returns {Promise<{ blob: Blob, tiles: number, lon: number, lat: number }>}
 */
export async function exportTiles3D({ roots, georeference, centre, xSign = 1, heightOffset = 0, onProgress }) {
  const placement = rootTransform(georeference, centre[0], centre[1], heightOffset);
  if (!placement) throw new Error('This export has no georeference: re-export from QGIS with a projected CRS.');

  // Bucket meshes by tile on the ground plane.
  const buckets = new Map();
  const box = new THREE.Box3();
  const centreV = new THREE.Vector3();
  for (const root of roots) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!exportable(o) || !isVisible(o)) return;
      box.setFromObject(o);
      if (box.isEmpty()) return;
      box.getCenter(centreV);
      const span = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
      // Very large single meshes (terrain) get a tile of their own.
      const key = span > TILE_SIZE * 1.5
        ? `big_${o.id}`
        : `${Math.floor((xSign * centreV.x) / TILE_SIZE)}_${Math.floor(centreV.z / TILE_SIZE)}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(o);
    });
  }
  if (!buckets.size) throw new Error('Nothing visible to export.');

  const exporter = new GLTFExporter();
  const materials = new Map();
  const files = [];
  const children = [];
  let done = 0;
  for (const [key, meshes] of buckets) {
    const scene = new THREE.Scene();
    // Scene axes -> glTF grid axes: x = sign * x, z = -z (a rotation for
    // sign = -1).
    const frame = new THREE.Group();
    frame.scale.set(xSign, 1, -1);
    scene.add(frame);
    const tileBox = new THREE.Box3();
    for (const o of meshes) {
      const geo = exportGeometry(o.geometry);
      const mat = exportMaterial(o.material, materials);
      let copy;
      if (o.isInstancedMesh) {
        copy = new THREE.InstancedMesh(geo, mat, o.count);
        const m = new THREE.Matrix4();
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          copy.setMatrixAt(i, m);
        }
        copy.instanceMatrix.needsUpdate = true;
      } else {
        copy = new THREE.Mesh(geo, mat);
      }
      copy.matrixAutoUpdate = false;
      copy.matrix.copy(o.matrixWorld);
      copy.name = o.name || '';
      frame.add(copy);
      tileBox.union(box.setFromObject(o));
    }
    const glb = await exporter.parseAsync(scene, { binary: true, maxTextureSize: 512 });
    const uri = `tiles/${key}.glb`;
    files.push({ name: uri, data: new Uint8Array(glb) });
    // Bounds in content axes (x east, y north, z up); the height offset is
    // part of the root transform.
    const xs = [xSign * tileBox.min.x, xSign * tileBox.max.x];
    children.push({
      uri,
      min: [Math.min(...xs), tileBox.min.z, tileBox.min.y],
      max: [Math.max(...xs), tileBox.max.z, tileBox.max.y]
    });
    for (const o of frame.children) o.geometry.dispose();
    done++;
    if (onProgress) onProgress(done / buckets.size);
    await new Promise((r) => setTimeout(r, 0));
  }

  const tileset = tilesetJson({ transform: placement.transform, children });
  const readme = [
    'PlanX 3D City - OGC 3D Tiles 1.1 export',
    '',
    `Scene centre: lon ${placement.lon.toFixed(7)}, lat ${placement.lat.toFixed(7)}`,
    `Source CRS: ${georeference.crs || 'unknown'}`,
    `Height offset applied: ${heightOffset} m (heights are the DEM's; add the geoid undulation to sit on ellipsoid-based globes)`,
    '',
    'Serve this folder over HTTP and load tileset.json, e.g. in CesiumJS:',
    "  const tileset = await Cesium.Cesium3DTileset.fromUrl('tileset.json');",
    '  viewer.scene.primitives.add(tileset);'
  ].join('\n');
  const enc = new TextEncoder();
  const zip = zipStore([
    { name: 'tileset.json', data: enc.encode(JSON.stringify(tileset, null, 1)) },
    { name: 'README.txt', data: enc.encode(readme) },
    ...files
  ]);
  return { blob: new Blob([zip], { type: 'application/zip' }), tiles: files.length, lon: placement.lon, lat: placement.lat };
}
