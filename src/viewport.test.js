import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createViewport } from './viewport.js';

// Minimal DOM stubs
globalThis.window = globalThis;
globalThis.innerWidth = 1000;
globalThis.innerHeight = 600;
globalThis.addEventListener = vi.fn();
globalThis.removeEventListener = vi.fn();

// ResizeObserver stub
globalThis.ResizeObserver = class {
  constructor(cb) { this._cb = cb; }
  observe() {}
  disconnect() {}
};

function makeRenderer() {
  return {
    setSize: vi.fn(),
    setViewport: vi.fn(),
    setScissor: vi.fn(),
    setScissorTest: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
    autoClear: true,
  };
}

function makeCamera() {
  return {
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
  };
}

function makeCanvas(container) {
  const listeners = {};
  return {
    parentElement: container,
    addEventListener: vi.fn((evt, fn, opts) => { listeners[evt] = fn; }),
    removeEventListener: vi.fn(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    _listeners: listeners,
  };
}

function makeContainer() {
  const children = [];
  return {
    clientWidth: 1000,
    clientHeight: 600,
    appendChild(el) { children.push(el); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
    _children: children,
  };
}

function makeControls() {
  return { enabled: true };
}

const elements = [];
globalThis.document = {
  createElement(tag) {
    const listeners = {};
    const el = {
      style: { cssText: '', top: '', left: '' },
      remove: vi.fn(),
      addEventListener: vi.fn((evt, fn) => { listeners[evt] = fn; }),
      _listeners: listeners,
    };
    elements.push(el);
    return el;
  },
  body: { appendChild: vi.fn() },
};

const scene = {};

describe('viewport', () => {
  let renderer, cam0, cam1, canvas, container, controls;

  beforeEach(() => {
    elements.length = 0;
    renderer = makeRenderer();
    cam0 = makeCamera();
    cam1 = makeCamera();
    container = makeContainer();
    canvas = makeCanvas(container);
    controls = makeControls();
  });

  it('creates two separator divs in the container', () => {
    createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);
    expect(elements.length).toBe(2);
    expect(container._children.length).toBe(2);
  });

  it('sets aspect ratios from container dimensions', () => {
    createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);

    const halfW = Math.floor(1000 / 2);
    const halfH = Math.floor(600 / 2);

    expect(cam0.aspect).toBeCloseTo(halfW / halfH, 3);
    expect(cam1.aspect).toBeCloseTo(halfW / halfH, 3);
  });

  it('render() calls setViewport/setScissor for each non-null camera', () => {
    const vp = createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);
    vp.render();

    const halfW = 500;
    const halfH = 300;

    expect(renderer.setScissorTest).toHaveBeenCalledWith(true);
    expect(renderer.clear).toHaveBeenCalled();

    expect(renderer.setViewport).toHaveBeenCalledWith(0, halfH, halfW, halfH);
    expect(renderer.setScissor).toHaveBeenCalledWith(0, halfH, halfW, halfH);

    expect(renderer.setViewport).toHaveBeenCalledWith(halfW, halfH, halfW, halfH);
    expect(renderer.setScissor).toHaveBeenCalledWith(halfW, halfH, halfW, halfH);

    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(false);
  });

  it('disables controls when pointer is outside top-left quadrant', () => {
    createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);

    const pointerDown = canvas._listeners['pointerdown'];

    // Click in top-right (x > 500)
    pointerDown({ clientX: 700, clientY: 100 });
    expect(controls.enabled).toBe(false);

    canvas._listeners['pointerup']({});
    expect(controls.enabled).toBe(true);

    // Click in bottom-left (y > 300)
    pointerDown({ clientX: 100, clientY: 400 });
    expect(controls.enabled).toBe(false);
  });

  it('keeps controls enabled when pointer is in top-left quadrant', () => {
    createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);
    canvas._listeners['pointerdown']({ clientX: 200, clientY: 100 });
    expect(controls.enabled).toBe(true);
  });

  it('routes wheel events to onWheel callbacks by quadrant', () => {
    const wheelFn = vi.fn();
    createViewport(
      renderer, canvas, [cam0, cam1, null, null], scene, controls,
      [null, wheelFn, null, null]
    );

    const wheelHandler = canvas._listeners['wheel'];
    expect(wheelHandler).toBeDefined();

    // Scroll in top-right quadrant (index 1)
    wheelHandler({ clientX: 700, clientY: 100, deltaY: 100, preventDefault: vi.fn() });
    expect(wheelFn).toHaveBeenCalledWith(100);
  });

  it('does not call onWheel for quadrants with null handler', () => {
    const wheelFn = vi.fn();
    createViewport(
      renderer, canvas, [cam0, cam1, null, null], scene, controls,
      [null, wheelFn, null, null]
    );

    const wheelHandler = canvas._listeners['wheel'];
    // Scroll in top-left quadrant (index 0) — no handler
    wheelHandler({ clientX: 200, clientY: 100, deltaY: 100, preventDefault: vi.fn() });
    expect(wheelFn).not.toHaveBeenCalled();
  });

  it('dispose cleans up all listeners and DOM', () => {
    const vp = createViewport(renderer, canvas, [cam0, cam1, null, null], scene, controls);
    vp.dispose();

    expect(canvas.removeEventListener).toHaveBeenCalledTimes(3); // pointerdown, pointerup, wheel
    expect(globalThis.removeEventListener).toHaveBeenCalled();
    expect(elements[0].remove).toHaveBeenCalled();
    expect(elements[1].remove).toHaveBeenCalled();
  });
});
