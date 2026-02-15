import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';

const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);

const loader = new BVHLoader();
const { skeleton, clip } = loader.parse(bvhText);

describe('BVH loader stays pure — no scale transforms', () => {
  it('bone offsets are cm-scale (first child offset > 1, < 1000)', () => {
    // Root bone (hip) OFFSET is 0,0,0 per BVH spec.
    // First child (abdomen) OFFSET ~20cm proves data is in cm, not meters.
    const abdomen = skeleton.bones[1];
    expect(abdomen.position.y).toBeGreaterThan(1);
    expect(abdomen.position.y).toBeLessThan(1000);
  });

  it('hip position track values are cm-scale, not meter-scale', () => {
    const hipPosTrack = clip.tracks.find(
      (t) => t.name.endsWith('.position') && t.name.includes('hip')
    );
    expect(hipPosTrack).toBeDefined();

    // Sample Y values from the position track (every 3rd value starting at index 1)
    const yValues = [];
    for (let i = 1; i < hipPosTrack.values.length; i += 3) {
      yValues.push(hipPosTrack.values[i]);
    }

    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    // cm-scale hip height: roughly 80-120cm. Definitely not ~0.8-1.2m.
    expect(avgY).toBeGreaterThan(10);
    expect(avgY).toBeLessThan(1000);
  });

  it('clip has duration > 0', () => {
    expect(clip.duration).toBeGreaterThan(0);
  });

  it('skeleton has bones', () => {
    expect(skeleton.bones.length).toBeGreaterThan(0);
  });
});
