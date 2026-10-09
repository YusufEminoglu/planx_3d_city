// @ts-check
// Wind sway for instanced tree crowns: a vertex-shader bend that grows with
// height inside the crown, phased per tree so a street of trees does not move
// in lockstep. It only animates while frames are being drawn (the viewer
// keeps drawing while the wind setting is on), and shadows stay static, so a
// still view costs nothing extra.
import * as THREE from 'three';

const uniforms = {
  uWindTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.7, 0.7) },
  uWindStrength: { value: 0 }
};

/** Bend crowns of this (instanced) material with the shared wind. */
export function applyWindSway(material) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (previous) previous(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform float uWindTime;',
        'uniform vec2 uWindDir;',
        'uniform float uWindStrength;'
      ].join('\n'))
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        'if (uWindStrength > 0.0) {',
        // Crown geometry spans about -1..1 in y: the top moves, the base holds.
        '  float planxBend = clamp(transformed.y * 0.5 + 0.5, 0.0, 1.0);',
        '  planxBend *= planxBend;',
        '  vec2 planxRoot = instanceMatrix[3].xz;',
        '  float planxPhase = dot(planxRoot, vec2(0.071, 0.113));',
        '  float planxGust = sin(uWindTime * 1.3 + planxPhase) * 0.7 + sin(uWindTime * 2.9 + planxPhase * 1.7) * 0.3;',
        // Displacement in instance space, divided back by the instance scale
        // so every crown bends by the same share of its size.
        '  vec3 planxScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));',
        '  vec3 planxPush = vec3(uWindDir.x, 0.0, uWindDir.y) * (0.6 + 0.4 * planxGust) * uWindStrength * planxBend;',
        '  mat3 planxRot = mat3(instanceMatrix[0].xyz / planxScale.x, instanceMatrix[1].xyz / planxScale.y, instanceMatrix[2].xyz / planxScale.z);',
        '  transformed += (transpose(planxRot) * planxPush) * planxScale.y / planxScale;',
        '}',
        '#endif'
      ].join('\n'));
  };
  material.customProgramCacheKey = () => `planx-wind-${material.type}-${material.map ? 1 : 0}`;
  material.needsUpdate = true;
  return material;
}

/**
 * @param strength 0 = still; ~0.08 is a breeze (share of crown height)
 * @param dirX, dirZ horizontal direction the wind blows towards, in scene
 *        axes (as the viewer's wind plumes use it)
 */
export function setWind(strength, dirX, dirZ) {
  uniforms.uWindStrength.value = strength;
  uniforms.uWindDir.value.set(dirX, dirZ).normalize();
}

export function updateWind(seconds) {
  uniforms.uWindTime.value = seconds;
}

export function windActive() {
  return uniforms.uWindStrength.value > 0;
}
