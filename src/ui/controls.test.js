// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createControls } from './controls.js';

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

describe('createControls', () => {
  let container;
  let playback;

  beforeEach(() => {
    container = document.createElement('div');
    playback = mockPlayback();
  });

  it('creates expected DOM elements in container', () => {
    createControls(playback, container);

    expect(container.querySelector('.figura-play-btn')).not.toBeNull();
    expect(container.querySelector('.figura-speed-slider')).not.toBeNull();
    expect(container.querySelector('.figura-scrubber')).not.toBeNull();
    expect(container.querySelector('.figura-speed-label')).not.toBeNull();
  });

  it('play/pause button calls playback.pause() when playing', () => {
    createControls(playback, container);
    const btn = container.querySelector('.figura-play-btn');
    btn.click();
    expect(playback.pause).toHaveBeenCalled();
  });

  it('play/pause button calls playback.play() when paused', () => {
    createControls(playback, container);
    const btn = container.querySelector('.figura-play-btn');
    btn.click(); // pause
    btn.click(); // play
    expect(playback.play).toHaveBeenCalled();
  });

  it('speed slider change calls playback.setSpeed()', () => {
    createControls(playback, container);
    const slider = container.querySelector('.figura-speed-slider');
    slider.value = '0.5';
    slider.dispatchEvent(new Event('input'));
    expect(playback.setSpeed).toHaveBeenCalledWith(0.5);
  });

  it('scrubber change calls playback.setTime()', () => {
    createControls(playback, container);
    const scrubber = container.querySelector('.figura-scrubber');
    scrubber.value = '5';
    scrubber.dispatchEvent(new Event('input'));
    expect(playback.setTime).toHaveBeenCalledWith(5);
  });

  it('update() syncs scrubber from playback.getTime()', () => {
    const ui = createControls(playback, container);
    const scrubber = container.querySelector('.figura-scrubber');

    playback.getTime.mockReturnValue(3.5);
    ui.update();

    expect(scrubber.value).toBe('3.5');
  });

  it('dispose() removes all child elements', () => {
    const ui = createControls(playback, container);
    expect(container.children.length).toBeGreaterThan(0);
    ui.dispose();
    expect(container.children.length).toBe(0);
  });
});
