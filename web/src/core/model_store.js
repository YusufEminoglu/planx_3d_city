// Models: user-uploaded glTF models kept in IndexedDB (Model Studio), the
// landmark customisations, and glTF loading with a cache.
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { state } from './state.js';
import { isPortableMode } from './scene.js';
import { notifySaved } from './settings.js';

// --- Model Studio & IndexedDB Storage ---
const dbName = 'PlanX_ModelStudio_DB';
const storeName = 'models';
export const uploadedModels = []; // holds { id, name, category, scene }

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveModelToDB(id, name, category, blob) {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ id, name, category, blob });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    // Model library changed -> the next snapshot must embed the GLB bytes.
    notifySaved({ includeModels: true });
    return result;
  } catch (err) {
    console.error('Error saving model to IndexedDB', err);
  }
}

export async function deleteModelFromDB(id) {
  try {
    const db = await openDB();
    const result = await new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    // Model removed -> resend the library so the server prunes its .glb file.
    notifySaved({ includeModels: true });
    return result;
  } catch (err) {
    console.error('Error deleting model from IndexedDB', err);
  }
}

export async function loadModelsFromDB() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Error loading models from IndexedDB', err);
    return [];
  }
}

export function loadMosqueCustomizations() {
  if (isPortableMode) return;
  try {
    const raw = localStorage.getItem('planx_3d_city_mosque_customizations');
    state.mosqueCustomizations = raw ? JSON.parse(raw) : [];
  } catch (_) {}
}

export function saveMosqueCustomizations() {
  if (isPortableMode) return;
  try {
    localStorage.setItem('planx_3d_city_mosque_customizations', JSON.stringify(state.mosqueCustomizations));
  } catch (_) {}
  notifySaved();
}

function loadTumulusCustomizations() {
  if (isPortableMode) return;
  try {
    const raw = localStorage.getItem('planx_3d_city_tumulus_customizations');
    state.tumulusCustomizations = raw ? JSON.parse(raw) : [];
  } catch (_) {}
}

export function saveTumulusCustomizations() {
  if (isPortableMode) return;
  try {
    localStorage.setItem('planx_3d_city_tumulus_customizations', JSON.stringify(state.tumulusCustomizations));
  } catch (_) {}
  notifySaved();
}

loadMosqueCustomizations();
loadTumulusCustomizations();

export function parseGltfBuffer(buffer) {
  return new Promise((resolve, reject) => {
    gltfLoader.parse(buffer, '', (gltf) => {
      gltf.scene.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      resolve(gltf.scene);
    }, (err) => {
      reject(err);
    });
  });
}

export async function ensureUploadedModelsLoaded() {
  if (isPortableMode) return;
  if (state.uploadedModelsLoaded) return;
  state.uploadedModelsLoaded = true;
  try {
    const rows = await loadModelsFromDB();
    for (const row of rows) {
      try {
        const buffer = await row.blob.arrayBuffer();
        const scene = await parseGltfBuffer(buffer);
        uploadedModels.push({
          id: row.id,
          name: row.name,
          category: row.category,
          scene: scene
        });
      } catch (err) {
        console.error(`Failed to parse cached model ${row.name}`, err);
      }
    }
  } catch (err) {
    console.error('Error loading uploaded models from IndexedDB:', err);
  }
}

const modelCache = new Map();
const gltfLoader = new GLTFLoader();

export function loadGltfModel(url) {
  if (modelCache.has(url)) {
    return Promise.resolve(modelCache.get(url));
  }
  return new Promise((resolve) => {
    gltfLoader.load(url, 
      (gltf) => {
        modelCache.set(url, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn(`Model could not be loaded from ${url}. Using fallback.`, err);
        resolve(null);
      }
    );
  });
}
