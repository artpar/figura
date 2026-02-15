import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { BONE_MAP } from './retarget.js';
import { generate, parse, compile } from './dsl.js';

const DSL_BONES = Object.values(BONE_MAP);

// Load real BVH
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Helper: build a fresh root for the skeleton so a mixer can drive it
function makeRoot(skeleton) {
  const root = new THREE.Object3D();
  for (const bone of skeleton.bones) {
    if (!bone.parent || !skeleton.bones.includes(bone.parent)) {
      root.add(bone);
    }
  }
  return root;
}

// Helper: sample all DSL bone quaternions (and hip position) at a given time
function sampleBones(mixer, skeleton, t) {
  mixer.setTime(t);
  const snap = {};
  for (const bone of skeleton.bones) {
    if (!DSL_BONES.includes(bone.name)) continue;
    snap[bone.name] = {
      q: bone.quaternion.clone(),
      p: bone.name === 'hip' ? bone.position.clone() : null,
    };
  }
  return snap;
}

describe('BVH vs DSL fidelity comparison', () => {
  it('reports per-bone rotation error at fine time steps', () => {
    const duration = bvh.clip.duration;
    const sampleStep = 0.0333; // ~30fps sampling for comparison
    const sampleCount = Math.floor(duration / sampleStep) + 1;

    // --- Phase 1: sample original BVH at every step ---
    const root1 = makeRoot(bvh.skeleton);
    const mixer1 = new THREE.AnimationMixer(root1);
    const action1 = mixer1.clipAction(bvh.clip);
    action1.play();

    const origSamples = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = Math.min(i * sampleStep, duration);
      origSamples.push({ t, bones: sampleBones(mixer1, bvh.skeleton, t) });
    }
    action1.stop();
    mixer1.uncacheAction(bvh.clip);

    // --- Phase 2: generate DSL (native frame rate), compile, sample at same steps ---
    const dslText = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(dslText);
    const { clip: dslClip } = compile(parsed, bvh.skeleton);

    const root2 = makeRoot(bvh.skeleton);
    const mixer2 = new THREE.AnimationMixer(root2);
    const action2 = mixer2.clipAction(dslClip);
    action2.play();

    const dslSamples = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = Math.min(i * sampleStep, duration);
      dslSamples.push({ t, bones: sampleBones(mixer2, bvh.skeleton, t) });
    }
    action2.stop();
    mixer2.uncacheAction(dslClip);

    // --- Phase 3: compare and build error report ---
    // Track max angular error per bone (degrees) and time of worst error
    const boneErrors = {};
    for (const name of DSL_BONES) {
      boneErrors[name] = { maxDeg: 0, worstTime: 0, errors: [] };
    }
    let hipMaxPosDist = 0;
    let hipWorstPosTime = 0;

    for (let i = 0; i < sampleCount; i++) {
      const t = origSamples[i].t;
      for (const name of DSL_BONES) {
        const oq = origSamples[i].bones[name].q;
        const dq = dslSamples[i].bones[name].q;

        // Angular difference in degrees
        let dot = Math.abs(oq.dot(dq));
        if (dot > 1) dot = 1;
        const angleDeg = (2 * Math.acos(dot) * 180) / Math.PI;

        boneErrors[name].errors.push({ t, deg: angleDeg });
        if (angleDeg > boneErrors[name].maxDeg) {
          boneErrors[name].maxDeg = angleDeg;
          boneErrors[name].worstTime = t;
        }

        // Hip position
        if (name === 'hip') {
          const op = origSamples[i].bones[name].p;
          const dp = dslSamples[i].bones[name].p;
          const dist = op.distanceTo(dp);
          if (dist > hipMaxPosDist) {
            hipMaxPosDist = dist;
            hipWorstPosTime = t;
          }
        }
      }
    }

    // --- Phase 4: print report ---
    console.log('\n=== BVH vs DSL (native frame rate) Fidelity Report ===');
    console.log(`Original: ${bvh.clip.tracks.length} tracks, 592 frames @ 120fps`);
    console.log(`DSL: ${parsed.keyframes.length} keyframes @ 0.5s intervals`);
    console.log(`Comparison: ${sampleCount} samples @ 30fps\n`);

    // Sort bones by max error
    const sorted = DSL_BONES
      .map(name => ({ name, ...boneErrors[name] }))
      .sort((a, b) => b.maxDeg - a.maxDeg);

    console.log('Bone               Max Error (deg)   Worst Time (s)');
    console.log('─'.repeat(55));
    for (const b of sorted) {
      console.log(
        `${b.name.padEnd(20)}${b.maxDeg.toFixed(2).padStart(10)}°    @ ${b.worstTime.toFixed(3)}s`
      );
    }

    console.log(`\nHip position max error: ${hipMaxPosDist.toFixed(2)} cm @ ${hipWorstPosTime.toFixed(3)}s`);

    // Compute average error across all bones/times
    let totalError = 0;
    let totalSamples = 0;
    for (const name of DSL_BONES) {
      for (const e of boneErrors[name].errors) {
        totalError += e.deg;
        totalSamples++;
      }
    }
    const avgError = totalError / totalSamples;
    console.log(`Average rotation error: ${avgError.toFixed(3)}°`);

    // Bones with > 5° max error
    const badBones = sorted.filter(b => b.maxDeg > 5);
    console.log(`\nBones exceeding 5°: ${badBones.length} / ${DSL_BONES.length}`);
    if (badBones.length > 0) {
      console.log('  ' + badBones.map(b => `${b.name} (${b.maxDeg.toFixed(1)}°)`).join(', '));
    }

    // Time ranges with worst errors (for hip, as representative)
    const hipErrors = boneErrors['hip'].errors;
    const worstWindows = [];
    for (let i = 0; i < hipErrors.length; i++) {
      if (hipErrors[i].deg > 3) {
        worstWindows.push(hipErrors[i].t.toFixed(3));
      }
    }
    if (worstWindows.length > 0) {
      console.log(`\nHip rotation > 3° at times: ${worstWindows.slice(0, 20).join(', ')}${worstWindows.length > 20 ? '...' : ''}`);
    }

    console.log('\n=== End Report ===\n');

    // The test "passes" — it's diagnostic. But assert something useful:
    // at keyframe-exact times (0, 0.5, 1.0...) error should be near-zero
    for (const kf of parsed.keyframes) {
      const idx = origSamples.findIndex(s => Math.abs(s.t - kf.time) < sampleStep / 2);
      if (idx < 0) continue;
      for (const name of DSL_BONES) {
        const oq = origSamples[idx].bones[name].q;
        const dq = dslSamples[idx].bones[name].q;
        const dot = Math.abs(oq.dot(dq));
        // At keyframe times, error should be < 1° (rounding from .toFixed(1))
        expect(dot).toBeGreaterThan(0.9998);
      }
    }
  });

  it('30fps editing rate has acceptable fidelity', () => {
    const duration = bvh.clip.duration;
    const sampleStep = 0.0333;
    const sampleCount = Math.floor(duration / sampleStep) + 1;

    // Sample original BVH
    const root1 = makeRoot(bvh.skeleton);
    const mixer1 = new THREE.AnimationMixer(root1);
    const action1 = mixer1.clipAction(bvh.clip);
    action1.play();

    const origSamples = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = Math.min(i * sampleStep, duration);
      origSamples.push({ t, bones: sampleBones(mixer1, bvh.skeleton, t) });
    }
    action1.stop();
    mixer1.uncacheAction(bvh.clip);

    // Generate DSL at 30fps, compile, sample
    const dslText = generate(bvh.skeleton, bvh.clip, 1/30);
    const parsed = parse(dslText);
    const { clip: dslClip } = compile(parsed, bvh.skeleton);

    const root2 = makeRoot(bvh.skeleton);
    const mixer2 = new THREE.AnimationMixer(root2);
    const action2 = mixer2.clipAction(dslClip);
    action2.play();

    const dslSamples = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = Math.min(i * sampleStep, duration);
      dslSamples.push({ t, bones: sampleBones(mixer2, bvh.skeleton, t) });
    }
    action2.stop();
    mixer2.uncacheAction(dslClip);

    // Compute per-bone max error
    let globalMaxDeg = 0;
    let hipMaxPosDist = 0;
    const sorted = [];

    for (const name of DSL_BONES) {
      let maxDeg = 0;
      let worstTime = 0;
      for (let i = 0; i < sampleCount; i++) {
        const oq = origSamples[i].bones[name].q;
        const dq = dslSamples[i].bones[name].q;
        let dot = Math.abs(oq.dot(dq));
        if (dot > 1) dot = 1;
        const angleDeg = (2 * Math.acos(dot) * 180) / Math.PI;
        if (angleDeg > maxDeg) { maxDeg = angleDeg; worstTime = origSamples[i].t; }
        if (angleDeg > globalMaxDeg) globalMaxDeg = angleDeg;

        if (name === 'hip') {
          const dist = origSamples[i].bones[name].p.distanceTo(dslSamples[i].bones[name].p);
          if (dist > hipMaxPosDist) hipMaxPosDist = dist;
        }
      }
      sorted.push({ name, maxDeg, worstTime });
    }
    sorted.sort((a, b) => b.maxDeg - a.maxDeg);

    console.log('\n=== 30fps Editing Rate Fidelity ===');
    console.log(`DSL keyframes: ${parsed.keyframes.length}`);
    console.log(`Max rotation error: ${globalMaxDeg.toFixed(2)}°`);
    console.log(`Hip position max error: ${hipMaxPosDist.toFixed(2)} cm`);
    console.log('Top 5 bones:');
    for (const b of sorted.slice(0, 5)) {
      console.log(`  ${b.name.padEnd(15)} ${b.maxDeg.toFixed(2)}° @ ${b.worstTime.toFixed(3)}s`);
    }
    console.log('=== End ===\n');

    // Assert: max error under 5° (acceptable for editing)
    expect(globalMaxDeg).toBeLessThan(5);
    // Hip position under 2cm
    expect(hipMaxPosDist).toBeLessThan(2);
  });
});
