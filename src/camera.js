import * as THREE from 'three';

export const PRESETS = {
  front: { position: [0, 350, -500], target: [0, 30, 0] },
  back:  { position: [0, 350, 500],  target: [0, 30, 0] },
  side:  { position: [500, 350, 0],  target: [0, 30, 0] },
  top:   { position: [0, 600, 1],    target: [0, 0, 0] },
  close: { position: [0, 220, -250], target: [0, 70, 0] },
};

const LERP_SPEED = 0.08;
const ARRIVE_THRESHOLD = 0.5;

const _offset = new THREE.Vector3();
const _spherical = new THREE.Spherical();

export function createCamera(camera, controls) {
  let currentPreset = null;
  const targetPos = new THREE.Vector3();
  const targetLookAt = new THREE.Vector3();
  let transitioning = false;

  controls.addEventListener('start', () => {
    currentPreset = null;
    transitioning = false;
  });

  return {
    setPreset(name) {
      const preset = PRESETS[name];
      if (!preset) return;
      currentPreset = name;
      targetPos.set(...preset.position);
      targetLookAt.set(...preset.target);
      transitioning = true;
    },

    getPreset() {
      return currentPreset;
    },

    getAzimuth() {
      _offset.subVectors(camera.position, controls.target);
      return Math.atan2(_offset.x, _offset.z);
    },

    setAzimuth(angle) {
      _offset.subVectors(camera.position, controls.target);
      _spherical.setFromVector3(_offset);
      _spherical.theta = angle;
      _spherical.makeSafe();
      _offset.setFromSpherical(_spherical);
      camera.position.copy(controls.target).add(_offset);
      controls.update();
      currentPreset = null;
      transitioning = false;
    },

    update() {
      if (!transitioning) return;

      camera.position.lerp(targetPos, LERP_SPEED);
      controls.target.lerp(targetLookAt, LERP_SPEED);
      controls.update();

      if (camera.position.distanceTo(targetPos) < ARRIVE_THRESHOLD &&
          controls.target.distanceTo(targetLookAt) < ARRIVE_THRESHOLD) {
        camera.position.copy(targetPos);
        controls.target.copy(targetLookAt);
        controls.update();
        transitioning = false;
      }
    },
  };
}
