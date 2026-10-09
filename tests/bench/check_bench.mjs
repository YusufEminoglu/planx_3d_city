// Benchmark gate for CI: runs bench.mjs on the deterministic benchmark city
// (python tests/bench/make_bench_data.py --buildings 1000) and compares the
// result with tests/bench/baseline.json.
//
// - Deterministic metrics (draw calls, triangles, meshes) must not grow by
//   more than 10%; page errors must be zero. These fail the build.
// - Timings are reported against the baseline but only fail when more than
//   3x slower: CI machines vary too much for a tighter timing gate.
//
//   node tests/bench/check_bench.mjs            # check
//   node tests/bench/check_bench.mjs --update   # write a new baseline
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const baselinePath = path.join(here, 'baseline.json');
const update = process.argv.includes('--update');

const run = spawnSync(process.execPath, [path.join(here, 'bench.mjs'), '--label', 'ci', '--port', '8766'], {
  encoding: 'utf8',
  timeout: 15 * 60 * 1000
});
if (run.status !== 0) {
  console.error(run.stdout, run.stderr);
  console.error('bench.mjs failed');
  process.exit(1);
}
const line = run.stdout.trim().split('\n').reverse().find((l) => l.startsWith('{'));
if (!line) {
  console.error(run.stdout);
  console.error('no benchmark result');
  process.exit(1);
}
const result = JSON.parse(line);

const STRUCTURE = ['calls', 'triangles', 'meshes'];
const TIMING = ['readyMs', 'frameMs', 'orbitFrameMs', 'pickWarmMs'];

if (update) {
  const keep = Object.fromEntries([...STRUCTURE, ...TIMING].map((k) => [k, result[k]]));
  fs.writeFileSync(baselinePath, `${JSON.stringify({ buildings: 1000, ...keep }, null, 2)}\n`);
  console.log('baseline written', keep);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
let failed = false;
const rows = [];
const row = (metric, base, now, verdict) => rows.push({ metric, baseline: base, now, change: base ? `${(((now - base) / base) * 100).toFixed(1)}%` : '-', verdict });

if (result.pageErrors > 0) {
  failed = true;
  rows.push({ metric: 'pageErrors', baseline: 0, now: result.pageErrors, change: '-', verdict: 'FAIL' });
}
for (const k of STRUCTURE) {
  const ok = result[k] <= baseline[k] * 1.1;
  if (!ok) failed = true;
  row(k, baseline[k], result[k], ok ? 'ok' : 'FAIL (>10% more)');
}
for (const k of TIMING) {
  if (!Number.isFinite(baseline[k]) || !Number.isFinite(result[k])) continue;
  const ratio = result[k] / Math.max(1e-6, baseline[k]);
  let verdict = 'ok';
  if (ratio > 3) {
    verdict = 'FAIL (>3x slower)';
    failed = true;
  } else if (ratio > 1.1) {
    verdict = 'slower (warning only)';
  }
  row(k, baseline[k], Math.round(result[k] * 100) / 100, verdict);
}
console.table(rows);
if (failed) {
  console.error('Benchmark regression. If the change is intended, run: node tests/bench/check_bench.mjs --update');
  process.exit(1);
}
console.log('Benchmark within limits.');
