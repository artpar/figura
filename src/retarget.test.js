import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { BONE_MAP } from './retarget.js';
import { retargetAnimation } from './retarget.js';

// Load BVH data (pure text parser, works in node)
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Collect BVH bone names
const bvhBoneNames = new Set();
bvh.skeleton.bones.forEach((bone) => bvhBoneNames.add(bone.name));

describe('BONE_MAP coverage', () => {
  it('every BONE_MAP source (BVH) name exists in BVH skeleton', () => {
    const missing = [];
    for (const [target, source] of Object.entries(BONE_MAP)) {
      if (!bvhBoneNames.has(source)) {
        missing.push(`${target} → ${source}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// Build a minimal target SkinnedMesh whose bone names match BONE_MAP keys
function buildTargetMesh() {
  const boneNames = Object.keys(BONE_MAP);
  const bones = boneNames.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
    return bone;
  });

  // Parent all bones to the first (Hips) for a minimal hierarchy
  for (let i = 1; i < bones.length; i++) {
    bones[0].add(bones[i]);
  }
  // Set hip position to cm-scale
  bones[0].position.set(0, 90, 0);

  const skeleton = new THREE.Skeleton(bones);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(4 * 1).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const material = new THREE.MeshStandardMaterial();

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.add(bones[0]);
  mesh.bind(skeleton);

  return mesh;
}

describe('retargetAnimation output', () => {
  const targetMesh = buildTargetMesh();

  // Verify target mesh bone names cover BONE_MAP before retargeting
  const targetBoneNames = new Set(targetMesh.skeleton.bones.map((b) => b.name));

  it('every BONE_MAP target (character) name exists in target skeleton', () => {
    const missing = [];
    for (const target of Object.keys(BONE_MAP)) {
      if (!targetBoneNames.has(target)) {
        missing.push(target);
      }
    }
    expect(missing).toEqual([]);
  });

  it('retargetAnimation returns a clip with duration > 0', () => {
    const clip = retargetAnimation(targetMesh, bvh.skeleton, bvh.clip);
    expect(clip).toBeDefined();
    expect(clip.duration).toBeGreaterThan(0);
  });

  it('retargeted clip has tracks', () => {
    const clip = retargetAnimation(targetMesh, bvh.skeleton, bvh.clip);
    expect(clip.tracks.length).toBeGreaterThan(0);
  });

  it('retargeted clip has a hip position track with cm-scale values', () => {
    const clip = retargetAnimation(targetMesh, bvh.skeleton, bvh.clip);
    const hipTrack = clip.tracks.find(
      (t) => t.name.includes('mixamorigHips') && t.name.endsWith('.position')
    );
    expect(hipTrack).toBeDefined();

    // Sample Y values
    const yValues = [];
    for (let i = 1; i < hipTrack.values.length; i += 3) {
      yValues.push(hipTrack.values[i]);
    }
    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    // cm-scale: should be roughly 80-120, definitely not 0.8-1.2
    expect(avgY).toBeGreaterThan(10);
    expect(avgY).toBeLessThan(1000);
  });
});
