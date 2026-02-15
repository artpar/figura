import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFaceCamera } from './faceCamera.js';

// Build a minimal bone chain: root → head
function makeHeadBone(position, quaternion) {
  const root = new THREE.Bone();
  root.position.set(0, 0, 0);

  const head = new THREE.Bone();
  head.position.copy(position);
  if (quaternion) head.quaternion.copy(quaternion);

  root.add(head);
  root.updateMatrixWorld(true);

  return head;
}

describe('faceCamera', () => {
  it('returns camera, update, and zoom', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const fc = createFaceCamera(head);

    expect(fc.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(typeof fc.update).toBe('function');
    expect(typeof fc.zoom).toBe('function');
  });

  it('camera is cm-scale (near=1, far=5000)', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const { camera } = createFaceCamera(head);

    expect(camera.near).toBe(1);
    expect(camera.far).toBe(5000);
    expect(camera.fov).toBe(50);
  });

  it('places camera in front of face after update (identity rotation → +Z forward)', () => {
    const headPos = new THREE.Vector3(0, 160, 0);
    const head = makeHeadBone(headPos);
    const { camera, update } = createFaceCamera(head);

    update();

    // With identity quaternion, face forward is +Z, so camera should be at z = +440
    expect(camera.position.x).toBeCloseTo(0, 1);
    expect(camera.position.y).toBeCloseTo(160, 1);
    expect(camera.position.z).toBeCloseTo(440, 1);
  });

  it('camera follows head when bone moves', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const { camera, update } = createFaceCamera(head);

    update();
    const z1 = camera.position.z;

    // Move head
    head.position.set(10, 170, 5);
    head.parent.updateMatrixWorld(true);

    update();

    expect(camera.position.x).toBeCloseTo(10, 1);
    expect(camera.position.y).toBeCloseTo(170, 1);
    expect(camera.position.z).toBeCloseTo(445, 1);
  });

  it('camera follows head rotation', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const { camera, update } = createFaceCamera(head);

    // Rotate head 90 degrees around Y → face points to +X
    head.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    head.parent.updateMatrixWorld(true);

    update();

    // Camera should be 440cm in the +X direction
    expect(camera.position.x).toBeCloseTo(440, 1);
    expect(camera.position.y).toBeCloseTo(160, 1);
    expect(camera.position.z).toBeCloseTo(0, 1);
  });

  it('zoom adjusts camera distance', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const { camera, update, zoom } = createFaceCamera(head);

    update();
    const initialZ = camera.position.z;

    // Zoom out (positive deltaY)
    zoom(100);
    update();
    expect(camera.position.z).toBeGreaterThan(initialZ);

    // Zoom in (negative deltaY)
    zoom(-200);
    update();
    expect(camera.position.z).toBeLessThan(initialZ);
  });

  it('zoom clamps to min/max distance', () => {
    const head = makeHeadBone(new THREE.Vector3(0, 160, 0));
    const { camera, update, zoom } = createFaceCamera(head);

    // Zoom way in
    for (let i = 0; i < 50; i++) zoom(-500);
    update();
    expect(camera.position.z).toBeGreaterThanOrEqual(40);

    // Zoom way out
    for (let i = 0; i < 50; i++) zoom(500);
    update();
    expect(camera.position.z).toBeLessThanOrEqual(500);
  });
});
