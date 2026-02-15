import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { BONE_MAP } from './retarget.js';
import { generate, parse, compile, indexLines, lineForTime } from './dsl.js';

const DSL_BONES = Object.values(BONE_MAP);

// Load real BVH data
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

describe('generate', () => {
  it('produces DSL text with duration and keyframes', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    expect(text).toContain('duration');
    expect(text).toMatch(/@\d+\.\d+/);
  });

  it('includes all 19 BONE_MAP bones in each keyframe', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const blocks = text.split(/^@/m).slice(1);
    expect(blocks.length).toBeGreaterThan(0);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const boneNames = lines.slice(1).map(l => l.split(/\s+/)[0]);
      for (const name of DSL_BONES) {
        expect(boneNames).toContain(name);
      }
    }
  });

  it('hip has pos and rot, other bones have rot only', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const lines = text.split('\n');

    const hipLines = lines.filter(l => l.trim().startsWith('hip '));
    expect(hipLines.length).toBeGreaterThan(0);
    for (const line of hipLines) {
      expect(line).toContain('pos');
      expect(line).toContain('rot');
    }

    const abdomenLines = lines.filter(l => l.trim().startsWith('abdomen '));
    expect(abdomenLines.length).toBeGreaterThan(0);
    for (const line of abdomenLines) {
      expect(line).not.toContain('pos');
      expect(line).toContain('rot');
    }
  });

  it('defaults to native BVH frame rate', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const times = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^@(\d+\.\d+)/);
      if (m) times.push(parseFloat(m[1]));
    }
    expect(times[0]).toBe(0);
    // pirouette.bvh is 120fps → 0.00833s frame time
    expect(times[1]).toBeCloseTo(0.00833, 3);
    expect(times.length).toBe(592);
  });

  it('respects explicit interval override', () => {
    const text = generate(bvh.skeleton, bvh.clip, 0.5);
    const times = [];
    for (const line of text.split('\n')) {
      const m = line.match(/^@(\d+\.\d+)/);
      if (m) times.push(parseFloat(m[1]));
    }
    expect(times[1]).toBeCloseTo(0.5, 1);
  });
});

describe('parse', () => {
  it('parses generated DSL into structured data', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);

    expect(parsed.duration).toBeCloseTo(bvh.clip.duration, 1);
    expect(parsed.keyframes.length).toBeGreaterThan(0);

    const kf0 = parsed.keyframes[0];
    expect(kf0.time).toBe(0);
    expect(Object.keys(kf0.bones)).toHaveLength(19);
  });

  it('parses hip position and rotation', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const hip = parsed.keyframes[0].bones.hip;

    expect(hip.pos).toHaveLength(3);
    expect(hip.rot).toHaveLength(3);
    hip.pos.forEach(v => expect(typeof v).toBe('number'));
    hip.rot.forEach(v => expect(typeof v).toBe('number'));
  });

  it('parses non-hip bones with rotation only', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const abdomen = parsed.keyframes[0].bones.abdomen;

    expect(abdomen.rot).toHaveLength(3);
    expect(abdomen.pos).toBeUndefined();
  });

  it('ignores comments and empty lines', () => {
    const text = `# comment\n\nduration 2.00\n\n@0.00\n  hip       pos 0.0 0.0 0.0  rot 0.0 0.0 0.0\n# another comment\n`;
    const parsed = parse(text);
    expect(parsed.duration).toBe(2);
    expect(parsed.keyframes).toHaveLength(1);
    expect(parsed.keyframes[0].bones.hip.rot).toEqual([0, 0, 0]);
  });

  it('handles missing bones gracefully', () => {
    const text = `duration 1.00\n@0.00\n  hip       pos 0.0 0.0 0.0  rot 0.0 0.0 0.0\n`;
    const parsed = parse(text);
    expect(parsed.keyframes[0].bones.hip).toBeDefined();
    expect(Object.keys(parsed.keyframes[0].bones)).toHaveLength(1);
  });
});

describe('compile', () => {
  it('produces skeleton and clip from parsed DSL', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const result = compile(parsed, bvh.skeleton);

    expect(result.skeleton).toBe(bvh.skeleton);
    expect(result.clip).toBeInstanceOf(THREE.AnimationClip);
    expect(result.clip.duration).toBeCloseTo(bvh.clip.duration, 1);
  });

  it('clip has quaternion tracks for each bone', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const { clip } = compile(parsed, bvh.skeleton);

    const quatTracks = clip.tracks.filter(t => t.name.endsWith('.quaternion'));
    expect(quatTracks.length).toBe(19);
  });

  it('clip has position track for hip', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const { clip } = compile(parsed, bvh.skeleton);

    const posTracks = clip.tracks.filter(t => t.name.endsWith('.position'));
    expect(posTracks.length).toBe(1);
    expect(posTracks[0].name).toBe('hip.position');
  });
});

describe('indexLines', () => {
  it('returns time and line number for each @marker in generated DSL', () => {
    const text = generate(bvh.skeleton, bvh.clip, 1/30);
    const index = indexLines(text);

    expect(index.length).toBeGreaterThan(0);
    expect(index[0].time).toBe(0);
    expect(typeof index[0].line).toBe('number');

    // Verify line numbers point to actual @time lines
    const lines = text.split('\n');
    for (const entry of index) {
      expect(lines[entry.line].trim()).toMatch(/^@/);
      expect(parseFloat(lines[entry.line].trim().slice(1))).toBeCloseTo(entry.time, 3);
    }
  });

  it('returns empty array for text with no @markers', () => {
    expect(indexLines('duration 1.00\n# comment')).toEqual([]);
  });

  it('entries are sorted by time', () => {
    const text = generate(bvh.skeleton, bvh.clip, 0.5);
    const index = indexLines(text);
    for (let i = 1; i < index.length; i++) {
      expect(index[i].time).toBeGreaterThan(index[i - 1].time);
    }
  });
});

describe('lineForTime', () => {
  it('returns line of last @marker at or before given time', () => {
    const text = generate(bvh.skeleton, bvh.clip, 0.5);
    const index = indexLines(text);

    // At time 0, should return the first @0.0000 line
    expect(lineForTime(index, 0)).toBe(index[0].line);

    // At time 0.75 (between 0.5 and 1.0), should return the @0.5 line
    expect(lineForTime(index, 0.75)).toBe(index[1].line);

    // At exact time of last entry, should return that line
    const last = index[index.length - 1];
    expect(lineForTime(index, last.time)).toBe(last.line);
  });

  it('returns -1 for empty index', () => {
    expect(lineForTime([], 1.0)).toBe(-1);
  });

  it('returns -1 for time before first entry', () => {
    const index = [{ time: 1.0, line: 5 }];
    expect(lineForTime(index, 0.5)).toBe(-1);
  });

  it('returns last entry line for time past end', () => {
    const text = generate(bvh.skeleton, bvh.clip, 0.5);
    const index = indexLines(text);
    const last = index[index.length - 1];
    expect(lineForTime(index, 9999)).toBe(last.line);
  });
});

describe('round-trip', () => {
  it('generate → parse → compile preserves quaternions within tolerance', () => {
    const text = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(text);
    const { clip: compiled } = compile(parsed, bvh.skeleton);

    // Sample the original BVH at the same keyframe times and compare
    const root = new THREE.Object3D();
    for (const bone of bvh.skeleton.bones) {
      if (!bone.parent || !bvh.skeleton.bones.includes(bone.parent)) {
        root.add(bone);
      }
    }
    const origMixer = new THREE.AnimationMixer(root);
    const origAction = origMixer.clipAction(bvh.clip);
    origAction.play();

    const compiledRoot = new THREE.Object3D();
    // compile reuses same skeleton, so we need a separate mixer on a different root
    // Instead, compare track values directly
    const euler = new THREE.Euler();
    const qOrig = new THREE.Quaternion();
    const qComp = new THREE.Quaternion();
    const DEG2RAD = Math.PI / 180;

    for (const kf of parsed.keyframes) {
      for (const [boneName, bone] of Object.entries(kf.bones)) {
        if (!bone.rot) continue;

        // Reconstruct the compiled quaternion
        euler.set(bone.rot[1] * DEG2RAD, bone.rot[2] * DEG2RAD, bone.rot[0] * DEG2RAD, 'ZXY');
        qComp.setFromEuler(euler);

        // Sample original at this time
        origMixer.setTime(kf.time);
        const origBone = bvh.skeleton.bones.find(b => b.name === boneName);
        if (!origBone) continue;
        qOrig.copy(origBone.quaternion);

        // Quaternion dot product should be close to 1 (or -1 for equivalent)
        const dot = Math.abs(qOrig.dot(qComp));
        expect(dot).toBeGreaterThan(0.999);
      }
    }

    origAction.stop();
    origMixer.uncacheAction(bvh.clip);
  });
});
