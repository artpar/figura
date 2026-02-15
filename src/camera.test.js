import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createCamera, PRESETS } from './camera.js';

function mockControls(camera) {
  const target = new THREE.Vector3(0, 85, 0);
  const listeners = {};
  return {
    target,
    update: vi.fn(),
    addEventListener(event, fn) {
      listeners[event] = fn;
    },
    removeEventListener() {},
    // Helper to simulate user orbit
    _fireStart() { if (listeners.start) listeners.start(); },
  };
}

describe('createCamera', () => {
  it('setPreset sets camera to transition toward preset position', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 100, 300);
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    cam.setPreset('side');

    // Run several update cycles to converge
    for (let i = 0; i < 200; i++) cam.update();

    expect(camera.position.x).toBeCloseTo(500, 0);
    expect(camera.position.y).toBeCloseTo(350, 0);
    expect(camera.position.z).toBeCloseTo(0, 0);
  });

  it('all presets are in cm scale (values > 1)', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      const maxVal = Math.max(...preset.position.map(Math.abs));
      expect(maxVal).toBeGreaterThan(1);
    }
  });

  it('getPreset returns name after setPreset', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    cam.setPreset('top');
    expect(cam.getPreset()).toBe('top');
  });

  it('getPreset returns null after manual orbit', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    cam.setPreset('front');
    controls._fireStart();
    expect(cam.getPreset()).toBe(null);
  });

  it('update is a no-op when no preset is active', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(5, 10, 15);
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    cam.update();

    expect(camera.position.x).toBe(5);
    expect(camera.position.y).toBe(10);
    expect(camera.position.z).toBe(15);
  });

  it('getAzimuth returns theta from Spherical (atan2(x,z) relative to target)', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 100, -300); // front view
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    // offset = (0, 15, -300), theta = atan2(0, -300) = π
    expect(cam.getAzimuth()).toBeCloseTo(Math.PI, 5);

    camera.position.set(300, 100, 0); // side view
    // offset = (300, 15, 0), theta = atan2(300, 0) = π/2
    expect(cam.getAzimuth()).toBeCloseTo(Math.PI / 2, 2);
  });

  it('setAzimuth rotates camera around target preserving distance and elevation', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 100, -300); // front
    const controls = mockControls(camera);
    const cam = createCamera(camera, controls);

    const distBefore = camera.position.distanceTo(controls.target);

    cam.setAzimuth(Math.PI / 2); // rotate to side

    expect(camera.position.x).toBeGreaterThan(200);
    expect(camera.position.z).toBeCloseTo(0, 0);
    // Distance preserved
    const distAfter = camera.position.distanceTo(controls.target);
    expect(distAfter).toBeCloseTo(distBefore, 0);
  });
});
