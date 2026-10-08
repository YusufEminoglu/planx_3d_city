// Headless benchmark for the PlanX web viewer.
//
// Instruments WebGL at the context level, so it measures any viewer version
// without needing hooks inside app.js:
//   - time from navigation to the "scene ready" state
//   - draw calls and GL frames during an idle window
//   - synchronous frame cost (fixed view and an 8-step orbit) and pick cost,
//     through window.__planxPerf when the viewer exposes it
//   - main-thread long tasks during scene build
//
//   python tests/bench/make_bench_data.py --buildings 10000
//   node tests/bench/bench.mjs [--label name] [--port 8765]
//
// Headless Chromium renders with SwiftShader, so absolute FPS is not
// representative of a real GPU; draw calls, frame counts and build times are.
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

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const port = Number(opt('port', 8765));
const label = opt('label', 'run');
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: webRoot, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Missing optional layers (404) and the scene-state POST (501 on a plain
  // static server) are expected here.
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 400));
  });
  await page.addInitScript(() => {
    const stats = { draws: 0, frames: 0, longTasks: 0, longTaskMs: 0 };
    window.__bench = stats;
    // A frame counts when an animation-frame callback drew anything to the
    // default framebuffer (the canvas); shadow-map and post-process passes
    // render to framebuffer objects and do not count on their own.
    let drewToScreen = false;
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      const origBind = proto.bindFramebuffer;
      proto.bindFramebuffer = function (target, fb) { this.__fb = fb; return origBind.call(this, target, fb); };
      for (const fn of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
        const orig = proto[fn];
        if (!orig) continue;
        proto[fn] = function (...a) {
          // Only the main viewport counts; the minimap has its own context.
          if (this.canvas.parentElement?.id !== 'map') return orig.apply(this, a);
          stats.draws++;
          if (!this.__fb) drewToScreen = true;
          return orig.apply(this, a);
        };
      }
    }
    const origRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => origRaf((ts) => {
      cb(ts);
      if (drewToScreen) stats.frames++;
      drewToScreen = false;
    });
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) { stats.longTasks++; stats.longTaskMs += e.duration; }
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* not supported */ }
  });

  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/src/index.html`);
  await page.waitForSelector('#scene-state[data-scene-i18n="sceneReady"]', { timeout: 600000 });
  const readyMs = Date.now() - t0;
  const build = await page.evaluate(() => ({ ...window.__bench }));
  await page.waitForTimeout(1500); // let post-build work settle

  const sample = async (ms, action) => {
    const a = await page.evaluate(() => ({ ...window.__bench }));
    if (action) await action(); else await page.waitForTimeout(ms);
    const b = await page.evaluate(() => ({ ...window.__bench }));
    const frames = b.frames - a.frames;
    return { frames, draws: b.draws - a.draws, drawsPerFrame: frames ? Math.round((b.draws - a.draws) / frames) : 0, ms };
  };

  // Synchronous frame cost from a fixed camera (needs window.__planxPerf).
  const probe = await page.evaluate(() => {
    if (!window.__planxPerf) return null;
    const ms = window.__planxPerf.timeRender(10);
    const info = window.__planxPerf.info();
    const pick = window.__planxPerf.timePick ? window.__planxPerf.timePick(8) : null;
    return { ms, orbitMs: window.__planxPerf.timeOrbit ? window.__planxPerf.timeOrbit(8) : null, pick, ...info };
  });

  const idle = await sample(3000);

  const result = {
    label,
    readyMs,
    buildLongTasks: build.longTasks,
    buildLongTaskMs: Math.round(build.longTaskMs),
    idleFps: +(idle.frames / 3).toFixed(1),
    idleDrawsPerFrame: idle.drawsPerFrame,
    frameMs: probe ? +probe.ms.toFixed(1) : null,
    orbitFrameMs: probe?.orbitMs != null ? +probe.orbitMs.toFixed(1) : null,
    pickColdMs: probe?.pick ? +probe.pick.coldMs.toFixed(2) : null,
    pickWarmMs: probe?.pick ? +probe.pick.warmMs.toFixed(2) : null,
    pickHits: probe?.pick?.hits ?? null,
    calls: probe?.calls ?? null,
    triangles: probe?.triangles ?? null,
    meshes: probe?.meshes ?? null,
    pageErrors: errors.length
  };
  console.log(JSON.stringify(result));
  if (errors.length) console.error(errors.slice(0, 5).join('\n'));
  if (opt('screenshot')) await page.screenshot({ path: opt('screenshot') });
} finally {
  await browser.close();
  server.kill();
}
