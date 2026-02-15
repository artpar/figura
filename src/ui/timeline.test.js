// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTimeline, computeWaveforms } from './timeline.js';

function mockPlayback() {
  let playing = true;
  let speed = 1;
  let time = 0;
  const duration = 10;

  return {
    play: vi.fn(() => { playing = true; }),
    pause: vi.fn(() => { playing = false; }),
    isPlaying: vi.fn(() => playing),
    setSpeed: vi.fn((n) => { speed = n; }),
    getSpeed: vi.fn(() => speed),
    getTime: vi.fn(() => time),
    setTime: vi.fn((t) => { time = t; }),
    getDuration: vi.fn(() => duration),
    update: vi.fn(),
  };
}

describe('computeWaveforms', () => {
  it('returns empty arrays for single keyframe', () => {
    const parsed = { duration: 0, keyframes: [{ time: 0, bones: {} }] };
    const result = computeWaveforms(parsed);
    expect(result).toHaveLength(5);
    expect(result.every(w => w.length === 0)).toBe(true);
  });

  it('computes normalized waveforms for rotation deltas', () => {
    const parsed = {
      duration: 0.1,
      keyframes: [
        { time: 0, bones: { hip: { rot: [0, 0, 0] }, abdomen: { rot: [0, 0, 0] } } },
        { time: 0.033, bones: { hip: { rot: [10, 0, 0] }, abdomen: { rot: [5, 0, 0] } } },
        { time: 0.066, bones: { hip: { rot: [30, 0, 0] }, abdomen: { rot: [15, 0, 0] } } },
      ],
    };
    const result = computeWaveforms(parsed);
    // Spine group is index 0 (hip + abdomen are both in Spine)
    const spine = result[0];
    expect(spine).toHaveLength(3);
    expect(spine[0]).toBe(0); // First frame always 0
    expect(spine[2]).toBe(1); // Largest delta normalized to 1
    expect(spine[1]).toBeLessThan(spine[2]); // First delta smaller
  });

  it('produces zeros for groups with no matching bones', () => {
    const parsed = {
      duration: 0.1,
      keyframes: [
        { time: 0, bones: { hip: { rot: [0, 0, 0] } } },
        { time: 0.033, bones: { hip: { rot: [10, 5, 3] } } },
      ],
    };
    const result = computeWaveforms(parsed);
    // L Arm (index 1) has no bones in this data
    const lArm = result[1];
    expect(lArm.every(v => v === 0)).toBe(true);
  });
});

describe('createTimeline', () => {
  let container;
  let playback;

  beforeEach(() => {
    container = document.createElement('div');
    playback = mockPlayback();
  });

  it('creates transport and canvas in container', () => {
    createTimeline(playback, container);
    expect(container.querySelector('.figura-transport')).not.toBeNull();
    expect(container.querySelector('.figura-timeline-canvas')).not.toBeNull();
  });

  it('creates transport buttons and controls', () => {
    createTimeline(playback, container);
    expect(container.querySelector('.figura-transport-btn')).not.toBeNull();
    expect(container.querySelector('.figura-transport-time')).not.toBeNull();
    expect(container.querySelector('.figura-transport-speed')).not.toBeNull();
  });

  it('play/pause button calls playback.pause() when playing', () => {
    createTimeline(playback, container);
    const btn = container.querySelector('.figura-transport-btn');
    btn.click();
    expect(playback.pause).toHaveBeenCalled();
  });

  it('play/pause button calls playback.play() when paused', () => {
    createTimeline(playback, container);
    const btn = container.querySelector('.figura-transport-btn');
    btn.click(); // pause
    btn.click(); // play
    expect(playback.play).toHaveBeenCalled();
  });

  it('speed select calls playback.setSpeed()', () => {
    createTimeline(playback, container);
    const select = container.querySelector('.figura-transport-speed');
    select.value = '0.5';
    select.dispatchEvent(new Event('change'));
    expect(playback.setSpeed).toHaveBeenCalledWith(0.5);
  });

  it('scrub via pointerdown on canvas calls playback.setTime()', () => {
    createTimeline(playback, container);
    const canvas = container.querySelector('.figura-timeline-canvas');
    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 });
    // Mock setPointerCapture
    canvas.setPointerCapture = vi.fn();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 130, pointerId: 1 }));
    expect(playback.setTime).toHaveBeenCalled();
  });

  it('update() does not throw (canvas drawing guarded)', () => {
    const tl = createTimeline(playback, container);
    expect(() => tl.update()).not.toThrow();
  });

  it('setKeyframes() accepts parsed data without error', () => {
    const tl = createTimeline(playback, container);
    const parsed = {
      duration: 1,
      keyframes: [
        { time: 0, bones: { hip: { rot: [0, 0, 0] } } },
        { time: 0.5, bones: { hip: { rot: [10, 5, 3] } } },
      ],
    };
    expect(() => tl.setKeyframes(parsed)).not.toThrow();
  });

  it('dispose() removes all elements from container', () => {
    const tl = createTimeline(playback, container);
    expect(container.children.length).toBeGreaterThan(0);
    tl.dispose();
    expect(container.children.length).toBe(0);
  });
});
