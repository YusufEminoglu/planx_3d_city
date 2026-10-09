// View links and high-resolution captures.
//
// A view link carries the camera in the URL hash (#view=...), so a shared
// link opens the same viewpoint. A tiled capture renders the current view in
// screen-sized tiles with camera.setViewOffset and stitches them, so images
// can be much larger than the screen (8K and up) at full quality.

const VIEW_KEY = 'view';

/**
 * Encode a camera state as a compact hash value:
 * px,py,pz,tx,ty,tz,fov[,timeOfDay] (metres to 0.1, degrees, hours).
 */
export function encodeView({ position, target, fov, timeOfDay }) {
  const r1 = (v) => Math.round(v * 10) / 10;
  const parts = [...position.map(r1), ...target.map(r1), Math.round(fov * 10) / 10];
  if (Number.isFinite(timeOfDay)) parts.push(Math.round(timeOfDay * 100) / 100);
  return parts.join(',');
}

/** Parse a hash value written by encodeView; null when malformed. */
export function decodeView(text) {
  if (typeof text !== 'string' || !text) return null;
  const n = text.split(',').map(Number);
  if (n.length < 7 || n.slice(0, 7).some((v) => !Number.isFinite(v))) return null;
  const fov = n[6];
  if (fov <= 1 || fov >= 179) return null;
  const view = { position: n.slice(0, 3), target: n.slice(3, 6), fov };
  if (n.length > 7 && Number.isFinite(n[7]) && n[7] >= 0 && n[7] <= 24) view.timeOfDay = n[7];
  return view;
}

/** The view stored in a location hash such as '#view=...&other=1'. */
export function viewFromHash(hash) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  return decodeView(params.get(VIEW_KEY));
}

/** A hash with the view set, keeping any other hash parameters. */
export function hashWithView(hash, view) {
  const params = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  params.set(VIEW_KEY, encodeView(view));
  // Commas read better unescaped and are safe in a fragment.
  return `#${params.toString().replace(/%2C/g, ',')}`;
}

/**
 * Tiles covering a fullWidth x fullHeight image with tiles of at most
 * tileWidth x tileHeight: [{x, y, width, height}] in image pixels, top-left
 * origin (the convention of camera.setViewOffset).
 */
export function captureTiles(fullWidth, fullHeight, tileWidth, tileHeight) {
  const tiles = [];
  for (let y = 0; y < fullHeight; y += tileHeight) {
    for (let x = 0; x < fullWidth; x += tileWidth) {
      tiles.push({ x, y, width: Math.min(tileWidth, fullWidth - x), height: Math.min(tileHeight, fullHeight - y) });
    }
  }
  return tiles;
}

/** Output size for a capture preset, keeping the view's aspect ratio. */
export function captureSize(preset, aspect, screenWidth) {
  const widths = { screen: screenWidth, '2x': screenWidth * 2, '4k': 3840, '8k': 7680 };
  const width = Math.round(widths[preset] || screenWidth);
  return { width, height: Math.max(1, Math.round(width / aspect)) };
}

/**
 * Render the current view at width x height in tiles and return a PNG blob.
 * render() draws one frame of the current camera to the renderer's canvas;
 * the canvas is copied right after each draw (it is not preserved).
 */
export async function captureTiled({ renderer, camera, render, width, height, onProgress }) {
  const canvas = renderer.domElement;
  const tileW = canvas.width;
  const tileH = canvas.height;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d');
  const tiles = captureTiles(width, height, tileW, tileH);
  try {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      // Each tile is a full-canvas frame of a window into the large image;
      // edge tiles are rendered full size and cropped.
      camera.setViewOffset(width, height, t.x, t.y, tileW, tileH);
      render();
      ctx.drawImage(canvas, 0, 0, t.width, t.height, t.x, t.y, t.width, t.height);
      if (onProgress) onProgress((i + 1) / tiles.length);
      // Let the page breathe between tiles on very large captures.
      if (tiles.length > 4) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    camera.clearViewOffset();
  }
  return new Promise((resolve, reject) => {
    out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('capture failed'))), 'image/png');
  });
}
