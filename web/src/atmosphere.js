// Atmosphere: a visible physical sky, sky-based image lighting (IBL) and fog
// that matches the horizon.
//
// 'Cinematic' draws the Sky shader inside the camera range and lights the
// scene with a PMREM environment baked from the same sky, so fill light and
// reflections follow the time of day (re-baked only when the sun has moved
// noticeably). The sky tone-maps itself (exposure + ACES in its own shader):
// tone mapping the whole frame washed out the city's colours. 'Clean' keeps
// the original flat presentation background and no environment lighting.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

const SKY_PARAMS = { turbidity: 6, rayleigh: 1.4, mieCoefficient: 0.004, mieDirectionalG: 0.78 };
const CLEAN_BACKGROUND = 0xcee4ef;
const REBAKE_ANGLE = THREE.MathUtils.degToRad(1.5);
// Share of the sky environment in material lighting: the full sky radiance
// flattens contrast, the sun should still model the forms.
const ENV_INTENSITY = 0.32;

export function createAtmosphere({ renderer, scene, sky, ambient }) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(100);
  envScene.add(envSky);
  for (const s of [sky, envSky]) {
    for (const [k, v] of Object.entries(SKY_PARAMS)) s.material.uniforms[k].value = v;
  }
  const skyExposure = { value: 0.5 };
  // Both the visible sky and the one baked into the environment use the same
  // exposure and tone curve, so the fill light matches the sky you see.
  const patchSky = (shader) => {
    shader.uniforms.uSkyExposure = skyExposure;
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uSkyExposure;\nvoid main() {')
      .replace('gl_FragColor = vec4( retColor, 1.0 );', [
        'vec3 c = retColor * uSkyExposure;',
        // ACES filmic fit (Narkowicz): the sky's own tone curve.
        'c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);',
        'gl_FragColor = vec4( c, 1.0 );'
      ].join('\n'));
  };
  for (const s of [sky, envSky]) {
    s.material.onBeforeCompile = patchSky;
    s.material.customProgramCacheKey = () => 'planx-sky';
    s.material.needsUpdate = true;
  }
  let envTarget = null;
  let bakedExposure = null;
  const bakedSun = new THREE.Vector3(0, -2, 0);
  const fogColor = new THREE.Color();
  const cleanBackground = new THREE.Color(CLEAN_BACKGROUND);

  // Horizon tint for fog, from the sun elevation (deg): night, dusk, day.
  function horizonColor(elevationDeg, out) {
    const night = new THREE.Color(0x1a2230);
    const dusk = new THREE.Color(0xd9b48f);
    const day = new THREE.Color(0xbcd3e3);
    if (elevationDeg <= -6) return out.copy(night);
    if (elevationDeg < 4) return out.copy(night).lerp(dusk, (elevationDeg + 6) / 10);
    if (elevationDeg < 20) return out.copy(dusk).lerp(day, (elevationDeg - 4) / 16);
    return out.copy(day);
  }

  function bakeEnvironment(sunDirection) {
    envSky.material.uniforms.sunPosition.value.copy(sunDirection);
    const previous = envTarget;
    envTarget = pmrem.fromScene(envScene, 0, 0.1, 1000);
    scene.environment = envTarget.texture;
    if (previous) previous.dispose();
    bakedSun.copy(sunDirection);
  }

  return {
    /**
     * @param style 'Cinematic' | 'Clean'
     * @param sunDirection unit vector towards the sun
     * @param elevationDeg sun elevation in degrees
     * @returns true when the environment was re-baked
     */
    update(style, sunDirection, elevationDeg) {
      const isNight = elevationDeg < -3;
      if (style === 'Clean') {
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.toneMappingExposure = 1;
        sky.visible = false;
        scene.background = cleanBackground;
        scene.environment = null;
        if (scene.fog) scene.fog.color.copy(cleanBackground);
        ambient.intensity = isNight ? 0.2 : 0.62;
        return false;
      }
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
      // The sky's radiance drops by orders of magnitude at dusk and night.
      skyExposure.value = elevationDeg > 10 ? 0.45 : (elevationDeg > -3 ? 0.9 : 2.5);
      sky.visible = true;
      scene.background = null;
      sky.material.uniforms.sunPosition.value.copy(sunDirection);
      if (scene.fog) scene.fog.color.copy(horizonColor(elevationDeg, fogColor));
      // The environment carries part of the ambient light now.
      ambient.intensity = isNight ? 0.16 : 0.16;
      let rebaked = false;
      if (!envTarget || bakedSun.angleTo(sunDirection) > REBAKE_ANGLE || bakedExposure !== skyExposure.value) {
        bakedExposure = skyExposure.value;
        bakeEnvironment(sunDirection);
        rebaked = true;
      }
      return rebaked;
    },
    // r160 has no scene-wide environment intensity, so set it per material
    // (call after layers are (re)built).
    applyEnvironmentIntensity(root, style) {
      const k = style === 'Clean' ? 1 : ENV_INTENSITY;
      root.traverse((o) => {
        const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
        for (const m of mats) {
          if (!('envMapIntensity' in m)) continue;
          // Materials can ask for more (water, glass) than the general share.
          const v = Math.min(1, k * (m.userData?.planxEnvBoost || 1));
          if (m.envMapIntensity !== v) m.envMapIntensity = v;
        }
      });
    },
    dispose() {
      if (envTarget) envTarget.dispose();
      pmrem.dispose();
    }
  };
}
