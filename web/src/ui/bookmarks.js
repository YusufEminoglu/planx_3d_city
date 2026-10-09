// Camera bookmarks: named views kept in this browser.
import * as THREE from 'three';
import { t } from '../ui_text.js';
import { state } from '../core/state.js';
import { isPortableMode, camera, controls } from '../core/scene.js';
import { settings } from '../core/settings.js';
import { updateTimeOfDay } from '../core/daylight.js';

const BOOKMARK_STORAGE_KEY = 'planx_3d_city_camera_bookmarks';
export let cameraBookmarks = [];

export function loadCameraBookmarks() {
  if (isPortableMode) {
    cameraBookmarks = [];
    return;
  }
  try {
    const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    cameraBookmarks = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(cameraBookmarks)) cameraBookmarks = [];
  } catch (_err) {
    cameraBookmarks = [];
  }
}

function saveCameraBookmarks() {
  if (isPortableMode) return;
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(cameraBookmarks));
  } catch (_err) {
    /* localStorage quota etc. — fail silently */
  }
}

export function addCameraBookmark(name) {
  const label = (name || '').trim() || `View ${cameraBookmarks.length + 1}`;
  cameraBookmarks.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: label,
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [controls.target.x, controls.target.y, controls.target.z],
    fov: camera.fov,
    timeOfDay: settings.timeOfDay,
    createdAt: Date.now()
  });
  saveCameraBookmarks();
  renderCameraBookmarks();
}

function removeCameraBookmark(id) {
  cameraBookmarks = cameraBookmarks.filter((b) => b.id !== id);
  saveCameraBookmarks();
  renderCameraBookmarks();
}

function gotoCameraBookmark(id) {
  const bm = cameraBookmarks.find((b) => b.id === id);
  if (!bm) return;
  state.flyOrigin = camera.position.clone();
  state.flyTarget = new THREE.Vector3(bm.position[0], bm.position[1], bm.position[2]);
  state.flyControlsTarget = new THREE.Vector3(bm.target[0], bm.target[1], bm.target[2]);
  state.flyT = 0;
  if (Number.isFinite(bm.fov) && bm.fov > 0) {
    camera.fov = bm.fov;
    camera.updateProjectionMatrix();
    settings.fov = bm.fov;
  }
  if (Number.isFinite(bm.timeOfDay)) {
    settings.timeOfDay = bm.timeOfDay;
    updateTimeOfDay();
  }
}

export function renderCameraBookmarks() {
  const host = document.getElementById('bookmark-list');
  if (!host) return;
  host.innerHTML = '';
  if (!cameraBookmarks.length) {
    const empty = document.createElement('div');
    empty.className = 'bookmark-empty';
    empty.textContent = t('bookmarkEmpty');
    host.appendChild(empty);
    return;
  }
  cameraBookmarks.forEach((bm) => {
    const row = document.createElement('div');
    row.className = 'bookmark-row';
    const gotoBtn = document.createElement('button');
    gotoBtn.className = 'bookmark-goto';
    gotoBtn.textContent = bm.name;
    gotoBtn.title = t('bookmarkGotoTitle');
    gotoBtn.addEventListener('click', () => gotoCameraBookmark(bm.id));
    const delBtn = document.createElement('button');
    delBtn.className = 'bookmark-del';
    delBtn.textContent = '×';
    delBtn.title = t('bookmarkDeleteTitle');
    delBtn.addEventListener('click', () => removeCameraBookmark(bm.id));
    row.appendChild(gotoBtn);
    row.appendChild(delBtn);
    host.appendChild(row);
  });
}
