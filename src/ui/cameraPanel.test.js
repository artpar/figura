// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCameraPanel } from './cameraPanel.js';

function mockCamera() {
  let preset = null;
  return {
    setPreset: vi.fn((name) => { preset = name; }),
    getPreset: vi.fn(() => preset),
    getAzimuth: vi.fn(() => Math.PI),
    setAzimuth: vi.fn(),
    update: vi.fn(),
  };
}

function findBtn(preset) {
  return document.querySelector(`.figura-viewctl-btn[data-preset="${preset}"]`);
}

describe('createCameraPanel (view control)', () => {
  let camera;
  let panel;

  beforeEach(() => {
    camera = mockCamera();
  });

  afterEach(() => {
    if (panel) panel.dispose();
  });

  it('appends view control to document.body', () => {
    panel = createCameraPanel(camera);
    expect(document.querySelector('.figura-viewctl')).not.toBeNull();
  });

  it('creates 4 direction buttons and a center button', () => {
    panel = createCameraPanel(camera);
    const buttons = document.querySelectorAll('.figura-viewctl-btn');
    const center = document.querySelector('.figura-viewctl-center');
    expect(buttons.length).toBe(4);
    expect(center).not.toBeNull();
  });

  it('clicking a direction button calls camera.setPreset()', () => {
    panel = createCameraPanel(camera);
    findBtn('side').click();
    expect(camera.setPreset).toHaveBeenCalledWith('side');
  });

  it('clicking center calls camera.setPreset("close")', () => {
    panel = createCameraPanel(camera);
    document.querySelector('.figura-viewctl-center').click();
    expect(camera.setPreset).toHaveBeenCalledWith('close');
  });

  it('update() highlights the active preset button', () => {
    panel = createCameraPanel(camera);

    camera.getPreset.mockReturnValue('front');
    panel.update();
    expect(findBtn('front').classList.contains('active')).toBe(true);
    expect(findBtn('back').classList.contains('active')).toBe(false);
  });

  it('update() clears highlights when no preset is active', () => {
    panel = createCameraPanel(camera);

    camera.getPreset.mockReturnValue('side');
    panel.update();
    expect(findBtn('side').classList.contains('active')).toBe(true);

    camera.getPreset.mockReturnValue(null);
    panel.update();
    const buttons = document.querySelectorAll('.figura-viewctl-btn');
    for (const btn of buttons) {
      expect(btn.classList.contains('active')).toBe(false);
    }
  });

  it('dispose() removes the widget from DOM', () => {
    panel = createCameraPanel(camera);
    expect(document.querySelector('.figura-viewctl')).not.toBeNull();
    panel.dispose();
    expect(document.querySelector('.figura-viewctl')).toBeNull();
    panel = null;
  });
});
