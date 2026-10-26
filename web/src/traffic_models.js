// @ts-check
// Street life models for instanced drawing: cars, vans, buses and taxis, and
// walking people. Every model is one merged geometry, so a whole fleet is a
// single draw call per model (InstancedMesh):
//   - vehicles: a side-profile body with wheel arches and rounded edges, a
//     glass cabin, roof, pillars, wheels with rims, bumpers, plates, lights.
//     aCarMat per vertex = (takes the instance paint colour, is glass, light:
//     1 headlight, 2 tail light); lights glow at night (uTrafficNight);
//   - people: limbs swing in the vertex shader (no per-person objects or
//     CPU animation); per-person skin, shirt, trousers and hair colours and
//     gait come from instanced attributes.
import * as THREE from 'three';

// --- geometry helpers --------------------------------------------------------

class PartBuilder {
  constructor(extraName, extraSize) {
    this.pos = [];
    this.nor = [];
    this.col = [];
    this.extra = [];
    this.extraName = extraName;
    this.extraSize = extraSize;
  }

  /**
   * @param {any} geo THREE.BufferGeometry (consumed)
   * @param {number} color hex (sRGB)
   * @param {number[]} extra per-vertex attribute value
   * @param {any} [matrix] THREE.Matrix4
   */
  add(geo, color, extra, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(color);
    const P = g.attributes.position.array;
    const N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) {
      this.pos.push(P[i]);
      this.nor.push(N[i]);
    }
    const n = P.length / 3;
    for (let i = 0; i < n; i++) {
      this.col.push(c.r, c.g, c.b);
      for (const v of extra) this.extra.push(v);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    geo.setAttribute(this.extraName, new THREE.Float32BufferAttribute(this.extra, this.extraSize));
    geo.computeBoundingSphere();
    return geo;
  }
}

const m4 = () => new THREE.Matrix4();
const at = (x, y, z) => m4().makeTranslation(x, y, z);

// Side profile [s, y] (s = metres along the car, front at -L/2) extruded
// across the width, centred on x = 0, front facing +Z.
function profileSolid(points, width, bevel = 0.05) {
  const shape = new THREE.Shape(points.map(([s, y]) => new THREE.Vector2(s, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.7,
    bevelSegments: 1,
    curveSegments: 3
  });
  // Shape x (along) -> world -z (so s = -L/2 is the front at +z); depth -> x.
  geo.rotateY(Math.PI / 2);
  geo.translate(-depth / 2, 0, 0);
  return geo;
}

// Body outline with two wheel arches.
function bodyOutline(o) {
  const { L, sill, noseY, hoodY, beltY, tailY, hood, deck, frontAxle, rearAxle, wheelR } = o;
  const f = -L / 2;
  const r = L / 2;
  const pts = [
    [f, sill + 0.1], [f - 0.02, noseY - 0.1], [f + 0.1, noseY], [f + hood, hoodY],
    [r - deck, beltY], [r - 0.06, tailY], [r, tailY - 0.14], [r, sill + 0.12], [r - 0.1, sill]
  ];
  const arch = (cs) => {
    const R = wheelR + 0.06;
    const cy = wheelR;
    const a0 = Math.asin(Math.max(-1, Math.min(1, (sill - cy) / R)));
    // Rear to front along the sill: angle from a0 over the top to pi - a0.
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const a = a0 + (Math.PI - 2 * a0) * (i / n);
      pts.push([cs + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
  };
  arch(r - rearAxle);
  arch(f + frontAxle);
  pts.push([f + 0.12, sill]);
  return pts;
}

/**
 * @typedef {{ name: string, L: number, W: number, sill: number, noseY: number, hoodY: number,
 *   beltY: number, tailY: number, hood: number, deck: number, frontAxle: number, rearAxle: number,
 *   wheelR: number, roofY: number, screenRun: number, rearRun: number, cabinInset: number,
 *   taxiSign?: boolean, busWindows?: boolean }} VehicleSpec
 */

/** @type {VehicleSpec[]} */
export const VEHICLE_TYPES = [
  { name: 'sedan', L: 4.5, W: 1.8, sill: 0.2, noseY: 0.7, hoodY: 0.92, beltY: 0.98, tailY: 0.93, hood: 1.3, deck: 1.0,
    frontAxle: 0.92, rearAxle: 0.95, wheelR: 0.32, roofY: 1.44, screenRun: 0.75, rearRun: 0.55, cabinInset: 0.13 },
  { name: 'hatchback', L: 4.0, W: 1.76, sill: 0.2, noseY: 0.7, hoodY: 0.93, beltY: 1.0, tailY: 1.02, hood: 1.15, deck: 0.18,
    frontAxle: 0.85, rearAxle: 0.7, wheelR: 0.31, roofY: 1.48, screenRun: 0.72, rearRun: 0.3, cabinInset: 0.12 },
  { name: 'suv', L: 4.65, W: 1.9, sill: 0.32, noseY: 0.9, hoodY: 1.08, beltY: 1.14, tailY: 1.14, hood: 1.2, deck: 0.22,
    frontAxle: 0.95, rearAxle: 0.95, wheelR: 0.38, roofY: 1.74, screenRun: 0.62, rearRun: 0.22, cabinInset: 0.1 },
  { name: 'van', L: 5.1, W: 2.0, sill: 0.3, noseY: 0.95, hoodY: 1.15, beltY: 1.2, tailY: 1.2, hood: 0.85, deck: 0.04,
    frontAxle: 0.9, rearAxle: 1.0, wheelR: 0.36, roofY: 2.2, screenRun: 0.5, rearRun: 0.02, cabinInset: 0.06 },
  { name: 'taxi', L: 4.5, W: 1.8, sill: 0.2, noseY: 0.7, hoodY: 0.92, beltY: 0.98, tailY: 0.93, hood: 1.3, deck: 1.0,
    frontAxle: 0.92, rearAxle: 0.95, wheelR: 0.32, roofY: 1.44, screenRun: 0.75, rearRun: 0.55, cabinInset: 0.13, taxiSign: true },
  { name: 'bus', L: 12.0, W: 2.55, sill: 0.35, noseY: 1.2, hoodY: 1.25, beltY: 1.25, tailY: 1.25, hood: 0.08, deck: 0.04,
    frontAxle: 2.6, rearAxle: 3.2, wheelR: 0.5, roofY: 2.95, screenRun: 0.15, rearRun: 0.02, cabinInset: 0.02, busWindows: true }
];

const TRIM = 0x1c1f24;
const TYRE = 0x111214;
const RIM = 0xb8bcc2;
const GLASS = 0x1b2530;
const HEAD = 0xf4f1e6;
const TAIL = 0x8a1010;
const PLATE = 0xf2f2ee;

/**
 * Merged vehicle geometry, front facing +Z, ground at y = 0.
 * @param {VehicleSpec} spec
 */
export function createVehicleGeometry(spec) {
  const b = new PartBuilder('aCarMat', 3);
  const PAINT = [1, 0, 0];
  const PLAIN = [0, 0, 0];
  const GLASSY = [0, 1, 0];
  const { L, W } = spec;
  const f = -L / 2;
  const r = L / 2;

  b.add(profileSolid(bodyOutline(spec), W, 0.07), 0xffffff, PAINT);

  // Glass cabin (narrower: the shoulders show) and the roof on top.
  const cabinW = W - 2 * spec.cabinInset;
  const cs0 = f + spec.hood - 0.04;
  const cs1 = r - spec.deck + 0.04;
  const cabin = [
    [cs0, spec.hoodY - 0.03], [cs0 + spec.screenRun, spec.roofY - 0.04],
    [cs1 - spec.rearRun, spec.roofY - 0.04], [cs1, spec.beltY - 0.03]
  ];
  b.add(profileSolid(cabin, cabinW, 0.03), GLASS, GLASSY);
  const rf0 = cs0 + spec.screenRun - 0.04;
  const rf1 = cs1 - spec.rearRun + 0.04;
  b.add(profileSolid([[rf0, spec.roofY - 0.06], [rf1, spec.roofY - 0.06], [rf1 - 0.05, spec.roofY + 0.03], [rf0 + 0.05, spec.roofY + 0.03]], cabinW + 0.04, 0.03), 0xffffff, PAINT);
  if (spec.busWindows) {
    // Pillars between the bus windows.
    for (let s = cs0 + 1.2; s < cs1 - 0.6; s += 1.45) {
      b.add(new THREE.BoxGeometry(cabinW + 0.03, spec.roofY - spec.beltY, 0.12), 0xffffff, PAINT, at(0, (spec.roofY + spec.beltY) / 2, -s));
    }
    // Destination display above the windscreen.
    b.add(new THREE.BoxGeometry(1.6, 0.22, 0.04), 0xffb020, [0, 0, 1], at(0, spec.roofY - 0.2, r + 0.06));
  } else {
    // B pillar and A pillars.
    const mid = (cs0 + spec.screenRun + cs1 - spec.rearRun) / 2;
    b.add(new THREE.BoxGeometry(cabinW + 0.03, spec.roofY - spec.beltY, 0.1), 0xffffff, PAINT, at(0, (spec.roofY + spec.beltY) / 2 - 0.02, -mid));
    const aLen = Math.hypot(spec.screenRun, spec.roofY - spec.hoodY);
    const aTilt = Math.atan2(spec.screenRun, spec.roofY - spec.hoodY);
    for (const side of [-1, 1]) {
      const m = at(side * (cabinW / 2 - 0.01), (spec.roofY + spec.hoodY) / 2, -(cs0 + spec.screenRun / 2))
        .multiply(m4().makeRotationX(-aTilt));
      b.add(new THREE.BoxGeometry(0.07, aLen, 0.07), 0xffffff, PAINT, m);
      // Mirrors.
      b.add(new THREE.BoxGeometry(0.16, 0.1, 0.07), 0xffffff, PAINT, at(side * (W / 2 + 0.04), spec.beltY + 0.05, -(cs0 + 0.15)));
    }
  }
  if (spec.taxiSign) {
    b.add(new THREE.BoxGeometry(0.62, 0.16, 0.24), 0xf6f2dc, [0, 0, 1], at(0, spec.roofY + 0.11, -((rf0 + rf1) / 2)));
  }

  // Bumpers, plates, lights, on the body skin (the bevel grows the
  // profile by about 5 cm).
  const front = r + 0.05;
  const rear = f - 0.05;
  const bumperY = spec.sill + 0.12;
  b.add(new THREE.BoxGeometry(W - 0.04, 0.2, 0.14), TRIM, PLAIN, at(0, bumperY, front + 0.02));
  b.add(new THREE.BoxGeometry(W - 0.04, 0.2, 0.14), TRIM, PLAIN, at(0, bumperY, rear - 0.02));
  b.add(new THREE.BoxGeometry(0.52, 0.12, 0.02), PLATE, PLAIN, at(0, bumperY + 0.02, front + 0.1));
  b.add(new THREE.BoxGeometry(0.52, 0.12, 0.02), PLATE, PLAIN, at(0, bumperY + 0.18, rear - 0.01));
  const headY = spec.noseY - 0.12;
  const tailY = spec.tailY - 0.2;
  for (const side of [-1, 1]) {
    b.add(new THREE.BoxGeometry(0.34, 0.13, 0.06), HEAD, [0, 0, 1], at(side * (W / 2 - 0.26), headY, front - 0.01));
    b.add(new THREE.BoxGeometry(0.3, spec.busWindows ? 0.3 : 0.14, 0.06), TAIL, [0, 0, 2], at(side * (W / 2 - 0.22), tailY, rear + 0.01));
  }
  // Grille.
  if (!spec.busWindows) b.add(new THREE.BoxGeometry(W * 0.42, 0.14, 0.04), TRIM, PLAIN, at(0, headY - 0.02, front));

  // Wheels: tyre, axis along x, and a rim disc on the outer face.
  const R = spec.wheelR;
  const tyre = new THREE.CylinderGeometry(R, R, 0.22, 12, 1);
  tyre.rotateZ(Math.PI / 2);
  const axles = [r - spec.frontAxle, f + spec.rearAxle];
  for (const z of axles) {
    for (const side of [-1, 1]) {
      const x = side * (W / 2 - 0.13);
      b.add(tyre.clone(), TYRE, PLAIN, at(x, R, z));
      const rim = new THREE.CircleGeometry(R * 0.6, 8);
      rim.rotateY(side * Math.PI / 2);
      b.add(rim, RIM, PLAIN, at(x + side * 0.115, R, z));
    }
  }
  tyre.dispose();
  return b.build();
}

// Shared by every vehicle material: night lights.
const vehicleUniforms = { uTrafficNight: { value: 0 } };
export function setVehicleNight(night) {
  vehicleUniforms.uTrafficNight.value = night ? 1 : 0;
}

export function createVehicleMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTrafficNight = vehicleUniforms.uTrafficNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aCarMat;\nvarying vec3 vCarMat;')
      .replace('#include <color_vertex>', [
        'vColor = vec3(1.0);',
        '#ifdef USE_COLOR',
        'vColor *= color;',
        '#endif',
        '#ifdef USE_INSTANCING_COLOR',
        'vColor = mix(vColor, vColor * instanceColor.rgb, aCarMat.x);',
        '#endif',
        'vCarMat = aCarMat;'
      ].join('\n'));
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTrafficNight;\nvarying vec3 vCarMat;')
      // Clear-coated paint, glossy glass, matt rubber and plastic.
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(mix(roughnessFactor, 0.28, vCarMat.x), 0.06, vCarMat.y);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.45, vCarMat.x * (1.0 - vCarMat.y));')
      .replace('#include <emissivemap_fragment>', [
        '#include <emissivemap_fragment>',
        'float carHead = step(0.5, vCarMat.z) * step(vCarMat.z, 1.5);',
        'float carTail = step(1.5, vCarMat.z);',
        'totalEmissiveRadiance += uTrafficNight * (carHead * vec3(6.0, 5.6, 4.6) + carTail * vec3(3.5, 0.15, 0.08));'
      ].join('\n'));
  };
  mat.customProgramCacheKey = () => 'planx-vehicle';
  return mat;
}

// --- people ------------------------------------------------------------------

// Body parts (aPerson.x): 0 skin, 1 shirt, 2 trousers/skirt, 3 shoes (own
// colour), 4 hair. Limbs (aPerson.y): 0 none, 1 left arm, 2 right arm,
// 3 left leg, 4 right leg.
const SHOULDER_Y = 1.43;
const HIP_Y = 0.93;

/**
 * Merged person geometry, about 1.75 m tall, facing +Z.
 * @param {'trousers' | 'skirt'} outfit
 */
export function createPersonGeometry(outfit = 'trousers') {
  const b = new PartBuilder('aPerson', 2);
  const limbY = (len, top) => top - len / 2;
  const cyl = (rt, rb, h, seg = 6, open = false) => new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const legPart = outfit === 'skirt' ? 0 : 2;
  for (const [side, limb] of [[-1, 3], [1, 4]]) {
    const x = side * 0.095;
    // Thigh and shin as one tapered leg; skirt legs show skin below the hem.
    b.add(cyl(0.075, 0.05, HIP_Y - 0.08, 6, true), 0xffffff, [legPart, limb], at(x, limbY(HIP_Y - 0.08, HIP_Y), 0));
    const shoe = new THREE.BoxGeometry(0.1, 0.08, 0.25);
    b.add(shoe, 0x1d1d22, [3, limb], at(x, 0.04, 0.035));
  }
  // Hips, torso (flattened, wider at the shoulders), neck, head and hair.
  b.add(cyl(0.165, 0.15, 0.16, 8), 0xffffff, [2, 0], at(0, HIP_Y + 0.02, 0).multiply(m4().makeScale(1, 1, 0.66)));
  b.add(cyl(0.2, 0.165, 0.5, 8), 0xffffff, [1, 0], at(0, HIP_Y + 0.33, 0).multiply(m4().makeScale(1, 1, 0.6)));
  b.add(cyl(0.12, 0.2, 0.06, 8), 0xffffff, [1, 0], at(0, SHOULDER_Y + 0.04, 0).multiply(m4().makeScale(1, 1, 0.6)));
  if (outfit === 'skirt') {
    b.add(cyl(0.17, 0.27, 0.46, 9), 0xffffff, [2, 0], at(0, HIP_Y - 0.2, 0).multiply(m4().makeScale(1, 1, 0.8)));
  }
  b.add(cyl(0.05, 0.055, 0.1, 6), 0xffffff, [0, 0], at(0, SHOULDER_Y + 0.11, 0));
  b.add(new THREE.SphereGeometry(0.105, 8, 6), 0xffffff, [0, 0], at(0, 1.63, 0.005).multiply(m4().makeScale(0.92, 1.12, 1)));
  const hair = new THREE.SphereGeometry(0.113, 8, 4, 0, Math.PI * 2, 0, Math.PI * (outfit === 'skirt' ? 0.62 : 0.5));
  b.add(hair, 0xffffff, [4, 0], at(0, 1.645, -0.01).multiply(m4().makeScale(0.95, 1.1, 1.05)));
  if (outfit === 'skirt') {
    // Longer hair at the back.
    b.add(new THREE.BoxGeometry(0.2, 0.2, 0.06), 0xffffff, [4, 0], at(0, 1.55, -0.08));
  }
  for (const [side, limb] of [[-1, 1], [1, 2]]) {
    const x = side * 0.235;
    // Sleeve, then forearm and hand.
    b.add(cyl(0.052, 0.046, 0.3, 5, true), 0xffffff, [1, limb], at(x, limbY(0.3, SHOULDER_Y), 0));
    b.add(cyl(0.042, 0.036, 0.27, 5), 0xffffff, [0, limb], at(x, limbY(0.27, SHOULDER_Y - 0.29), 0.01));
  }
  return b.build();
}

const personUniforms = { uPedTime: { value: 0 } };
export function setPeopleTime(seconds) {
  personUniforms.uPedTime.value = seconds;
}

export function createPersonMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPedTime = personUniforms.uPedTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', [
        '#include <common>',
        'attribute vec2 aPerson;',
        'attribute vec4 iWalk;', // phase, angular frequency, swing, bob
        'attribute vec3 iSkin;',
        'attribute vec3 iShirt;',
        'attribute vec3 iPants;',
        'attribute vec3 iHair;',
        'uniform float uPedTime;',
        'float pedCycle() { return uPedTime * iWalk.y + iWalk.x; }',
        'float pedAngle() {',
        '  float sw = sin(pedCycle()) * iWalk.z;',
        '  float limb = aPerson.y;',
        '  return limb < 0.5 ? 0.0 : limb < 1.5 ? -sw : limb < 2.5 ? sw : limb < 3.5 ? sw * 0.75 : -sw * 0.75;',
        '}',
        `float pedPivot() { return aPerson.y < 2.5 ? ${SHOULDER_Y.toFixed(2)} : ${HIP_Y.toFixed(2)}; }`,
        'vec3 pedRotate(vec3 p, float a) { float c = cos(a); float s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }'
      ].join('\n'))
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = pedRotate(objectNormal, pedAngle());')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        'float pedPv = pedPivot();',
        'transformed.y -= pedPv;',
        'transformed = pedRotate(transformed, pedAngle());',
        'transformed.y += pedPv + iWalk.w * (1.0 - abs(sin(pedCycle())));'
      ].join('\n'))
      .replace('#include <color_vertex>', [
        'vColor = vec3(1.0);',
        '#ifdef USE_COLOR',
        'vColor *= color;',
        '#endif',
        'float pedPart = aPerson.x;',
        'vColor *= pedPart < 0.5 ? iSkin : pedPart < 1.5 ? iShirt : pedPart < 2.5 ? iPants : pedPart < 3.5 ? vec3(1.0) : iHair;'
      ].join('\n'));
  };
  mat.customProgramCacheKey = () => 'planx-person';
  return mat;
}

// --- contact shadows ---------------------------------------------------------

let blobTexture = null;
// Soft dark ellipse under cars and people: the sun shadow map is not
// re-rendered every frame, so moving things get a contact shadow instead.
export function createBlobShadowMaterial(opacity = 0.55) {
  if (!blobTexture) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 31);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    blobTexture = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: blobTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8
  });
}

export function createBlobShadowGeometry() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

// Headlight pools on the road ahead of each car at night.
let poolTexture = null;
export function createHeadlightPoolMaterial() {
  if (!poolTexture) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext('2d');
    // Brightest next to the car (the plane's -z end, canvas top).
    const g = ctx.createRadialGradient(32, 20, 2, 32, 46, 30);
    g.addColorStop(0, 'rgba(255,245,215,0.9)');
    g.addColorStop(0.5, 'rgba(255,240,200,0.35)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 128);
    poolTexture = new THREE.CanvasTexture(c);
    poolTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshBasicMaterial({
    map: poolTexture,
    transparent: true,
    opacity: 0.4,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -9,
    polygonOffsetUnits: -9
  });
}
