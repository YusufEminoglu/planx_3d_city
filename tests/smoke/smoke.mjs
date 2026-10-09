// UI smoke test: loads the benchmark city (make_bench_data.py --buildings
// 1000) in headless Chromium and drives the viewer the way a user would:
// opens every dock, changes every dock setting, runs the analyses, the
// scenario views, camera bookmarks, the tour editor, Model Studio, picking,
// view links, screenshots and the 3D Tiles / CityJSON exports.
// It fails on any uncaught page error or console error; it does not compare
// pixels (tests/visual does that).
//
//   node tests/smoke/smoke.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
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
const PORT = 8768;
// Expected noise: the static server has no scene-state API (the QGIS
// server does) and headless Chromium has no clipboard permission.
const IGNORE = [/api\/scene-state/, /api\/selection/, /Failed to load resource/, /clipboard/i, /favicon/];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: webRoot, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const steps = [];
let page;

async function ready(timeout = 600000) {
  await page.waitForFunction(() => {
    const pill = document.getElementById('scene-state');
    return pill?.dataset.sceneI18n === 'sceneReady' || pill?.style.background === 'rgb(254, 243, 199)';
  }, null, { timeout });
}

async function step(name, fn) {
  const before = errors.length;
  const t0 = Date.now();
  try {
    await fn();
  } catch (err) {
    errors.push(`${name}: ${err.message.split('\n')[0]}`);
  }
  steps.push(`${errors.length > before ? 'FAIL' : 'ok  '} ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (!IGNORE.some((re) => re.test(text))) errors.push(`console: ${text}`);
  });
  page.on('dialog', (d) => d.accept('Smoke view'));
  // Moving things off: the test is about code paths, not animation.
  await page.addInitScript(() => localStorage.setItem('planx_3d_city_settings', JSON.stringify({ showCars: true, showPedestrians: true, showBikes: true, autoTime: false })));
  await page.goto(`http://127.0.0.1:${PORT}/src/index.html`);
  await step('initial scene', () => ready());

  await step('open every dock', async () => {
    const toggles = await page.$$eval('[data-dock-target]', (els) => els.map((e) => e.id).filter(Boolean));
    for (const id of toggles) {
      await page.evaluate((x) => document.getElementById(x).click(), id);
      await page.waitForTimeout(150);
    }
  });

  await step('change every dock setting', async () => {
    const count = await page.$$eval('.dock-panel [data-setting]', (els) => els.length);
    for (let i = 0; i < count; i++) {
      await page.evaluate((idx) => {
        const el = document.querySelectorAll('.dock-panel [data-setting]')[idx];
        if (el.type === 'checkbox') {
          el.checked = !el.checked;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.tagName === 'SELECT') {
          if (el.options.length > 1) el.selectedIndex = (el.selectedIndex + 1) % el.options.length;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (el.type === 'range' || el.type === 'number') {
          const min = Number(el.min || 0);
          const max = Number(el.max || min + 10);
          const v = Number(el.value);
          el.value = String(v + (max - v) / 3 || min);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        } else if (el.type === 'color') {
          el.value = '#4477aa';
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, i);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(1500);
    await ready();
  });

  await step('time and shadow presets', async () => {
    for (const sel of ['[data-time-preset]', '[data-shadow-preset]']) {
      const n = await page.$$eval(sel, (els) => els.length);
      for (let i = 0; i < n; i++) await page.evaluate(([s, idx]) => document.querySelectorAll(s)[idx].click(), [sel, i]);
    }
  });

  await step('sun hours and sky view analysis', async () => {
    await page.evaluate(() => window.__planxPerf.exposure('sun'));
    await page.evaluate(() => window.__planxPerf.exposure('svf'));
    await page.evaluate(() => document.getElementById('shadow-clear').click());
  });

  await step('viewshed', async () => {
    await page.evaluate(() => document.getElementById('viewshed-pick').click());
    await page.mouse.click(640, 420);
    await page.waitForTimeout(4000);
    await page.evaluate(() => document.getElementById('shadow-clear').click());
  });

  await step('hover and pick buildings', async () => {
    for (const [x, y] of [[640, 400], [500, 380], [760, 450]]) {
      await page.mouse.move(x, y);
      await page.waitForTimeout(150);
      await page.mouse.click(x, y);
      await page.waitForTimeout(150);
    }
  });

  await step('scenario views', async () => {
    for (const view of ['Massing', 'Split', 'SplitAB', 'Off']) {
      await page.evaluate((v) => {
        const el = document.querySelector('[data-setting="scenarioView"]');
        if (!el) return;
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, view);
      await page.waitForTimeout(800);
    }
  });

  await step('camera bookmarks and view link', async () => {
    await page.evaluate(() => document.getElementById('bookmark-save').click());
    await page.waitForTimeout(200);
    await page.evaluate(() => document.querySelector('#bookmark-list button, .bookmark-item button')?.click());
    await page.evaluate(() => document.getElementById('btn-copy-view').click());
    await page.waitForTimeout(1500);
  });

  await step('tour editor and playback', async () => {
    for (const id of ['tour-add', 'tour-add', 'tour-update', 'tour-play']) {
      await page.evaluate((x) => document.getElementById(x).click(), id);
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.getElementById('tour-pause').click());
    const dl = page.waitForEvent('download', { timeout: 20000 });
    await page.evaluate(() => document.getElementById('tour-export').click());
    await dl;
    await page.evaluate(() => document.getElementById('tour-delete').click());
  });

  await step('Model Studio lists', async () => {
    await page.evaluate(() => {
      const dock = document.getElementById('model-studio-dock');
      if (dock && dock.classList.contains('hidden')) document.getElementById('model-studio-toggle').click();
    });
    await page.waitForTimeout(300);
    for (const id of ['upload-model-category', 'transform-category']) {
      await page.evaluate((x) => {
        const el = document.getElementById(x);
        if (!el || el.options.length < 2) return;
        el.selectedIndex = 1;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, id);
    }
  });

  await step('screenshot', async () => {
    const dl = page.waitForEvent('download', { timeout: 120000 });
    await page.evaluate(() => document.getElementById('btn-screenshot').click());
    await dl;
  });

  await step('CityJSON export', async () => {
    const dl = page.waitForEvent('download', { timeout: 120000 });
    await page.evaluate(() => document.getElementById('cityjson-export').click());
    await dl;
  });

  await step('3D Tiles export', async () => {
    const dl = page.waitForEvent('download', { timeout: 300000 });
    await page.evaluate(() => document.getElementById('tiles-export').click());
    await dl;
  });

  await step('frame capture', async () => {
    const url = await page.evaluate(() => window.__planxPerf.capture());
    if (!url.startsWith('data:image/png')) throw new Error('no capture');
  });

  await step('presentation and lil-gui panel', async () => {
    await page.keyboard.press('p');
    await page.waitForTimeout(200);
    await page.keyboard.press('p');
    await page.evaluate(() => document.getElementById('advanced-toggle').click());
  });
} finally {
  await browser.close();
  server.kill();
}
console.log(steps.join('\n'));
if (errors.length) {
  console.error(`\n${errors.length} error(s):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('Smoke test passed.');
