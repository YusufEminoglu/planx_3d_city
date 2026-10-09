// @ts-check
// Procedural textures drawn on canvases: facades with window grids, roofs,
// asphalt, pavements, block surfaces, water, fences, leaves. Deterministic
// apart from a little noise, and cached by the callers.
import * as THREE from 'three';
import { FACADE_RECIPES, assetColor, textureSets } from './catalog.js';
import { normalizeHexColor } from './props.js';

const treeLeafTextureCache = new Map();
// Anisotropic filtering for leaf textures: the viewer passes the GPU limit.
let maxAnisotropy = 1;
/** @param {number} n */
export function setMaxAnisotropy(n) {
  maxAnisotropy = Math.max(1, Number(n) || 1);
}

function drawWindowedFacade(ctx, size, palette, opts) {
  const floors = Math.max(3, opts.floorRows | 0);
  const cols = Math.max(2, opts.windowCols | 0);
  const groundShop = !!opts.groundShop;
  const aspect = Math.max(0.2, Math.min(1, opts.windowAspect || 0.6));
  const accent = opts.accent || palette[1];
  const frame = opts.windowFrameColor || palette[1];
  const glassPattern = opts.glassPattern || 'uniform';
  const columnPattern = opts.columnPattern || 'flat';

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);

  if (columnPattern === 'brick') {
    const brickH = 8;
    const brickW = 22;
    for (let y = 0; y < size; y += brickH) {
      const offset = ((y / brickH) % 2) * (brickW * 0.5);
      for (let x = -brickW; x < size + brickW; x += brickW) {
        ctx.fillStyle = ((x + y) % 7 === 0) ? palette[2] : palette[0];
        ctx.fillRect(x + offset, y, brickW - 1, brickH - 1);
        ctx.strokeStyle = `${accent}aa`;
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + offset + 0.5, y + 0.5, brickW - 1, brickH - 1);
      }
    }
  } else if (columnPattern === 'timber') {
    const plankW = size / cols;
    for (let c = 0; c < cols; c++) {
      const grad = ctx.createLinearGradient(c * plankW, 0, c * plankW + plankW, 0);
      grad.addColorStop(0, palette[0]);
      grad.addColorStop(0.5, palette[2]);
      grad.addColorStop(1, palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(c * plankW, 0, plankW, size);
      ctx.strokeStyle = `${accent}66`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(c * plankW, 0);
      ctx.lineTo(c * plankW, size);
      ctx.stroke();
    }
  } else if (columnPattern === 'pilaster') {
    const pilW = (size / cols) * 0.18;
    for (let c = 0; c <= cols; c++) {
      const x = c * (size / cols) - pilW * 0.5;
      const grad = ctx.createLinearGradient(x, 0, x + pilW, 0);
      grad.addColorStop(0, accent);
      grad.addColorStop(0.5, palette[2]);
      grad.addColorStop(1, accent);
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, pilW, size);
    }
  }

  const groundH = groundShop ? (size / (floors + 1)) * 1.6 : 0;
  const upperArea = size - groundH;
  const floorH = upperArea / floors;
  const colW = size / cols;

  ctx.strokeStyle = `${accent}99`;
  ctx.lineWidth = opts.floorLineWidth || 1.2;
  for (let f = 0; f <= floors; f++) {
    const y = groundH + f * floorH;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }

  for (let f = 0; f < floors; f++) {
    const yTop = groundH + f * floorH;
    for (let c = 0; c < cols; c++) {
      const xLeft = c * colW;
      const padX = colW * (1 - aspect) * 0.5;
      const padY = floorH * 0.18;
      const wx = xLeft + padX;
      const wy = yTop + padY;
      const ww = colW - padX * 2;
      const wh = floorH - padY * 2;
      ctx.fillStyle = frame;
      ctx.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
      if (glassPattern === 'horizontal-bands') {
        const grad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(0.45, accent);
        grad.addColorStop(0.55, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
      } else if (glassPattern === 'striped') {
        const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
        ctx.strokeStyle = `${frame}66`;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(wx + ww / 2, wy);
        ctx.lineTo(wx + ww / 2, wy + wh);
        ctx.stroke();
      } else if (glassPattern === 'shutters') {
        const half = ww * 0.5;
        ctx.fillStyle = palette[2];
        ctx.fillRect(wx, wy, ww, wh);
        ctx.fillStyle = accent;
        ctx.fillRect(wx, wy, half * 0.42, wh);
        ctx.fillRect(wx + ww - half * 0.42, wy, half * 0.42, wh);
        ctx.strokeStyle = `${frame}88`;
        ctx.lineWidth = 0.5;
        for (let s = 1; s < 4; s++) {
          const sy = wy + (wh / 4) * s;
          ctx.beginPath();
          ctx.moveTo(wx, sy);
          ctx.lineTo(wx + ww, sy);
          ctx.stroke();
        }
      } else {
        const grad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
        grad.addColorStop(0, palette[2]);
        grad.addColorStop(1, accent);
        ctx.fillStyle = grad;
        ctx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  if (groundShop && groundH > 0) {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, size, groundH);
    const bay = size / Math.max(2, Math.floor(cols * 1.2));
    for (let i = 0; i < size; i += bay) {
      const bw = bay * 0.85;
      const bh = groundH * 0.78;
      const bx = i + (bay - bw) * 0.5;
      const by = (groundH - bh) * 0.5;
      const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
      grad.addColorStop(0, palette[2]);
      grad.addColorStop(1, palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = `${frame}cc`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    }
    ctx.strokeStyle = `${accent}cc`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, groundH);
    ctx.lineTo(size, groundH);
    ctx.stroke();
  }

  for (let i = 0; i < 360; i++) {
    const v = 130 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgba(${v},${v},${v},0.05)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
}

export function proceduralTextureCanvas(name, size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const palette = {
    StoneB: ['#d7d0c2', '#b8ad9c', '#efe8d8'],
    Concrete: ['#bfc4c9', '#9da5ad', '#d8dde1'],
    Cobble: ['#a99f90', '#7f7468', '#c8bdad'],
    WarmStone: ['#d8c7a6', '#b99d72', '#f2e4c8'],
    CampusPaver: ['#c6cbd0', '#8e98a3', '#e5e7eb'],
    Permeable: ['#9db489', '#657b57', '#cbd9bf'],
    PlazaGranite: ['#c8cdd2', '#8d949c', '#eef1f3'],
    Tile: ['#d7d3c9', '#8f8a80', '#f4f0e7'],
    Grid: ['#dbeafe', '#64748b', '#f8fafc'],
    SharedStreet: ['#3a3f44', '#6b7280', '#eef2f7'],
    UrbanE: ['#d8dee7', '#536171', '#f3f6f9'],
    CampusGlass: ['#a9d6e8', '#2f5f73', '#e8f6fb'],
    EcoTimber: ['#9a6b3a', '#4f3824', '#d5b07c'],
    CivicStone: ['#c8c2b6', '#7c7468', '#eee8dd'],
    DenseBrick: ['#8f3f2d', '#55261d', '#c2694f'],
    CoastalWhite: ['#f5f1e8', '#92a7b4', '#ffffff'],
    MediterraneanStucco: ['#ead8bd', '#b78b64', '#fff4df']
  }[name] || ['#cbd5e1', '#94a3b8', '#f8fafc'];

  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, size, size);

  if (['StoneB', 'Cobble', 'WarmStone', 'PlazaGranite'].includes(name)) {
    const cell = name === 'Cobble' ? 26 : 34;
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
  } else if (['Concrete', 'CampusPaver', 'Tile', 'Grid', 'SharedStreet'].includes(name)) {
    ctx.strokeStyle = `${palette[1]}88`;
    ctx.lineWidth = 1;
    const step = name === 'Grid' ? 16 : name === 'Tile' ? 32 : 42;
    for (let i = 0; i <= size; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    for (let i = 0; i < 700; i++) {
      const v = 130 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${v},${v},${v},0.08)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
  } else if (name === 'Permeable') {
    for (let y = 0; y < size; y += 20) {
      for (let x = 0; x < size; x += 20) {
        ctx.fillStyle = palette[(x + y) % 40 === 0 ? 2 : 0];
        ctx.fillRect(x + 1, y + 1, 18, 18);
        ctx.fillStyle = 'rgba(54,83,20,0.28)';
        ctx.fillRect(x + 7, y + 7, 6, 6);
      }
    }
  } else {
    const isFacade = Object.prototype.hasOwnProperty.call(textureSets.facade, name);
    if (isFacade && FACADE_RECIPES[name]) {
      drawWindowedFacade(ctx, size, palette, FACADE_RECIPES[name]);
    } else {
      const cols = isFacade ? 6 : 10;
      const rows = isFacade ? 11 : 10;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = (col / cols) * size;
          const y = (r / rows) * size;
          const w = size / cols;
          const h = size / rows;
          ctx.fillStyle = (r + col) % 3 === 0 ? palette[2] : palette[0];
          ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
          ctx.strokeStyle = `${palette[1]}77`;
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
          if (isFacade && r % 2 === 0 && col % 2 === 0) {
            ctx.fillStyle = 'rgba(50,80,100,0.18)';
            ctx.fillRect(x + w * 0.22, y + h * 0.28, w * 0.42, h * 0.32);
          }
        }
      }
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

export function createAsphaltTexture(baseColor = '#2e3135') {
  const base = colorObjectFromHex(baseColor, '#2e3135');
  const cacheKey = `asphalt:${base.getHexString()}`;
  createAsphaltTexture.cache = createAsphaltTexture.cache || new Map();
  if (createAsphaltTexture.cache.has(cacheKey)) return createAsphaltTexture.cache.get(cacheKey);

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
  createAsphaltTexture.cache.set(cacheKey, t);
  return t;
}

export function createIslandTexturePreset(name) {
  if (name === 'None') return null;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const islandPalette = {
    ParkGreen:        { base: '#6f9c52', shadow: '#3f6b2c', highlight: '#a6c982' },
    ResidentialBeige: { base: '#d6c8a6', shadow: '#a18c63', highlight: '#efe6cf' },
    CivicGravel:      { base: '#b6b3a8', shadow: '#7b7a72', highlight: '#dad7ce' },
    CoastalSand:      { base: '#ecd9b0', shadow: '#b39361', highlight: '#fff1d2' }
  }[name];
  if (islandPalette) {
    ctx.fillStyle = islandPalette.base;
    ctx.fillRect(0, 0, 256, 256);
    if (name === 'ParkGreen') {
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
    } else if (name === 'ResidentialBeige') {
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
    } else if (name === 'CivicGravel') {
      for (let i = 0; i < 1800; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = 0.4 + Math.random() * 1.2;
        const tone = Math.random() < 0.5 ? '123,122,114' : '218,215,206';
        ctx.fillStyle = `rgba(${tone},${0.18 + Math.random() * 0.20})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (name === 'CoastalSand') {
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
    if (name === 'SoftNoise') {
      for (let i = 0; i < 1400; i++) {
        const x = Math.random() * 256;
        const y = Math.random() * 256;
        const r = Math.random() * 1.4;
        ctx.fillStyle = 'rgba(120,130,140,0.14)';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (name === 'FineGrid') {
      ctx.strokeStyle = 'rgba(120,130,140,0.24)';
      for (let i = 0; i < 256; i += 12) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
      }
    } else if (name === 'Water') {
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

export function createTintedIslandTexturePreset(name, baseColor) {
  if (name === 'None') return null;
  const base = colorObjectFromHex(baseColor, '#e5e7eb');
  const cacheKey = `${name}:${base.getHexString()}`;
  createTintedIslandTexturePreset.cache = createTintedIslandTexturePreset.cache || new Map();
  if (createTintedIslandTexturePreset.cache.has(cacheKey)) return createTintedIslandTexturePreset.cache.get(cacheKey);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const shadow = mixedColor(base, 0x000000, 0.30);
  const highlight = mixedColor(base, 0xffffff, 0.28);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, 256, 256);

  if (name === 'FineGrid') {
    ctx.strokeStyle = rgbaFromColor(shadow, 0.24);
    for (let i = 0; i < 256; i += 12) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
  } else if (name === 'Water') {
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
    const dotCount = name === 'CivicGravel' ? 1800 : 1000;
    for (let i = 0; i < dotCount; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const r = name === 'CivicGravel' ? 0.4 + Math.random() * 1.2 : 1 + Math.random() * 1.8;
      ctx.fillStyle = rgbaFromColor(Math.random() < 0.5 ? shadow : highlight, 0.10 + Math.random() * 0.14);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    if (name === 'ResidentialBeige' || name === 'CoastalSand') {
      ctx.strokeStyle = rgbaFromColor(shadow, 0.18);
      ctx.lineWidth = 0.8;
      for (let y = 0; y < 256; y += 36) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + (name === 'CoastalSand' ? Math.sin(y) * 2 : 0)); ctx.stroke();
      }
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  createTintedIslandTexturePreset.cache.set(cacheKey, t);
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

export function createRoofPresetTexture(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const bg = {
    RoofA: '#9a7b61', RoofB: '#6f7885', RoofC: '#8e5a49', RoofD: '#5e6368',
    GermanTile: '#3d4a5c', USShingle: '#2d3340',
    StandingSeam: '#506070', GreenRoof: '#587642', SolarRoof: '#26364c', CeramicLight: '#d1a16d'
  }[name] || '#9a7b61';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);

  if (name === 'RoofA') {
    ctx.strokeStyle = 'rgba(240,220,200,0.65)';
    for (let y = 10; y < 256; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,70,55,0.28)';
    for (let y = 18; y < 256; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
  } else if (name === 'RoofB') {
    ctx.strokeStyle = 'rgba(210,220,235,0.55)';
    for (let x = -120; x < 300; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 90, 256); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,70,85,0.3)';
    for (let x = -120; x < 300; x += 18) {
      ctx.beginPath(); ctx.moveTo(x + 7, 0); ctx.lineTo(x + 97, 256); ctx.stroke();
    }
  } else if (name === 'RoofC') {
    ctx.strokeStyle = 'rgba(255,220,200,0.45)';
    for (let y = 0; y < 256; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 8); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(80,45,38,0.25)';
    for (let y = 8; y < 256; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y + 8); ctx.stroke();
    }
  } else if (name === 'GermanTile') {
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
  } else if (name === 'USShingle') {
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
  } else if (name === 'StandingSeam') {
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
  } else if (name === 'GreenRoof') {
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
  } else if (name === 'SolarRoof') {
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
  } else if (name === 'CeramicLight') {
    ctx.fillStyle = '#d1a16d';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 280; y += 22) {
      for (let x = -14; x < 270; x += 28) {
        const shade = 185 + ((x + y) % 38);
        ctx.fillStyle = `rgb(${shade},${Math.floor(shade * 0.62)},${Math.floor(shade * 0.34)})`;
        ctx.beginPath();
        ctx.ellipse(x + ((y / 22) % 2) * 14, y + 11, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(105,65,30,0.38)';
        ctx.stroke();
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
