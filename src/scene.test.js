import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// Mock WebGLRenderer — scene.js needs it but we only inspect returned objects
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        this.shadowMap = {};
      }
      setSize() {}
      setPixelRatio() {}
    },
  };
});

// scene.js reads window.innerWidth etc — provide them
globalThis.window = globalThis;
globalThis.innerWidth = 800;
globalThis.innerHeight = 600;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};

const { createScene } = await import('./scene.js');

// Minimal canvas mock for OrbitControls
const canvas = {
  style: {},
  addEventListener() {},
  removeEventListener() {},
  getRootNode() { return { addEventListener() {}, removeEventListener() {} }; },
  clientWidth: 800,
  clientHeight: 600,
  getContext() { return null; },
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
  ownerDocument: { addEventListener() {}, removeEventListener() {}, pointerLockElement: null },
  setPointerCapture() {},
  releasePointerCapture() {},
};

const { camera, controls, scene } = createScene(canvas);

describe('scene boundaries match cm-scale data', () => {
  it('camera near plane >= 1 cm', () => {
    expect(camera.near).toBeGreaterThanOrEqual(1);
  });

  it('camera far plane >= 10000 cm', () => {
    expect(camera.far).toBeGreaterThanOrEqual(10000);
  });

  it('camera position is cm-scale (components > 10)', () => {
    const pos = camera.position;
    const maxComponent = Math.max(Math.abs(pos.x), Math.abs(pos.y), Math.abs(pos.z));
    expect(maxComponent).toBeGreaterThan(10);
  });

  it('controls target y is cm-scale (> 10)', () => {
    expect(controls.target.y).toBeGreaterThan(10);
  });

  it('ground plane size >= 100 cm', () => {
    let groundGeometry = null;
    scene.traverse((child) => {
      if (child.isMesh && child.geometry?.type === 'PlaneGeometry') {
        groundGeometry = child.geometry;
      }
    });
    expect(groundGeometry).not.toBeNull();
    const width = groundGeometry.parameters.width;
    const height = groundGeometry.parameters.height;
    expect(width).toBeGreaterThanOrEqual(100);
    expect(height).toBeGreaterThanOrEqual(100);
  });
});
