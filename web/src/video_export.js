// Frame-exact video export with WebCodecs: the caller draws each frame (the
// tour at t = i / fps, whatever the machine's speed), frames are encoded in
// the browser and muxed into an MP4. No upload, no server, any resolution
// the encoder accepts (1080p, 4K).
/* global VideoEncoder, VideoFrame -- WebCodecs */
import { ArrayBufferTarget, Muxer } from '../assets/vendor/mp4-muxer/mp4-muxer.mjs';

// H.264 first (plays everywhere); VP9 and AV1 in MP4 where the browser has
// no H.264 encoder (e.g. Chromium builds without proprietary codecs).
const CANDIDATES = [
  { muxer: 'avc', codec: (w, h) => (w * h > 1920 * 1088 ? 'avc1.640033' : 'avc1.640028'), extra: { avc: { format: 'avc' } } },
  { muxer: 'vp9', codec: () => 'vp09.00.41.08', extra: {} },
  { muxer: 'av1', codec: () => 'av01.0.12M.08', extra: {} }
];

export function videoExportSupported() {
  return typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoFrame' in window;
}

async function pickConfig(width, height, fps, bitrate) {
  for (const c of CANDIDATES) {
    const config = { codec: c.codec(width, height), width, height, bitrate, framerate: fps, ...c.extra };
    try {
      const support = await VideoEncoder.isConfigSupported(config);
      if (support.supported) return { muxerCodec: c.muxer, config: support.config || config };
    } catch {
      // try the next codec
    }
  }
  return null;
}

/**
 * @param width, height  output size (even numbers)
 * @param fps            frames per second
 * @param frameCount     number of frames
 * @param drawFrame(i)   draws frame i and returns the canvas to encode
 * @returns { blob, codec }
 */
export async function encodeVideo({ width, height, fps = 30, frameCount, drawFrame, onProgress, bitrate }) {
  if (!videoExportSupported()) throw new Error('This browser has no WebCodecs video encoder (use Chrome, Edge or a recent Firefox).');
  const w = width - (width % 2);
  const h = height - (height % 2);
  const rate = bitrate || Math.round(w * h * fps * 0.12); // ~0.12 bit per pixel
  const picked = await pickConfig(w, h, fps, rate);
  if (!picked) throw new Error(`No video encoder available for ${w} x ${h}.`);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: picked.muxerCodec, width: w, height: h, frameRate: fps },
    fastStart: 'in-memory'
  });
  let failure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { failure = e; }
  });
  encoder.configure(picked.config);
  const frameUs = 1e6 / fps;
  for (let i = 0; i < frameCount; i++) {
    if (failure) throw failure;
    const source = drawFrame(i);
    const frame = new VideoFrame(source, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    // Keep the encoder queue short so memory stays flat on long tours.
    while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 5));
    if (onProgress && (i % 5 === 0 || i === frameCount - 1)) {
      onProgress((i + 1) / frameCount);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  await encoder.flush();
  if (failure) throw failure;
  encoder.close();
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: picked.config.codec };
}
