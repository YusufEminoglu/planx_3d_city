// @ts-check
// WebXR: walk the city in a VR headset (Quest browser, desktop VR).
//
// The "Enter VR" button only appears when the browser supports immersive VR.
// On entering, the camera is put in a rig standing at street level under the
// current view, facing the same way; pointing a controller at the ground and
// pulling the trigger teleports there. Leaving VR restores the previous view.
// The headset frame is drawn without the post-processing composite.
import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';

/**
 * @param renderer, scene, camera
 * @param standAt()        -> { position: Vector3, heading: radians } at entry
 * @param groundTargets()  -> objects teleport rays may hit
 * @param drawFrame()      -> renders one headset frame
 * @param onStart(), onEnd() -> pause / resume the normal loop and restore
 * @returns null when immersive VR is not available
 */
export async function setupXR({ renderer, scene, camera, standAt, groundTargets, drawFrame, onStart, onEnd }) {
  // WebXR typings are not in the DOM lib.
  const xr = typeof navigator === 'undefined' ? null : /** @type {any} */ (navigator).xr;
  if (!xr) return null;
  let supported = false;
  try {
    supported = await xr.isSessionSupported('immersive-vr');
  } catch {
    supported = false;
  }
  if (!supported) return null;

  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  const rig = new THREE.Group();
  rig.name = 'planx-xr-rig';
  scene.add(rig);

  const raycaster = new THREE.Raycaster();
  const rotation = new THREE.Matrix4();
  const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  const rayMaterial = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
  const teleport = (controller) => {
    rotation.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    raycaster.far = 500;
    const hit = raycaster.intersectObjects(groundTargets(), true)[0];
    if (hit) rig.position.copy(hit.point);
  };
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener('select', () => teleport(controller));
    const ray = new THREE.Line(rayGeometry, rayMaterial);
    ray.scale.z = 30;
    controller.add(ray);
    rig.add(controller);
  }

  let saved = null;
  renderer.xr.addEventListener('sessionstart', () => {
    saved = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), parent: camera.parent };
    onStart();
    const { position, heading } = standAt();
    rig.position.copy(position);
    rig.rotation.set(0, heading, 0);
    rig.add(camera);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    renderer.setAnimationLoop(drawFrame);
  });
  renderer.xr.addEventListener('sessionend', () => {
    renderer.setAnimationLoop(null);
    rig.remove(camera);
    if (saved?.parent) saved.parent.add(camera);
    if (saved) {
      camera.position.copy(saved.position);
      camera.quaternion.copy(saved.quaternion);
    }
    onEnd();
  });

  const button = VRButton.createButton(renderer);
  button.id = 'planx-vr-button';
  document.body.appendChild(button);
  return { rig, button };
}
