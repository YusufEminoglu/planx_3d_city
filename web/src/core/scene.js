// The Three.js scene core: renderer, camera and controls, lights and sky,
// the post-processing composer, and the world with one group per layer.
// Created once when the viewer loads; other modules add to these objects
// but never replace them.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { createAtmosphere } from '../atmosphere.js';
import { setMaxAnisotropy } from '../textures.js';
import { state } from './state.js';

const urlParams = new URLSearchParams(window.location.search);
export const isPortableMode = urlParams.has('portable') || urlParams.get('portable') === '1';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcee4ef);
scene.fog = new THREE.FogExp2(0xcee4ef, 0.0003);

export const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 20000);
camera.position.set(0, 420, 580);

// No preserveDrawingBuffer: screenshots render and read back in the same task,
// and recording uses captureStream, so neither needs the buffer kept.
export const renderer = new THREE.WebGLRenderer({ antialias: true });
setMaxAnisotropy(renderer.capabilities.getMaxAnisotropy?.() || 1);
// Count draw calls per frame across all passes (shadows, AO, bloom);
// animate() resets the counters before each frame it draws.
renderer.info.autoReset = false;
// Adaptive resolution: while the view moves and the frame rate drops, the
// pixel ratio steps down (to 0.75 at most); full resolution comes back for
// the settled frame and while the frame rate has headroom.
export const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, 2);
export const MIN_PIXEL_RATIO = 0.75;

renderer.setPixelRatio(MAX_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('map').appendChild(renderer.domElement);

export const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.getElementById('map').appendChild(labelRenderer.domElement);

// Settled-frame composite: beauty pass into a 4x MSAA half-float target (so
// the frame users look at most is antialiased), ground-truth AO blended onto
// it, night bloom, then OutputPass for colour space conversion. (SSAOPass,
// used before, re-rendered the scene without MSAA and ignored this pass.)
const renderPass = new RenderPass(scene, camera);
const composerTarget = new THREE.WebGLRenderTarget(
  window.innerWidth * renderer.getPixelRatio(), window.innerHeight * renderer.getPixelRatio(),
  { type: THREE.HalfFloatType, samples: 4 }
);
export const aoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
// Scene units are metres: occlusion reaches a few metres (alleys, eaves,
// building bases) without darkening whole blocks.
aoPass.updateGtaoMaterial({ radius: 4, distanceExponent: 1.5, thickness: 3, scale: 1.2, samples: 16 });
aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
aoPass.blendIntensity = 0.9;

export const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);

export const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(renderPass);
composer.addPass(aoPass);
// Presentation depth of field: sharp at the orbit target, blurring with
// distance from it. Off by default; like AO it only runs on the settled frame.
export const DOF_STRENGTH = 0.02;
export const dofPass = new BokehPass(scene, camera, { focus: 300, aperture: DOF_STRENGTH / 300, maxblur: 0.01 });
dofPass.enabled = false;
composer.addPass(dofPass);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
controls.addEventListener('change', () => { state.lastCameraMove = performance.now(); sun.shadow.needsUpdate = true; });

export const walkControls = new PointerLockControls(camera, document.body);

const ambient = new THREE.AmbientLight(0xffffff, 0.62);
scene.add(ambient);
export const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.castShadow = true;
sun.shadow.autoUpdate = false;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

// The shadow camera follows the view: it is centred on the orbit target (or
// the walker) and sized from the camera distance, so close-ups get a sharp
// shadow map while overviews still cover up to 1.6 km. (It used to be a fixed
// box around the origin with the default 500 m far plane, while the sun sat
// 1300 m away, so no shadows were cast at all.)
const SUN_DISTANCE = 2500;
export const sunDirection = new THREE.Vector3(0, 1, 0);
export function fitSunShadow() {
  const focus = state.isWalkMode ? camera.position : controls.target;
  const viewDist = state.isWalkMode ? 120 : camera.position.distanceTo(controls.target);
  const half = THREE.MathUtils.clamp(viewDist * 1.5, 90, 1600);
  // Snap the centre to whole shadow texels so the map does not shimmer.
  const texel = (2 * half) / sun.shadow.mapSize.x;
  const fx = Math.round(focus.x / texel) * texel;
  const fz = Math.round(focus.z / texel) * texel;
  sun.target.position.set(fx, focus.y, fz);
  sun.position.set(fx, focus.y, fz).addScaledVector(sunDirection, SUN_DISTANCE);
  const cam = sun.shadow.camera;
  if (cam.right !== half) {
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
  }
  cam.near = 1;
  cam.far = SUN_DISTANCE * 2;
  cam.updateProjectionMatrix();
  sun.target.updateMatrixWorld();
}

const sky = new Sky();
// Inside the camera's far plane (20 km) so the sky is actually drawn.
sky.scale.setScalar(15000);
scene.add(sky);
export const atmosphere = createAtmosphere({ renderer, scene, sky, ambient });

export const texLoader = new THREE.TextureLoader();
export const world = new THREE.Group();
scene.add(world);

export const islandGroup = new THREE.Group();
export const parcelGroup = new THREE.Group();
export const hardscapeGroup = new THREE.Group();
export const buildingGroup = new THREE.Group();
export const roadGroup = new THREE.Group();
export const treeGroup = new THREE.Group();
export const mosqueGroup = new THREE.Group();
export const tumulusGroup = new THREE.Group();
export const carGroup = new THREE.Group();
export const bikeLaneGroup = new THREE.Group();
export const bikeGroup = new THREE.Group();
export const furnitureGroup = new THREE.Group();
export const pedestrianGroup = new THREE.Group();
export const sidewalkGroup = new THREE.Group();
export const pedestrianPathGroup = new THREE.Group();
export const crosswalkGroup = new THREE.Group();
export const terrainSideGroup = new THREE.Group();
export const windPlumeGroup = new THREE.Group();
export const roiBoundaryGroup = new THREE.Group();
export const fenceGroup = new THREE.Group();
export const waterlineGroup = new THREE.Group();
export const zoningGroup = new THREE.Group();
// Zoning scenario massing (what-if capacity per plot).
export const scenarioGroup = new THREE.Group();
export const scenarioGroupB = new THREE.Group();
world.add(islandGroup);
world.add(parcelGroup);
world.add(hardscapeGroup);
world.add(buildingGroup);
world.add(sidewalkGroup);
world.add(pedestrianPathGroup);
world.add(crosswalkGroup);
world.add(terrainSideGroup);
world.add(windPlumeGroup);
world.add(roadGroup);
world.add(bikeLaneGroup);
world.add(treeGroup);
world.add(mosqueGroup);
world.add(tumulusGroup);
world.add(carGroup);
world.add(bikeGroup);
world.add(furnitureGroup);
world.add(pedestrianGroup);
world.add(roiBoundaryGroup);
world.add(fenceGroup);
world.add(waterlineGroup);
world.add(zoningGroup);
world.add(scenarioGroup);
world.add(scenarioGroupB);

/* Layer Elevation Hierarchy
 * DEM < islands < block paths < buildings/trees < parcels < hardscape slab < roads < bike lanes < sidewalks < cars/bikes.
 * Offsets are relative to the final visible terrain surface.
 */
export const LAYER = {
  waterline: 0.58,
  island:    0.60,
  path:      0.72,
  content:   0.78,
  parcel:    0.94,
  hardscape: 0.98,
  road:      1.36,
  bikeLane:  1.44,
  sidewalk:  1.52,
  carExtra:  0.08
};

export const buildingFunctionMaterials = new Map();

// --- Performance ---
export const rc = new THREE.Raycaster();
rc.firstHitOnly = true;
