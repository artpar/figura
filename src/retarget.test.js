import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PropertyBinding } from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { BONE_MAP } from './retarget.js';
import { retargetAnimation } from './retarget.js';

// Load real BVH data
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Parse real GLB skeleton: hierarchy, names, and rest-pose transforms
function parseGlbSkeleton(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf-8', 20, 20 + jsonLen));
  const skin = gltf.skins[0];
  const jointIndices = new Set(skin.joints);
  const nodes = gltf.nodes;
  return { nodes, jointIndices, rootJoint: skin.joints[0] };
}

const glbPath = path.resolve(__dirname, '../public/assets/character.glb');
const glb = parseGlbSkeleton(glbPath);
const glbBoneNames = new Set(
  [...glb.jointIndices].map((idx) => PropertyBinding.sanitizeNodeName(glb.nodes[idx].name))
);
const bvhBoneNames = new Set(bvh.skeleton.bones.map((b) => b.name));

describe('BONE_MAP coverage', () => {
  it('every BONE_MAP target (character) name exists in real GLB', () => {
    const missing = [];
    for (const target of Object.keys(BONE_MAP)) {
      if (!glbBoneNames.has(target)) {
        missing.push(target);
      }
    }
    expect(missing).toEqual([]);
  });

  it('every BONE_MAP source (BVH) name exists in real BVH skeleton', () => {
    const missing = [];
    for (const [target, source] of Object.entries(BONE_MAP)) {
      if (!bvhBoneNames.has(source)) {
        missing.push(`${target} → ${source}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

// Build SkinnedMesh from real GLB skeleton data (hierarchy + rest poses)
function buildTargetMesh() {
  const { nodes, jointIndices, rootJoint } = glb;
  const boneByIdx = new Map();

  // Create bones with real names and rest-pose positions
  for (const idx of jointIndices) {
    const node = nodes[idx];
    const bone = new THREE.Bone();
    bone.name = PropertyBinding.sanitizeNodeName(node.name);
    if (node.translation) {
      bone.position.set(...node.translation);
    }
    if (node.rotation) {
      bone.quaternion.set(...node.rotation);
    }
    boneByIdx.set(idx, bone);
  }

  // Wire up real parent-child hierarchy
  for (const idx of jointIndices) {
    const node = nodes[idx];
    if (node.children) {
      for (const childIdx of node.children) {
        if (boneByIdx.has(childIdx)) {
          boneByIdx.get(idx).add(boneByIdx.get(childIdx));
        }
      }
    }
  }

  const rootBone = boneByIdx.get(rootJoint);
  const allBones = [...boneByIdx.values()];

  const skeleton = new THREE.Skeleton(allBones);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));

  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(rootBone);
  mesh.bind(skeleton);

  return mesh;
}

describe('retargetAnimation output', () => {
  const targetMesh = buildTargetMesh();

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

    const yValues = [];
    for (let i = 1; i < hipTrack.values.length; i += 3) {
      yValues.push(hipTrack.values[i]);
    }
    const avgY = yValues.reduce((a, b) => a + b, 0) / yValues.length;
    // With proportional scale compensation, hip Y should be near target rest height (~100cm)
    expect(avgY).toBeGreaterThan(50);
    expect(avgY).toBeLessThan(200);
  });
});
