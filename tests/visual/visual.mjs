// Visual regression: renders the benchmark city (make_bench_data.py
// --buildings 1000) from fixed cameras and compares the 3D canvas with the
// baselines in tests/visual/baseline/.
//
// Deterministic setup: camera from a #view= link, no traffic or people
// (they move), no GTAO (its noise texture is random), headless SwiftShader,
// the WebGL canvas only (no UI, so fonts do not matter).
// A view fails when more than MAX_DIFF_SHARE of its pixels differ by more
// than PIXEL_TOLERANCE in any channel; the actual image and a diff image are
// written to tests/visual/output/ (uploaded by CI).
//
//   node tests/visual/visual.mjs            # compare
//   node tests/visual/visual.mjs --update   # write new baselines
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.NODE_PATH || '/opt/node22/lib/node_modules', 'playwright')));
}

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '../../web');
const baselineDir = path.join(here, 'baseline');
const outputDir = path.join(here, 'output');
const update = process.argv.includes('--update');
const PORT = 8767;
const PIXEL_TOLERANCE = 24;
const MAX_DIFF_SHARE = 0.015;

const STILL = { showCars: false, showPedestrians: false, showBikes: false, enableSSAO: false, enableBloom: false, autoTime: false, treeWind: false, depthOfField: false };
const VIEWS = [
  { name: 'overview-day', hash: '#view=-420,380,520,0,0,0,50,10', settings: { atmosphere: 'Cinematic' } },
  { name: 'street-afternoon', hash: '#view=60,24,-170,0,8,40,55,16', settings: { atmosphere: 'Cinematic' } },
  { name: 'overview-night', hash: '#view=380,420,-380,0,0,0,50,22', settings: { atmosphere: 'Cinematic' } },
  { name: 'clean-noon', hash: '#view=0,520,-300,0,0,0,50,12', settings: { atmosphere: 'Clean' } }
];

// Runs in the page: compares two PNG data URLs, returns the share of
// differing pixels and a diff image (red where different).
async function comparePngs({ a, b, tolerance }) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) return { share: 1, sizeMismatch: true, diff: null };
  const w = ia.width;
  const h = ia.height;
  const read = (img) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  };
  const da = read(ia).data;
  const db = read(ib).data;
  const out = new ImageData(w, h);
  let bad = 0;
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
    const grey = (da[i] + da[i + 1] + da[i + 2]) / 12;
    if (d > tolerance) {
      bad++;
      out.data.set([255, 0, 0, 255], i);
    } else {
      out.data.set([grey, grey, grey, 255], i);
    }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').putImageData(out, 0, 0);
  return { share: bad / (w * h), diff: c.toDataURL('image/png') };
}

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: webRoot, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failed = false;
try {
  fs.mkdirSync(baselineDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });
  for (const view of VIEWS) {
    const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript((s) => localStorage.setItem('planx_3d_city_settings', JSON.stringify(s)), { ...STILL, ...view.settings });
    await page.goto(`http://127.0.0.1:${PORT}/src/index.html${view.hash}`);
    await page.waitForSelector('#scene-state[data-scene-i18n="sceneReady"]', { timeout: 600000 });
    // The mouse stays off the canvas (no hover highlight); the frame is read
    // straight from the WebGL canvas, so UI and fonts are not compared.
    await page.waitForTimeout(3500);
    const dataUrl = await page.evaluate(() => window.__planxPerf.capture());
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    const file = path.join(baselineDir, `${view.name}.png`);
    if (errors.length) {
      failed = true;
      console.log(`${view.name}: page errors`, errors);
    }
    if (update || !fs.existsSync(file)) {
      fs.writeFileSync(file, png);
      console.log(`${view.name}: baseline written`);
    } else {
      const toUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
      const result = await page.evaluate(comparePngs, { a: toUrl(png), b: toUrl(fs.readFileSync(file)), tolerance: PIXEL_TOLERANCE });
      const ok = !result.sizeMismatch && result.share <= MAX_DIFF_SHARE;
      console.log(`${view.name}: ${(result.share * 100).toFixed(2)}% pixels differ ${ok ? 'ok' : 'FAIL'}`);
      if (!ok) {
        failed = true;
        fs.writeFileSync(path.join(outputDir, `${view.name}.actual.png`), png);
        if (result.diff) fs.writeFileSync(path.join(outputDir, `${view.name}.diff.png`), Buffer.from(result.diff.split(',')[1], 'base64'));
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
if (failed) {
  console.error('Visual regression. Inspect tests/visual/output/; if the change is intended, run: node tests/visual/visual.mjs --update');
  process.exit(1);
}
