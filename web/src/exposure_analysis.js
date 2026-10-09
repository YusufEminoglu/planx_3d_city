// @ts-check
// GPU exposure analysis: direct sun hours over a day, or sky view factor,
// for every surface seen from above (streets, squares, roofs) at once.
//
// 1. Heights: the scene is rendered from straight above with a depth
//    material, giving the top surface of every texel of the analysis area.
// 2. For each sample direction (a sun position, or a direction on the sky
//    hemisphere) a depth map is rendered from that direction, like a shadow
//    map, and a full-screen pass adds the direction's weight to every texel
//    that the depth map shows as unobstructed (additive blending into a float
//    target).
// 3. One read-back gives the result per texel.
//
// Cost: one depth render of the scene per direction plus a cheap full-screen
// pass, so dozens of directions take a fraction of a second on a GPU, against
// minutes of raycasting.
import * as THREE from 'three';

const FULLSCREEN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const ACCUMULATE_FRAGMENT = `
precision highp float;
#include <packing>
varying vec2 vUv;
uniform sampler2D tHeight;
uniform sampler2D tDepth;
uniform mat4 uTopInvViewProj;
uniform mat4 uDirViewProj;
uniform float uWeight;
uniform float uBias;
uniform float uLift;
// Perspective views (viewshed): compare linear distances along the view
// axis, and count only texels inside this view's frustum.
uniform float uPerspective;
uniform mat4 uDirView;
uniform float uNear;
uniform float uFar;
uniform float uBiasMeters;
uniform float uMaxDistance;
void main() {
  float d = texture2D(tHeight, vUv).r;
  if (d <= 0.0) discard; // nothing below this texel
  // Depth material output is 1 - gl_FragCoord.z: back to a world position.
  vec4 world = uTopInvViewProj * vec4(vUv * 2.0 - 1.0, (1.0 - d) * 2.0 - 1.0, 1.0);
  world /= world.w;
  world.y += uLift;
  vec4 clip = uDirViewProj * world;
  if (uPerspective > 0.5) {
    if (clip.w <= 0.0) discard;
    vec3 pndc = clip.xyz / clip.w;
    vec2 puv = pndc.xy * 0.5 + 0.5;
    if (puv.x < 0.0 || puv.x > 1.0 || puv.y < 0.0 || puv.y > 1.0 || pndc.z > 1.0) discard;
    float selfDist = -(uDirView * world).z;
    if (length((uDirView * world).xyz) > uMaxDistance) discard;
    float occ = 1.0 - texture2D(tDepth, puv).r;
    float occDist = occ >= 1.0 ? 1e9 : -perspectiveDepthToViewZ(occ, uNear, uFar);
    float seen = selfDist <= occDist + uBiasMeters ? 1.0 : 0.0;
    gl_FragColor = vec4(uWeight * seen, uWeight, 0.0, 1.0);
    return;
  }
  vec3 ndc = clip.xyz / clip.w;
  vec2 duv = ndc.xy * 0.5 + 0.5;
  float lit = 1.0;
  if (duv.x >= 0.0 && duv.x <= 1.0 && duv.y >= 0.0 && duv.y <= 1.0) {
    float occluder = 1.0 - texture2D(tDepth, duv).r;
    float self = ndc.z * 0.5 + 0.5;
    lit = self <= occluder + uBias ? 1.0 : 0.0;
  }
  gl_FragColor = vec4(uWeight * lit, uWeight, 0.0, 1.0);
}`;

/**
 * Sun directions over one day, every stepMinutes while the sun is above
 * minElevationDeg, each weighted with its time step in hours.
 * solarPosition(hour, dayOfYear, latitude) -> { elevation, azimuth } (rad,
 * azimuth clockwise from north) is the viewer's own solar model, and
 * toDirection(azimuth, elevation) its conversion to scene axes.
 */
export function sunPathDirections(solarPosition, toDirection, dayOfYear, latitude, { stepMinutes = 15, minElevationDeg = 2 } = {}) {
  const dirs = [];
  const step = stepMinutes / 60;
  for (let h = step / 2; h < 24; h += step) {
    const { elevation, azimuth } = solarPosition(h, dayOfYear, latitude);
    if (elevation < THREE.MathUtils.degToRad(minElevationDeg)) continue;
    dirs.push({ dir: toDirection(azimuth, elevation), weight: step });
  }
  return dirs;
}

/**
 * Sky hemisphere directions for the sky view factor: rings of equal solid
 * angle, cosine weighted, so the weights sum to 1 for a free horizon.
 */
export function skyDirections(rings = 8, perRing = 16) {
  const dirs = [];
  let total = 0;
  for (let r = 0; r < rings; r++) {
    // Zenith angle at the ring centre (uniform in cos^2, i.e. equal
    // projected solid angle per ring).
    const c2a = 1 - r / rings;
    const c2b = 1 - (r + 1) / rings;
    const theta = Math.acos(Math.sqrt((c2a + c2b) / 2));
    for (let k = 0; k < perRing; k++) {
      const phi = (2 * Math.PI * (k + (r % 2) * 0.5)) / perRing;
      const dir = new THREE.Vector3().setFromSphericalCoords(1, theta, phi);
      dirs.push({ dir, weight: 1 });
      total += 1;
    }
  }
  for (const d of dirs) d.weight /= total;
  return dirs;
}

export class ExposureAnalysis {
  constructor(renderer) {
    this.renderer = renderer;
    const gl = renderer.getContext();
    // Float targets need EXT_color_buffer_float; half floats are the fallback.
    this.type = renderer.extensions.has('EXT_color_buffer_float') ? THREE.FloatType : THREE.HalfFloatType;
    this.depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.BasicDepthPacking, side: THREE.DoubleSide });
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.accumulate = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERTEX,
      fragmentShader: ACCUMULATE_FRAGMENT,
      uniforms: {
        tHeight: { value: null },
        tDepth: { value: null },
        uTopInvViewProj: { value: new THREE.Matrix4() },
        uDirViewProj: { value: new THREE.Matrix4() },
        uWeight: { value: 1 },
        uBias: { value: 0.0005 },
        uLift: { value: 0.3 },
        uPerspective: { value: 0 },
        uDirView: { value: new THREE.Matrix4() },
        uNear: { value: 0.5 },
        uFar: { value: 1000 },
        uBiasMeters: { value: 0.75 },
        uMaxDistance: { value: 1e9 }
      },
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      depthTest: false,
      depthWrite: false
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accumulate);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  }

  _target(size) {
    return new THREE.WebGLRenderTarget(size, size, {
      type: this.type,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true
    });
  }

  _renderDepth(scene, camera, target) {
    const r = this.renderer;
    const prevOverride = scene.overrideMaterial;
    const prevBackground = scene.background;
    const prevTarget = r.getRenderTarget();
    const prevClear = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    scene.overrideMaterial = this.depthMaterial;
    scene.background = null;
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.render(scene, camera);
    r.setRenderTarget(prevTarget);
    r.setClearColor(prevClear, prevAlpha);
    scene.overrideMaterial = prevOverride;
    scene.background = prevBackground;
  }

  _readRed(target, size, channels = [0]) {
    const n = size * size;
    const raw = this.type === THREE.FloatType ? new Float32Array(n * 4) : new Uint16Array(n * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, size, size, raw);
    const out = channels.map(() => new Float32Array(n));
    for (let i = 0; i < n; i++) {
      channels.forEach((c, k) => {
        const v = raw[i * 4 + c];
        out[k][i] = this.type === THREE.FloatType ? v : THREE.DataUtils.fromHalfFloat(v);
      });
    }
    return out;
  }

  /**
   * Analyse every surface seen from above. Result rows start at the north
   * edge; values: sum of weights of unobstructed directions per texel;
   * coverage: sum of all weights (where a surface exists), else 0;
   * heights: surface height per texel (NaN where nothing).
   * @param {object} args
   * @param {any} args.scene scene to analyse (only meshes to include visible)
   * @param {{ minX: number, maxX: number, minZ: number, maxZ: number, minY: number, maxY: number }} args.area local metres
   * @param {{ dir: any, weight: number }[]} [args.directions] towards the sky (sun, sky modes)
   * @param {any} [args.eye] observer position: viewshed mode
   * @param {number} [args.maxDistance] viewshed radius (m)
   * @param {number} [args.resolution] texels per side of the result
   * @param {number} [args.depthResolution] texels per side of each depth map
   * @param {(fraction: number) => void} [args.onProgress]
   * @returns {Promise<{ size: number, area: { minX: number, maxX: number, minZ: number, maxZ: number },
   *   values: Float32Array, coverage: Float32Array, heights: Float32Array }>}
   */
  async run({ scene, area, directions = [], eye = null, maxDistance = 1000, resolution = 512, depthResolution = 2048, onProgress }) {
    const r = this.renderer;
    const size = Math.min(resolution, this.maxTexture);
    const dSize = Math.min(depthResolution, this.maxTexture);
    const cx = (area.minX + area.maxX) / 2;
    const cz = (area.minZ + area.maxZ) / 2;
    const hx = (area.maxX - area.minX) / 2;
    const hz = (area.maxZ - area.minZ) / 2;
    const half = Math.max(hx, hz);
    const top = area.maxY + 50;
    const span = top - area.minY + 100;

    // 1. Surface heights, looking straight down (north = -Z at the top).
    const topCam = new THREE.OrthographicCamera(-half, half, half, -half, 1, span);
    topCam.position.set(cx, top, cz);
    topCam.up.set(0, 0, -1);
    topCam.lookAt(cx, area.minY, cz);
    topCam.updateMatrixWorld();
    topCam.updateProjectionMatrix();
    const heightTarget = this._target(size);
    this._renderDepth(scene, topCam, heightTarget);
    const topInvViewProj = new THREE.Matrix4().multiplyMatrices(topCam.projectionMatrix, topCam.matrixWorldInverse).invert();

    // 2. One depth map per direction, accumulated into the result.
    const accum = this._target(size);
    const depthTarget = this._target(dSize);
    const radius = Math.hypot(half, half, (area.maxY - area.minY) / 2) + 20;
    const centre = new THREE.Vector3(cx, (area.minY + area.maxY) / 2, cz);
    const dirCam = new THREE.OrthographicCamera(-radius, radius, radius, -radius, 1, 4 * radius);
    const u = this.accumulate.uniforms;
    u.tHeight.value = heightTarget.texture;
    u.tDepth.value = depthTarget.texture;
    u.uTopInvViewProj.value.copy(topInvViewProj);
    // Depth bias of about 1 m in the direction camera's range, scaled to
    // the depth map's texel size for low sun angles.
    u.uBias.value = Math.max(1, (2 * radius) / dSize * 2) / (4 * radius);
    const prevTarget = r.getRenderTarget();
    r.setRenderTarget(accum);
    r.setClearColor(0x000000, 0);
    r.clear(true, true, false);
    r.setRenderTarget(prevTarget);
    // Views: an orthographic camera per direction (sun, sky), or for a
    // viewshed six 90-degree cameras at the observer's eye (a cube map).
    const views = [];
    if (eye) {
      const faces = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (const [x, y, z] of faces) {
        const cam = new THREE.PerspectiveCamera(90, 1, 0.5, maxDistance * 1.5);
        cam.position.copy(eye);
        cam.up.set(0, 1, 0);
        if (y !== 0) cam.up.set(0, 0, -1);
        cam.lookAt(eye.x + x, eye.y + y, eye.z + z);
        cam.updateMatrixWorld();
        cam.updateProjectionMatrix();
        views.push({ camera: cam, weight: 1 });
      }
    } else {
      for (const { dir, weight } of directions) views.push({ dir, weight });
    }
    u.uPerspective.value = eye ? 1 : 0;
    u.uMaxDistance.value = eye ? maxDistance : 1e9;
    for (let i = 0; i < views.length; i++) {
      const view = views[i];
      let cam = view.camera;
      if (!cam) {
        cam = dirCam;
        dirCam.position.copy(centre).addScaledVector(view.dir, 2 * radius);
        dirCam.up.set(0, 1, 0);
        if (Math.abs(view.dir.y) > 0.99) dirCam.up.set(0, 0, -1);
        dirCam.lookAt(centre);
        dirCam.updateMatrixWorld();
      }
      this._renderDepth(scene, cam, depthTarget);
      u.uDirViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      u.uDirView.value.copy(cam.matrixWorldInverse);
      u.uNear.value = cam.near;
      u.uFar.value = cam.far;
      u.uWeight.value = view.weight;
      const before = r.getRenderTarget();
      const autoClear = r.autoClear;
      r.autoClear = false;
      r.setRenderTarget(accum);
      r.render(this.quadScene, this.quadCamera);
      r.setRenderTarget(before);
      r.autoClear = autoClear;
      if (onProgress && (i % 4 === 3 || i === views.length - 1)) {
        onProgress((i + 1) / views.length);
        await new Promise((res) => setTimeout(res, 0));
      }
    }

    // 3. Read back. Render target rows start at the bottom (south): flip so
    // row 0 is the north edge, like an image.
    const [valuesRaw, coverageRaw] = this._readRed(accum, size, [0, 1]);
    const [heightRaw] = this._readRed(heightTarget, size, [0]);
    const values = new Float32Array(size * size);
    const coverage = new Float32Array(size * size);
    const heights = new Float32Array(size * size);
    const p = new THREE.Vector4();
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size;
      const dst = y * size;
      for (let x = 0; x < size; x++) {
        values[dst + x] = valuesRaw[src + x];
        coverage[dst + x] = coverageRaw[src + x];
        const d = heightRaw[src + x];
        if (d > 0) {
          p.set(((x + 0.5) / size) * 2 - 1, ((size - 1 - y + 0.5) / size) * 2 - 1, (1 - d) * 2 - 1, 1).applyMatrix4(topInvViewProj);
          heights[dst + x] = p.y / p.w;
        } else {
          heights[dst + x] = NaN;
        }
      }
    }
    heightTarget.dispose();
    accum.dispose();
    depthTarget.dispose();
    return { size, area: { minX: cx - half, maxX: cx + half, minZ: cz - half, maxZ: cz + half }, values, coverage, heights };
  }

  dispose() {
    this.depthMaterial.dispose();
    this.accumulate.dispose();
  }
}
