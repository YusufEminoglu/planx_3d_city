// Module worker: builds and merges building geometry off the main thread.
// See buildBuildingBuckets() in building_geometry.js for the message format.
import { buildBuildingBuckets } from './building_geometry.js';

const BUFFERS = ['position', 'normal', 'uv', 'color', 'planxId', 'planxGlow'];

self.onmessage = (event) => {
  const { id, specs, looks } = event.data;
  try {
    const buckets = buildBuildingBuckets(specs, looks);
    const transfer = [];
    for (const b of buckets) for (const k of BUFFERS) if (b[k]) transfer.push(b[k].buffer);
    self.postMessage({ id, buckets }, transfer);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack || err) });
  }
};
