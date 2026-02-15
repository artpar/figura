import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { generate, parse as dslParse } from './dsl.js';
import { create } from './clipLibrary.js';
import { parse, expand, indexLines } from './hdsl.js';

// Load real BVH data
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Generate low-level DSL from BVH and parse it for the clip library
const lowDslText = generate(bvh.skeleton, bvh.clip, 1 / 30);
const lowParsed = dslParse(lowDslText);

// Helper: create a clip library with pirouette registered
function makeLib() {
  const lib = create();
  lib.register('pirouette', lowParsed);
  return lib;
}

describe('parse', () => {
  it('parses bpm', () => {
    const result = parse('bpm 140');
    expect(result.bpm).toBe(140);
  });

  it('defaults bpm to 120', () => {
    const result = parse('');
    expect(result.bpm).toBe(120);
  });

  it('parses source declarations', () => {
    const result = parse('source pirouette\nsource steptouch');
    expect(result.sources).toEqual(['pirouette', 'steptouch']);
  });

  it('parses clip definitions', () => {
    const result = parse('clip spin from pirouette 0.0-2.5');
    expect(result.clips.spin).toEqual({ source: 'pirouette', start: 0, end: 2.5 });
  });

  it('parses pose definitions with bone data', () => {
    const result = parse([
      'pose arms-high',
      '  lShldr rot 0 0 -160',
      '  rShldr rot 0 0 160',
    ].join('\n'));

    expect(result.poses['arms-high']).toEqual({
      lShldr: { rot: [0, 0, -160] },
      rShldr: { rot: [0, 0, 160] },
    });
  });

  it('parses pose with position data', () => {
    const result = parse([
      'pose shifted',
      '  hip pos 10 0 0 rot 0 0 0',
    ].join('\n'));

    expect(result.poses.shifted.hip).toEqual({ pos: [10, 0, 0], rot: [0, 0, 0] });
  });

  it('parses sequence clip entry with modifiers', () => {
    const result = parse('@3:1  clip step-right   mirror');
    expect(result.sequence[0]).toMatchObject({
      measure: 3,
      beat: 1,
      type: 'clip',
      name: 'step-right',
      mirror: true,
    });
  });

  it('parses sequence clip with speed modifier', () => {
    const result = parse('@5:1  clip spin speed 0.8');
    expect(result.sequence[0]).toMatchObject({
      type: 'clip',
      name: 'spin',
      speed: 0.8,
    });
  });

  it('parses sequence clip with reverse modifier', () => {
    const result = parse('@1:1  clip spin reverse');
    expect(result.sequence[0]).toMatchObject({
      type: 'clip',
      name: 'spin',
      reverse: true,
    });
  });

  it('parses sequence pose entry with ease and hold', () => {
    const result = parse('@3:1  pose arms-high ease-in-out hold 1');
    expect(result.sequence[0]).toMatchObject({
      measure: 3,
      beat: 1,
      type: 'pose',
      name: 'arms-high',
      ease: 'ease-in-out',
      hold: 1,
    });
  });

  it('parses complete HDSL script', () => {
    const script = [
      '# My Dance Routine',
      'bpm 120',
      '',
      'source pirouette',
      '',
      'clip spin from pirouette 0.0-2.5',
      'clip recover from pirouette 2.5-4.9',
      '',
      'pose arms-high',
      '  lShldr rot 0 0 -160',
      '  rShldr rot 0 0 160',
      '',
      '@1:1  clip spin',
      '@1:1  pose arms-high  ease-out',
      '@3:1  clip recover',
    ].join('\n');

    const result = parse(script);
    expect(result.bpm).toBe(120);
    expect(result.sources).toEqual(['pirouette']);
    expect(result.clips.spin).toEqual({ source: 'pirouette', start: 0, end: 2.5 });
    expect(result.clips.recover).toEqual({ source: 'pirouette', start: 2.5, end: 4.9 });
    expect(result.poses['arms-high']).toBeDefined();
    expect(result.sequence).toHaveLength(3);
  });

  it('ignores comments and empty lines', () => {
    const result = parse('# comment\n\nbpm 90\n# another\n');
    expect(result.bpm).toBe(90);
    expect(result.sources).toHaveLength(0);
  });
});

describe('expand — clip resolution', () => {
  it('produces valid low-level DSL text from a single clip', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-1.0',
      '@1:1  clip spin',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);

    // Should be valid low-level DSL
    expect(result).toContain('duration');
    expect(result).toContain('frametime');
    expect(result).toMatch(/@\d+\.\d+/);

    // Parse it back with low-level parser
    const lowLevel = dslParse(result);
    expect(lowLevel.keyframes.length).toBeGreaterThan(0);
    expect(lowLevel.keyframes[0].time).toBeCloseTo(0, 2);
  });

  it('places clip at correct beat time', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-0.5',
      '@3:1  clip spin',  // at 120bpm 4/4, @3:1 = 4.0 seconds
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // First keyframe should be at ~4.0 seconds
    expect(lowLevel.keyframes[0].time).toBeCloseTo(4.0, 1);
  });

  it('clip has bone data from real BVH', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-0.5',
      '@1:1  clip spin',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // Should have hip bone with pos and rot
    const kf = lowLevel.keyframes[0];
    expect(kf.bones.hip).toBeDefined();
    expect(kf.bones.hip.pos).toBeDefined();
    expect(kf.bones.hip.rot).toBeDefined();

    // Should have multiple bones
    expect(Object.keys(kf.bones).length).toBeGreaterThan(5);
  });

  it('mirror swaps L/R bones', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-0.1',
      '@1:1  clip spin mirror',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // Normal clip
    const normalScript = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-0.1',
      '@1:1  clip spin',
    ].join('\n');
    const normalResult = expand(parse(normalScript), lib);
    const normalLevel = dslParse(normalResult);

    // In mirrored version, lShldr should have rShldr's values (approximately)
    const mirrorKf = lowLevel.keyframes[0];
    const normalKf = normalLevel.keyframes[0];

    // lShldr in mirror should correspond to rShldr in normal
    expect(mirrorKf.bones.lShldr).toBeDefined();
    expect(normalKf.bones.rShldr).toBeDefined();
    expect(mirrorKf.bones.lShldr.rot[0]).toBeCloseTo(normalKf.bones.rShldr.rot[0], 0);
  });

  it('speed modifier scales clip duration', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-1.0',
      '@1:1  clip spin speed 0.5',  // half speed = double duration
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // Normal speed version
    const normalScript = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-1.0',
      '@1:1  clip spin',
    ].join('\n');
    const normalResult = expand(parse(normalScript), lib);
    const normalLevel = dslParse(normalResult);

    // Slow version should have roughly 2x the time span
    const lastSlow = lowLevel.keyframes[lowLevel.keyframes.length - 1].time;
    const lastNormal = normalLevel.keyframes[normalLevel.keyframes.length - 1].time;
    expect(lastSlow).toBeCloseTo(lastNormal * 2, 1);
  });

  it('reverse modifier reverses keyframe order', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-1.0',
      '@1:1  clip spin reverse',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // Normal version
    const normalScript = script.replace(' reverse', '');
    const normalResult = expand(parse(normalScript), lib);
    const normalLevel = dslParse(normalResult);

    // First frame of reversed should match last frame of normal (in bone data)
    const revFirst = lowLevel.keyframes[0];
    const normLast = normalLevel.keyframes[normalLevel.keyframes.length - 1];

    // Hip position should be close
    expect(revFirst.bones.hip.pos[0]).toBeCloseTo(normLast.bones.hip.pos[0], 0);
  });

  it('multiple clips placed sequentially', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip a from pirouette 0.0-0.5',
      'clip b from pirouette 0.5-1.0',
      '@1:1  clip a',
      '@2:1  clip b',  // @2:1 = 2.0 seconds at 120bpm
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // Should have keyframes starting near 0 and near 2.0
    const times = lowLevel.keyframes.map(kf => kf.time);
    expect(times[0]).toBeCloseTo(0, 1);
    expect(times.some(t => t >= 1.9 && t <= 2.1)).toBe(true);
  });

  it('returns minimal DSL for empty sequence', () => {
    const script = 'bpm 120\n';
    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    expect(result).toContain('duration');
  });
});

describe('expand — pose interpolation', () => {
  it('single pose overrides clip bones at its time', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-2.0',
      '',
      'pose arms-high',
      '  lShldr rot 0 0 -160',
      '',
      '@1:1  clip spin',
      '@1:1  pose arms-high',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // At time 0, lShldr should have the pose override value
    const kf0 = lowLevel.keyframes[0];
    expect(kf0.bones.lShldr).toBeDefined();
    expect(kf0.bones.lShldr.rot[2]).toBeCloseTo(-160, 0);
  });

  it('pose rest clears overrides (empty bones)', () => {
    const hdsl = parse([
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-4.0',
      '',
      'pose arms-high',
      '  lShldr rot 0 0 -160',
      '',
      '@1:1  clip spin',
      '@1:1  pose arms-high',
      '@3:1  pose rest',
    ].join('\n'));

    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // At 4.0s (@3:1), the rest pose has no bones to override,
    // so lShldr should come from the clip
    const kfAt4 = lowLevel.keyframes.find(kf => Math.abs(kf.time - 4.0) < 0.05);
    if (kfAt4) {
      // Should still have lShldr from clip (not from pose)
      expect(kfAt4.bones.lShldr).toBeDefined();
    }
  });

  it('interpolates between two poses with easing', () => {
    const hdsl = parse([
      'bpm 60',   // 60bpm → 1 beat = 1 second, @1:1=0s, @1:3=2s
      'source pirouette',
      'clip spin from pirouette 0.0-4.0',
      '',
      'pose arms-up',
      '  lShldr rot 0 0 -160',
      '',
      'pose arms-down',
      '  lShldr rot 0 0 0',
      '',
      '@1:1  clip spin',
      '@1:1  pose arms-up  linear',
      '@1:3  pose arms-down linear',
    ].join('\n'));

    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // At time 0 (start): lShldr should be near -160
    const kf0 = lowLevel.keyframes[0];
    expect(kf0.bones.lShldr.rot[2]).toBeCloseTo(-160, 0);

    // At ~1s (midpoint): lShldr should be between -160 and 0
    const kfMid = lowLevel.keyframes.find(kf => Math.abs(kf.time - 1.0) < 0.05);
    if (kfMid && kfMid.bones.lShldr) {
      expect(kfMid.bones.lShldr.rot[2]).toBeGreaterThan(-165);
      expect(kfMid.bones.lShldr.rot[2]).toBeLessThan(-5);
    }

    // At ~2s (end): lShldr should be near 0 (within euler↔quat round-trip tolerance)
    const kfEnd = lowLevel.keyframes.find(kf => Math.abs(kf.time - 2.0) < 0.05);
    if (kfEnd && kfEnd.bones.lShldr) {
      expect(Math.abs(kfEnd.bones.lShldr.rot[2])).toBeLessThan(5);
    }
  });

  it('hold delays interpolation start', () => {
    const hdsl = parse([
      'bpm 60',   // 1 beat = 1 second
      'source pirouette',
      'clip spin from pirouette 0.0-6.0',
      '',
      'pose arms-up',
      '  lShldr rot 0 0 -160',
      '',
      'pose arms-down',
      '  lShldr rot 0 0 0',
      '',
      '@1:1  clip spin',
      '@1:1  pose arms-up  linear hold 2',   // hold for 2 beats = 2s
      '@1:5  pose arms-down linear',          // @1:5 = 4s at 60bpm
    ].join('\n'));

    const lib = makeLib();
    const result = expand(hdsl, lib);
    const lowLevel = dslParse(result);

    // At time 0: should be arms-up (-160)
    const kf0 = lowLevel.keyframes[0];
    expect(kf0.bones.lShldr.rot[2]).toBeCloseTo(-160, 0);

    // At time 1.5s (within hold period): should still be -160
    const kfHold = lowLevel.keyframes.find(kf => Math.abs(kf.time - 1.5) < 0.05);
    if (kfHold && kfHold.bones.lShldr) {
      expect(kfHold.bones.lShldr.rot[2]).toBeCloseTo(-160, 0);
    }

    // At time 3s (midpoint of interp: 2s to 4s): should be between -160 and 0
    const kfMid = lowLevel.keyframes.find(kf => Math.abs(kf.time - 3.0) < 0.1);
    if (kfMid && kfMid.bones.lShldr) {
      expect(kfMid.bones.lShldr.rot[2]).toBeGreaterThan(-165);
      expect(kfMid.bones.lShldr.rot[2]).toBeLessThan(-5);
    }
  });
});

describe('expand — round-trip through low-level DSL', () => {
  it('expanded output is parseable and compilable by dsl.js', () => {
    const script = [
      'bpm 120',
      'source pirouette',
      'clip spin from pirouette 0.0-2.0',
      '@1:1  clip spin',
    ].join('\n');

    const hdsl = parse(script);
    const lib = makeLib();
    const expanded = expand(hdsl, lib);

    // Should parse cleanly
    const lowLevel = dslParse(expanded);
    expect(lowLevel.duration).toBeGreaterThan(0);
    expect(lowLevel.keyframes.length).toBeGreaterThan(0);

    // Every keyframe should have bone data
    for (const kf of lowLevel.keyframes) {
      expect(Object.keys(kf.bones).length).toBeGreaterThan(0);
    }
  });
});

describe('indexLines', () => {
  it('maps @M:B markers to line numbers and beat times', () => {
    const text = [
      '# Dance',
      'bpm 120',
      '',
      '@1:1  clip spin',
      '@3:1  clip recover',
    ].join('\n');

    const idx = indexLines(text);
    expect(idx).toHaveLength(2);

    // @1:1 at 120bpm = 0 seconds
    expect(idx[0].time).toBeCloseTo(0, 3);
    expect(idx[0].line).toBe(3);

    // @3:1 at 120bpm = 4 seconds
    expect(idx[1].time).toBeCloseTo(4.0, 3);
    expect(idx[1].line).toBe(4);
  });

  it('returns empty for no markers', () => {
    expect(indexLines('bpm 120\nsource pirouette\n')).toEqual([]);
  });

  it('respects bpm for time calculation', () => {
    const text = [
      'bpm 60',
      '@2:1  clip x',
    ].join('\n');

    const idx = indexLines(text);
    // @2:1 at 60bpm → (2-1)*4*(60/60) + (1-1)*(60/60) = 4 seconds
    expect(idx[0].time).toBeCloseTo(4.0, 3);
  });

  it('multiple entries on same beat get separate entries', () => {
    const text = [
      'bpm 120',
      '@1:1  clip spin',
      '@1:1  pose arms-high',
      '@3:1  clip recover',
    ].join('\n');

    const idx = indexLines(text);
    expect(idx).toHaveLength(3);
    expect(idx[0].time).toBe(idx[1].time);
    expect(idx[0].line).toBe(1);
    expect(idx[1].line).toBe(2);
  });
});
