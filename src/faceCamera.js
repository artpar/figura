import * as THREE from 'three';

// Local-space vector pointing out of the face.
// Mixamo head bone: +Z is face-forward in local space.
// Adjust empirically if the GLB skeleton differs.
const FACE_FORWARD_LOCAL = new THREE.Vector3(0, 0, 1);

const DEFAULT_DISTANCE = 140;  // cm in front of face
const MIN_DISTANCE      = 40;
const MAX_DISTANCE      = 500;
const EYE_OFFSET_Y      = 5;   // cm above head center for eye level

const _headPos   = new THREE.Vector3();
const _headQuat  = new THREE.Quaternion();
const _forward   = new THREE.Vector3();
const _eyeTarget = new THREE.Vector3();

export function createFaceCamera(headBone) {
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  let distance = DEFAULT_DISTANCE;

  function update() {
    headBone.updateWorldMatrix(true, false);
    headBone.getWorldPosition(_headPos);
    headBone.getWorldQuaternion(_headQuat);

    // Face-forward direction in world space
    _forward.copy(FACE_FORWARD_LOCAL).applyQuaternion(_headQuat).normalize();

    // Place camera in front of face
    camera.position.copy(_headPos).addScaledVector(_forward, distance);

    // Look at eye level (slightly above head center)
    _eyeTarget.copy(_headPos);
    _eyeTarget.y += EYE_OFFSET_Y;
    camera.lookAt(_eyeTarget);
  }

  function zoom(deltaY) {
    distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, distance * (1 + deltaY * 0.001)));
  }

  return { camera, update, zoom };
}
