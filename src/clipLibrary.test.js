import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { generate, parse } from './dsl.js';
import { create } from './clipLibrary.js';

// Load real BVH data and generate low-level DSL keyframes
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

const dslText = generate(bvh.skeleton, bvh.clip, 1 / 30);
const parsed = parse(dslText);

describe('clipLibrary', () => {
  it('create returns a library handle', () => {
    const lib = create();
    expect(lib.has).toBeTypeOf('function');
    expect(lib.register).toBeTypeOf('function');
    expect(lib.extract).toBeTypeOf('function');
    expect(lib.sources).toBeTypeOf('function');
  });

  it('register + has', () => {
    const lib = create();
    expect(lib.has('pirouette')).toBe(false);
    lib.register('pirouette', parsed);
    expect(lib.has('pirouette')).toBe(true);
  });

  it('sources lists registered names', () => {
    const lib = create();
    lib.register('pirouette', parsed);
    expect(lib.sources()).toEqual(['pirouette']);
  });

  it('extract returns keyframes in time range, rebased to 0', () => {
    const lib = create();
    lib.register('pirouette', parsed);

    const slice = lib.extract('pirouette', 0.0, 1.0);
    expect(slice.duration).toBeCloseTo(1.0, 3);
    expect(slice.keyframes.length).toBeGreaterThan(0);

    // First keyframe should be at time ~0
    expect(slice.keyframes[0].time).toBeCloseTo(0, 3);

    // All keyframes should be within [0, 1.0]
    for (const kf of slice.keyframes) {
      expect(kf.time).toBeGreaterThanOrEqual(-0.001);
      expect(kf.time).toBeLessThanOrEqual(1.001);
    }

    // Should have bone data
    expect(Object.keys(slice.keyframes[0].bones).length).toBe(19);
  });

  it('extract from middle of source rebases times', () => {
    const lib = create();
    lib.register('pirouette', parsed);

    const slice = lib.extract('pirouette', 1.0, 2.0);
    expect(slice.duration).toBeCloseTo(1.0, 3);
    expect(slice.keyframes[0].time).toBeCloseTo(0, 1);
  });

  it('duration returns source duration', () => {
    const lib = create();
    lib.register('pirouette', parsed);
    expect(lib.duration('pirouette')).toBeCloseTo(parsed.duration, 3);
  });

  it('duration throws for unknown source', () => {
    const lib = create();
    expect(() => lib.duration('unknown')).toThrow('Source "unknown" not registered');
  });

  it('extract throws for unknown source', () => {
    const lib = create();
    expect(() => lib.extract('unknown', 0, 1)).toThrow('Source "unknown" not registered');
  });

  it('extract returns empty keyframes for out-of-range window', () => {
    const lib = create();
    lib.register('pirouette', parsed);

    const slice = lib.extract('pirouette', 999, 1000);
    expect(slice.keyframes).toHaveLength(0);
  });
});
