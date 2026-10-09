// Day, night and weather: the day/night switch for lit windows and lamps,
// and rain or snow particles.
import * as THREE from 'three';
import { setBatchedBuildingNight } from '../building_batch.js';
import { state } from '../core/state.js';
import { scene, buildingGroup, camera } from '../core/scene.js';
import { settings } from '../core/settings.js';
import { updateTimeOfDay } from '../core/daylight.js';
import { buildFurnitureLayer } from './furniture.js';

let lastTimeOfDay = -1;

// Lightweight day/night switch — updates only emissive + furniture lights.
// Does NOT rebuild terrain, geometry or DEM.
function rebuildLightingOnly() {
  const isNight = (state.solar.elevationDeg ?? 30) < -3;
  setBatchedBuildingNight(buildingGroup, isNight);
  buildingGroup.children.forEach(mesh => {
    if (!Array.isArray(mesh.material) || mesh.material.length < 2) return;
    const mat = mesh.material[1];
    if (!mat) return;
    mat.emissive.setHex(isNight ? 0x333322 : 0x000000);
    // Deterministic per-building intensity from position hash (avoids random on every call)
    const hash = Math.abs(Math.sin(mesh.position.x * 12.9898 + mesh.position.z * 78.233)) % 1;
    mat.emissiveIntensity = isNight ? 0.2 + hash * 0.8 : 0;
  });
  buildFurnitureLayer(); // refresh lamp glow
}

export function checkTimeChange() {
  updateTimeOfDay();
  const isNight = (state.solar.elevationDeg ?? 30) < -3;
  if (lastTimeOfDay !== -1) {
    const wasNight = lastTimeOfDay < 6.5 || lastTimeOfDay > 17.5;
    if (isNight !== wasNight) {
      rebuildLightingOnly();
    }
  }
  lastTimeOfDay = settings.timeOfDay;
}

export let weatherParticles = null;
export function updateWeather() {
  if (weatherParticles) {
    scene.remove(weatherParticles);
    weatherParticles.geometry.dispose();
    weatherParticles.material.dispose();
    weatherParticles = null;
  }
  if (settings.weather === 'Clear') return;
  
  const count = settings.weather === 'Rain' ? 10000 : 8000;
  const size = settings.weather === 'Rain' ? 0.2 : 0.5;
  const color = settings.weather === 'Rain' ? 0xaaaaff : 0xffffff;
  const opacity = settings.weather === 'Rain' ? 0.5 : 0.8;
  
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for(let i=0; i<count*3; i+=3){
      pos[i] = (Math.random() - 0.5) * 800;
      pos[i+1] = Math.random() * 400;
      pos[i+2] = (Math.random() - 0.5) * 800;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  
  let tex = null;
  if (settings.weather === 'Snow') {
      const c = document.createElement('canvas');
      c.width=32; c.height=32;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(16,16,0,16,16,16);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.fillRect(0,0,32,32);
      tex = new THREE.CanvasTexture(c);
  }
  
  const mat = new THREE.PointsMaterial({
      color: color,
      size: size,
      transparent: true,
      opacity: opacity,
      map: tex,
      depthWrite: false,
      blending: THREE.AdditiveBlending
  });
  
  weatherParticles = new THREE.Points(geo, mat);
  scene.add(weatherParticles);
}

// Rain or snow falls around the camera; drops that reach the ground start
// again at the top.
export function updateWeatherParticles() {
  if (!weatherParticles) return;
  const positions = weatherParticles.geometry.attributes.position.array;
  const isRain = settings.weather === 'Rain';
  const speedY = isRain ? 15 : 2;
  const speedX = isRain ? 1.5 : 1.0;
  for(let i=1; i<positions.length; i+=3) {
    positions[i] -= speedY;
    positions[i-1] -= speedX;
    if (positions[i] < 0) {
      positions[i] = 400;
      positions[i-1] = (Math.random() - 0.5) * 800;
      positions[i+1] = (Math.random() - 0.5) * 800;
    }
  }
  weatherParticles.geometry.attributes.position.needsUpdate = true;
  weatherParticles.position.x = camera.position.x;
  weatherParticles.position.z = camera.position.z;
}
