// @ts-check
// Procedural textures drawn on canvases: roofs, asphalt, pavements, block
// surfaces, water, fences, leaves. Recipes are named after the material
// catalogue (material_catalogue.js). Deterministic apart from a little noise,
// and cached by the callers.
import * as THREE from 'three';
import { assetColor } from './catalog.js';
import { catalogueName, surfacesFor } from './material_catalogue.js';
import { normalizeHexColor } from './props.js';

const treeLeafTextureCache = new Map();
// Anisotropic filtering for leaf textures: the viewer passes the GPU limit.
let maxAnisotropy = 1;
/** @param {number} n */
export function setMaxAnisotropy(n) {
  maxAnisotropy = Math.max(1, Number(n) || 1);
}
/** Anisotropy for ground textures seen at grazing angles (roads, pavements). */
export function rendererMaxAnisotropy() {
  return Math.min(8, maxAnisotropy);
}

export function proceduralTextureCanvas(name, size = 256) {
  // Surface recipes of the material catalogue (other names get a plain grid).
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const palette = {
    GraniteSlab: ['#c8cdd2', '#8d949c', '#eef1f3'],
    ConcreteSlab: ['#bfc4c9', '#9da5ad', '#d8dde1'],
    GrassPaver: ['#9db489', '#657b57', '#cbd9bf']
  }[name] || ['#cbd5e1', '#94a3b8', '#f8fafc'];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);

  if (name === 'GraniteSlab') {
    const cell = 34;
    for (let y = -cell; y < size + cell; y += cell) {
      const offset = ((y / cell) % 2) * (cell * 0.45);
      for (let x = -cell; x < size + cell; x += cell) {
        const w = cell * (0.75 + ((x + y) % 5) * 0.04);
        const h = cell * (0.58 + ((x - y) % 4) * 0.05);
        ctx.fillStyle = ((x + y) / cell) % 3 === 0 ? palette[2] : palette[0];
        ctx.fillRect(x + offset + 1, y + 1, w, h);
        ctx.strokeStyle = `${palette[1]}99`;
        ctx.strokeRect(x + offset + 1, y + 1, w, h);
      }
    }
  } else if (name === 'GrassPaver') {
    for (let y = 0; y < size; y += 20) {
      for (let x = 0; x < size; x += 20) {
        ctx.fillStyle = palette[(x + y) % 40 === 0 ? 2 : 0];
        ctx.fillRect(x + 1, y + 1, 18, 18);
        ctx.fillStyle = 'rgba(54,83,20,0.28)';
        ctx.fillRect(x + 7, y + 7, 6, 6);
      }
    }
  } else {
    ctx.strokeStyle = `${palette[1]}88`;
    ctx.lineWidth = 1;
    const step = 42;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    for (let i = 0; i < 700; i++) {
      const v = 130 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${v},${v},${v},0.08)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function colorObjectFromHex(value, fallback = '#2f3438') {
  if (value && value.isColor) return value.clone();
  return new THREE.Color(normalizeHexColor(value, fallback) || fallback);
}

export function rgbaFromColor(color, alpha = 1) {
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${alpha})`;
}

export function mixedColor(base, target, amount) {
  return base.clone().lerp(new THREE.Color(target), Math.max(0, Math.min(1, amount)));
}

const asphaltTextureCache = new Map();
export function createAsphaltTexture(baseColor = '#2e3135') {
  const base = colorObjectFromHex(baseColor, '#2e3135');
  const cacheKey = `asphalt:${base.getHexString()}`;
  if (asphaltTextureCache.has(cacheKey)) return asphaltTextureCache.get(cacheKey);

  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const r = Math.random() * 1.2 + 0.2;
    const target = Math.random() > 0.5 ? 0xffffff : 0x000000;
    const amount = 0.12 + Math.random() * 0.24;
    ctx.fillStyle = rgbaFromColor(mixedColor(base, target, amount), 0.18);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = rgbaFromColor(mixedColor(base, 0xffffff, 0.18), 0.10);
  ctx.lineWidth = 1;
  for (let y = 24; y < c.height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 2);
    ctx.lineTo(c.width, y + Math.random() * 2);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  t.colorSpace = THREE.SRGBColorSpace;
  asphaltTextureCache.set(cacheKey, t);
  return t;
}

export function createIslandTexturePreset(groundName) {
  // Catalogue name (or a legacy one) -> recipe; 'None' is no texture.
  const name = groundName === 'None' || !groundName ? 'None' : (catalogueName('surface', groundName, surfacesFor('ground')) || 'Earth');
  if (name === 'None') return null;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const islandPalette = {
    Grass:        { base: '#6f9c52', shadow: '#3f6b2c', highlight: '#a6c982' },
    Earth: { base: '#d6c8a6', shadow: '#a18c63', highlight: '#efe6cf' },
    Gravel:      { base: '#b6b3a8', shadow: '#7b7a72', highlight: '#dad7ce' },
    Sand:      { base: '#ecd9b0', shadow: '#b39361', highlight: '#fff1d2' }
  }[name];
  if (islandPalette) {
    ctx.fillStyle = islandPalette.base;
    ctx.fillRect(0, 0, 256, 256);
    if (name === 'Grass') {
      for (let i = 0; i < 2200; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 0.6 + Math.random() * 1.6;
        ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '63,107,44' : '166,201,130'},${0.10 + Math.random() * 0.18})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      for (let i = 0; i < 28; i++) {
        ctx.strokeStyle = `rgba(63,107,44,${0.10 + Math.random() * 0.10})`;
        ctx.lineWidth = 0.6 + Math.random() * 0.5;
        ctx.beginPath();
        const sx = Math.random() * 256;
        const sy = Math.random() * 256;
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (Math.random() - 0.5) * 30, sy + (Math.random() - 0.5) * 30);
        ctx.stroke();
      }
    } else if (name === 'Earth') {
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(161,140,99,${0.06 + Math.random() * 0.12})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      ctx.strokeStyle = 'rgba(161,140,99,0.18)';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 256; i += 36) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
    } else if (name === 'Gravel') {
      for (let i = 0; i < 1800; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 0.4 + Math.random() * 1.2;
        const tone = Math.random() < 0.5 ? '123,122,114' : '218,215,206';
        ctx.fillStyle = `rgba(${tone},${0.18 + Math.random() * 0.20})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (name === 'Sand') {
      for (let i = 0; i < 1600; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        ctx.fillStyle = `rgba(179,147,97,${0.05 + Math.random() * 0.12})`;
        ctx.fillRect(x, y, 1, 1);
      }
      for (let band = 0; band < 6; band++) {
        ctx.strokeStyle = 'rgba(255,241,210,0.22)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const yBand = band * 42 + 8 + Math.random() * 6;
        ctx.moveTo(0, yBand);
        for (let x = 0; x <= 256; x += 8) {
          ctx.lineTo(x, yBand + Math.sin(x * 0.18 + band) * 2.2);
        }
        ctx.stroke();
      }
    }
  } else {
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, 256, 256);
    if (name === 'Water') {
      ctx.fillStyle = '#0f5e9c';
      ctx.fillRect(0, 0, 256, 256);
      for (let band = 0; band < 10; band++) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        const yBand = band * 25 + 5 + Math.random() * 5;
        ctx.moveTo(0, yBand);
        for (let x = 0; x <= 256; x += 6) {
          ctx.lineTo(x, yBand + Math.sin(x * 0.25 + band * 1.5) * 1.8);
        }
        ctx.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const tintedIslandTextureCache = new Map();
export function createTintedIslandTexturePreset(groundName, baseColor) {
  // Catalogue name (or a legacy one) -> recipe; 'None' is no texture.
  const name = groundName === 'None' || !groundName ? 'None' : (catalogueName('surface', groundName, surfacesFor('ground')) || 'Earth');
  if (name === 'None') return null;
  const base = colorObjectFromHex(baseColor, '#e5e7eb');
  const cacheKey = `${name}:${base.getHexString()}`;
  if (tintedIslandTextureCache.has(cacheKey)) return tintedIslandTextureCache.get(cacheKey);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const shadow = mixedColor(base, 0x000000, 0.30);
  const highlight = mixedColor(base, 0xffffff, 0.28);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);

  if (name === 'Water') {
    for (let band = 0; band < 10; band++) {
      ctx.strokeStyle = rgbaFromColor(highlight, 0.22);
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      const yBand = band * 25 + 5 + Math.random() * 5;
      ctx.moveTo(0, yBand);
      for (let x = 0; x <= 256; x += 6) {
        ctx.lineTo(x, yBand + Math.sin(x * 0.25 + band * 1.5) * 1.8);
      }
      ctx.stroke();
    }
  } else {
    const dotCount = name === 'Gravel' ? 1800 : 1000;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = name === 'Gravel' ? 0.4 + Math.random() * 1.2 : 1 + Math.random() * 1.8;
      ctx.fillStyle = rgbaFromColor(Math.random() < 0.5 ? shadow : highlight, 0.10 + Math.random() * 0.14);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (name === 'Earth' || name === 'Sand') {
      ctx.strokeStyle = rgbaFromColor(shadow, 0.18);
      ctx.lineWidth = 0.8;
      for (let y = 0; y < 256; y += 36) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + (name === 'Sand' ? Math.sin(y) * 2 : 0)); ctx.stroke();
      }
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  tintedIslandTextureCache.set(cacheKey, t);
  return t;
}

// --- Procedural Textures Helper Functions ---
export function createWaterTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f5e9c';
  ctx.fillRect(0, 0, 128, 128);
  for (let band = 0; band < 5; band++) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    const yBand = band * 25 + 5 + Math.random() * 5;
    ctx.moveTo(0, yBand);
    for (let x = 0; x <= 128; x += 6) {
      ctx.lineTo(x, yBand + Math.sin(x * 0.25 + band * 1.5) * 1.8);
    }
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

export function createSteelFenceTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(64, 64);
  ctx.moveTo(64, 0); ctx.lineTo(0, 64);
  ctx.stroke();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

export function createWoodFenceTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#b45309';
  ctx.fillRect(4, 0, 16, 64);
  ctx.fillRect(24, 0, 16, 64);
  ctx.fillRect(44, 0, 16, 64);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(0, 12, 64, 8);
  ctx.fillRect(0, 44, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

export function createSoftNoiseTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const g = 180 + Math.random() * 75;
    ctx.fillStyle = `rgba(${g},${g},${g},0.15)`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

export function createRoofPresetTexture(roofName) {
  // Catalogue name (or a legacy one) -> recipe.
  const name = catalogueName('roof', roofName) || 'ClayTile';
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const bg = {
    ClayTile: '#a8442a', Slate: '#3d4a5c', Shingle: '#2d3340', MetalSeam: '#506070', Green: '#587642',
    Solar: '#26364c', Copper: '#437c6c', Gravel: '#8b8982', Lead: '#4a525d'
  }[name] || '#a8442a';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  if (name === 'ClayTile') {
    // Clay barrel tiles: warm red-orange rows with vertical channels
    ctx.fillStyle = '#a8442a';
    ctx.fillRect(0, 0, 256, 256);
    const colW = 24, rowH = 22;
    for (let row = 0; row * rowH < 280; row++) {
      for (let col = 0; col * colW < 280; col++) {
        const x = col * colW + (row % 2) * 3;
        const y = row * rowH;
        const grad = ctx.createLinearGradient(x, y, x + colW, y);
        grad.addColorStop(0, '#7d2f1a');
        grad.addColorStop(0.35, '#c45535');
        grad.addColorStop(0.65, '#d46543');
        grad.addColorStop(1, '#6e2816');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);
        ctx.strokeStyle = 'rgba(55,18,8,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x + colW / 2, y + rowH - 1, colW / 2 - 2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
  } else if (name === 'Copper') {
    ctx.fillStyle = '#437c6c';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 20) {
      const grad = ctx.createLinearGradient(x, 0, x + 18, 0);
      grad.addColorStop(0, 'rgba(30,68,58,0.55)');
      grad.addColorStop(0.5, 'rgba(110,185,162,0.32)');
      grad.addColorStop(1, 'rgba(24,54,46,0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 18, 256);
      ctx.strokeStyle = 'rgba(180,235,215,0.38)';
      ctx.beginPath(); ctx.moveTo(x + 18, 0); ctx.lineTo(x + 18, 256); ctx.stroke();
    }
    for (let y = 32; y < 256; y += 64) {
      ctx.strokeStyle = 'rgba(24,54,46,0.35)';
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
  } else if (name === 'Gravel') {
    ctx.fillStyle = '#8b8982';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const v = 95 + Math.floor(Math.random() * 85);
      ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.55)`;
      ctx.fillRect(x, y, 2.2, 2.2);
    }
  } else if (name === 'Lead') {
    ctx.fillStyle = '#4a525d';
    ctx.fillRect(0, 0, 256, 256);
    const bw = 28, bh = 36;
    for (let row = 0; row * bh < 260; row++) {
      for (let col = 0; col * bw < 260; col++) {
        const x = col * bw + (row % 2) * (bw * 0.5);
        const y = row * bh;
        ctx.strokeStyle = 'rgba(25,30,36,0.65)';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(x, y, bw, bh);
        ctx.strokeStyle = 'rgba(185,198,215,0.28)';
        ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + bw - 2, y + 2); ctx.stroke();
      }
    }
  } else if (name === 'Slate') {
    // Dark slate, staggered rectangular tiles with shadow lines
    ctx.fillStyle = '#3d4a5c';
    ctx.fillRect(0, 0, 256, 256);
    const tw = 32, th = 20;
    for (let row = 0; row * th < 256; row++) {
      const offset = (row % 2) * (tw / 2);
      for (let col = -1; col * tw < 256; col++) {
        const x = col * tw + offset, y = row * th;
        ctx.fillStyle = `rgba(${50 + (row * 7 + col * 3) % 20},${60 + (row * 5 + col * 7) % 20},${80 + (row * 3) % 15},1)`;
        ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);
        ctx.strokeStyle = 'rgba(20,28,40,0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
        // highlight top edge
        ctx.strokeStyle = 'rgba(100,120,150,0.3)';
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + tw - 1, y + 1); ctx.stroke();
      }
    }
  } else if (name === 'Shingle') {
    // Asphalt shingles – dark charcoal, staggered, slightly bumpy
    ctx.fillStyle = '#2d3340';
    ctx.fillRect(0, 0, 256, 256);
    const sw = 40, sh = 14;
    for (let row = 0; row * sh < 280; row++) {
      const offset = (row % 2) * (sw / 2);
      for (let col = -1; col * sw < 270; col++) {
        const x = col * sw + offset, y = row * sh;
        const v = 40 + (row * 5 + col * 11) % 22;
        ctx.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
        ctx.fillRect(x + 1, y + 1, sw - 2, sh - 2);
        // Bottom shadow
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 1, y + sh - 1); ctx.lineTo(x + sw - 1, y + sh - 1); ctx.stroke();
        // Top highlight
        ctx.strokeStyle = 'rgba(160,170,185,0.18)';
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + sw - 1, y + 1); ctx.stroke();
        // Granule texture dots
        for (let d = 0; d < 3; d++) {
          const dx = x + 4 + d * 12 + (row % 3) * 3;
          const dy = y + 4 + (col % 2) * 3;
          ctx.fillStyle = `rgba(${v + 20},${v + 24},${v + 30},0.4)`;
          ctx.fillRect(dx, dy, 2, 2);
        }
      }
    }
  } else if (name === 'MetalSeam') {
    ctx.fillStyle = '#506070';
    ctx.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x += 22) {
      const grad = ctx.createLinearGradient(x, 0, x + 18, 0);
      grad.addColorStop(0, 'rgba(25,34,45,0.42)');
      grad.addColorStop(0.5, 'rgba(120,135,150,0.18)');
      grad.addColorStop(1, 'rgba(20,28,38,0.36)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, 18, 256);
      ctx.strokeStyle = 'rgba(210,220,230,0.35)';
      ctx.beginPath(); ctx.moveTo(x + 18, 0); ctx.lineTo(x + 18, 256); ctx.stroke();
    }
  } else if (name === 'Green') {
    ctx.fillStyle = '#587642';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const g = 80 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${Math.floor(g * 0.55)},${g},${Math.floor(g * 0.38)},0.35)`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(235,245,220,0.16)';
    for (let x = 0; x < 256; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 256); ctx.stroke();
    }
  } else if (name === 'Solar') {
    ctx.fillStyle = '#26364c';
    ctx.fillRect(0, 0, 256, 256);
    const pw = 42, ph = 26;
    for (let y = 8; y < 256; y += ph + 5) {
      for (let x = 8; x < 256; x += pw + 5) {
        const grad = ctx.createLinearGradient(x, y, x + pw, y + ph);
        grad.addColorStop(0, '#172033');
        grad.addColorStop(0.55, '#2c4f75');
        grad.addColorStop(1, '#111827');
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, pw, ph);
        ctx.strokeStyle = 'rgba(180,210,240,0.35)';
        ctx.strokeRect(x, y, pw, ph);
      }
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let y = 0; y < 256; y += 14) {
      for (let x = 0; x < 256; x += 14) {
        if ((x + y) % 28 === 0) ctx.fillRect(x, y, 6, 6);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.8, 2.8);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function treeLeafTextureForVariant(variantName) {
  const key = String(variantName || 'default');
  const cached = treeLeafTextureCache.get(key);
  if (cached) return cached;
  const baseColor = assetColor(variantName, 0x3b6e2e);
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) {
    const fallback = new THREE.CanvasTexture(c);
    treeLeafTextureCache.set(key, fallback);
    return fallback;
  }
  const grad = ctx.createRadialGradient(64, 56, 8, 64, 64, 62);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 20)},${Math.min(255, g + 24)},${Math.min(255, b + 18)},0.98)`);
  grad.addColorStop(0.7, `rgba(${Math.max(0, r - 12)},${Math.max(0, g - 14)},${Math.max(0, b - 12)},0.94)`);
  grad.addColorStop(1, `rgba(${Math.max(0, r - 28)},${Math.max(0, g - 30)},${Math.max(0, b - 26)},0.88)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const radius = 1.0 + Math.random() * 2.4;
    const alpha = 0.08 + Math.random() * 0.16;
    ctx.fillStyle = `rgba(${Math.max(0, r - 20 + Math.random() * 26)},${Math.max(0, g - 18 + Math.random() * 24)},${Math.max(0, b - 18 + Math.random() * 24)},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  treeLeafTextureCache.set(key, tex);
  return tex;
}
