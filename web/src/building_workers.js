// @ts-check
// Worker pool for building geometry. Specs are grouped by tile and whole
// tiles are dealt to workers, so every (look, tile) bucket comes back complete
// from one worker and needs no further merging. Falls back to building on the
// main thread when module workers are unavailable or fail.
import { buildBuildingBuckets } from './building_geometry.js';

const MAX_WORKERS = 6;
const MIN_SPECS_FOR_WORKERS = 200; // below this, worker start-up costs more than it saves
let pool = null;
let disabled = false;
let nextId = 1;

function createPool() {
  const count = Math.max(1, Math.min(MAX_WORKERS, (navigator.hardwareConcurrency || 2) - 1));
  const workers = [];
  for (let i = 0; i < count; i++) {
    /** @type {Worker & { pending: Map<number, { resolve: Function, reject: Function }> }} */
    const worker = Object.assign(new Worker(new URL('./building_worker.js', import.meta.url), { type: 'module' }), { pending: new Map() });
    worker.onmessage = (event) => {
      const { id, buckets, error } = event.data;
      const job = worker.pending.get(id);
      if (!job) return;
      worker.pending.delete(id);
      if (error) job.reject(new Error(error)); else job.resolve(buckets);
    };
    worker.onerror = (event) => {
      event.preventDefault?.();
      for (const job of worker.pending.values()) job.reject(new Error(event.message || 'building worker failed'));
      worker.pending.clear();
    };
    workers.push(worker);
  }
  return workers;
}

function disablePool() {
  disabled = true;
  if (pool) pool.forEach((w) => w.terminate());
  pool = null;
}

function run(worker, specs, looks) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    worker.pending.set(id, { resolve, reject });
    worker.postMessage({ id, specs, looks });
  });
}

// Workers used by the last build (0 = main thread), for the perf probe.
export let lastBuildWorkers = 0;

export async function buildBuildingsParallel(specs, looks) {
  lastBuildWorkers = 0;
  if (disabled || specs.length < MIN_SPECS_FOR_WORKERS || typeof Worker === 'undefined') {
    return buildBuildingBuckets(specs, looks);
  }
  try {
    if (!pool) pool = createPool();
  } catch (err) {
    console.warn('Building workers unavailable; building on the main thread.', err);
    disablePool();
    return buildBuildingBuckets(specs, looks);
  }
  const byTile = new Map();
  for (const spec of specs) {
    let list = byTile.get(spec.tile);
    if (!list) byTile.set(spec.tile, (list = []));
    list.push(spec);
  }
  const chunks = pool.map(() => []);
  const loads = pool.map(() => 0);
  for (const tile of [...byTile.values()].sort((a, b) => b.length - a.length)) {
    let k = 0;
    for (let i = 1; i < loads.length; i++) if (loads[i] < loads[k]) k = i;
    chunks[k].push(...tile);
    loads[k] += tile.length;
  }
  try {
    const parts = await Promise.all(chunks.map((chunk, i) => (chunk.length ? run(pool[i], chunk, looks) : [])));
    lastBuildWorkers = chunks.filter((c) => c.length).length;
    return parts.flat();
  } catch (err) {
    console.warn('Building workers failed; building on the main thread.', err);
    disablePool();
    return buildBuildingBuckets(specs, looks);
  }
}
