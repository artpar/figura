import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PropertyBinding } from 'three';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { BONE_MAP, retargetAnimation } from './retarget.js';
import { generate, parse, compile } from './dsl.js';
import { createPlayback } from './playback.js';

// Load real BVH
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Build real target mesh (from playback.test.js pattern)
function parseGlbSkeleton(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.toString('utf-8', 20, 20 + jsonLen));
  const skin = gltf.skins[0];
  return { nodes: gltf.nodes, jointIndices: new Set(skin.joints), rootJoint: skin.joints[0] };
}

const glbPath = path.resolve(__dirname, '../public/assets/character.glb');
const glb = parseGlbSkeleton(glbPath);

function buildTargetMesh() {
  const { nodes, jointIndices, rootJoint } = glb;
  const boneByIdx = new Map();
  for (const idx of jointIndices) {
    const node = nodes[idx];
    const bone = new THREE.Bone();
    bone.name = PropertyBinding.sanitizeNodeName(node.name);
    if (node.translation) bone.position.set(...node.translation);
    if (node.rotation) bone.quaternion.set(...node.rotation);
    boneByIdx.set(idx, bone);
  }
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
  const allBones = [...boneByIdx.values()];
  const skeleton = new THREE.Skeleton(allBones);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(boneByIdx.get(rootJoint));
  mesh.bind(skeleton);
  return mesh;
}

const targetMesh = buildTargetMesh();

describe('DSL edit pipeline end-to-end', () => {
  it('compile produces different clip when DSL values change', () => {
    const dslText = generate(bvh.skeleton, bvh.clip);
    const parsed1 = parse(dslText);

    // Modify: change rHand rotation at keyframe 100 by 45 degrees
    const modifiedText = dslText.replace(
      /^(  rHand\s+rot\s+)([\d.-]+)/m,
      (_, prefix, val) => prefix + String((parseFloat(val) + 45).toFixed(1))
    );
    expect(modifiedText).not.toBe(dslText);

    const parsed2 = parse(modifiedText);

    const { clip: clip1 } = compile(parsed1, bvh.skeleton);
    const { clip: clip2 } = compile(parsed2, bvh.skeleton);

    // Find rHand quaternion track in both clips
    const track1 = clip1.tracks.find(t => t.name === 'rHand.quaternion');
    const track2 = clip2.tracks.find(t => t.name === 'rHand.quaternion');

    expect(track1).toBeDefined();
    expect(track2).toBeDefined();

    // The first keyframe's quaternion values should differ
    const q1 = [track1.values[0], track1.values[1], track1.values[2], track1.values[3]];
    const q2 = [track2.values[0], track2.values[1], track2.values[2], track2.values[3]];

    const different = q1.some((v, i) => Math.abs(v - q2[i]) > 0.001);
    expect(different).toBe(true);
  });

  it('retargetAnimation produces different clip when source clip differs', () => {
    const dslText = generate(bvh.skeleton, bvh.clip);

    // Modify rHand in ALL keyframes by adding 45 degrees to Z rotation
    const lines = dslText.split('\n');
    const modifiedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('rHand')) {
        return line.replace(
          /rot\s+([\d.-]+)/,
          (_, val) => 'rot ' + (parseFloat(val) + 45).toFixed(1)
        );
      }
      return line;
    });
    const modifiedText = modifiedLines.join('\n');

    const parsed1 = parse(dslText);
    const parsed2 = parse(modifiedText);

    const { skeleton: skel1, clip: srcClip1 } = compile(parsed1, bvh.skeleton);
    const { skeleton: skel2, clip: srcClip2 } = compile(parsed2, bvh.skeleton);

    const retClip1 = retargetAnimation(targetMesh, skel1, srcClip1);
    const retClip2 = retargetAnimation(targetMesh, skel2, srcClip2);

    // Find the rHand (mapped to mixamorigRightHand) track
    const targetBoneName = Object.entries(BONE_MAP).find(([k, v]) => v === 'rHand')[0];
    const rTrack1 = retClip1.tracks.find(t => t.name.includes(targetBoneName) && t.name.includes('quaternion'));
    const rTrack2 = retClip2.tracks.find(t => t.name.includes(targetBoneName) && t.name.includes('quaternion'));

    expect(rTrack1).toBeDefined();
    expect(rTrack2).toBeDefined();

    // Compare quaternion values at frame 50 (arbitrary mid-animation)
    const offset = 50 * 4;
    const q1 = [rTrack1.values[offset], rTrack1.values[offset+1], rTrack1.values[offset+2], rTrack1.values[offset+3]];
    const q2 = [rTrack2.values[offset], rTrack2.values[offset+1], rTrack2.values[offset+2], rTrack2.values[offset+3]];

    const different = q1.some((v, i) => Math.abs(v - q2[i]) > 0.001);
    expect(different).toBe(true);
  });

  it('setClip on playback changes the animation clip', () => {
    const dslText = generate(bvh.skeleton, bvh.clip);
    const parsed = parse(dslText);
    const { skeleton, clip: srcClip } = compile(parsed, bvh.skeleton);
    const retClip = retargetAnimation(targetMesh, skeleton, srcClip);

    const pb = createPlayback(targetMesh, retClip);
    expect(pb.getDuration()).toBeCloseTo(retClip.duration, 2);

    // Create a modified clip with different duration as a clear signal
    const modifiedLines = dslText.split('\n').map(line => {
      if (line.startsWith('duration')) return 'duration 2.0000';
      return line;
    });
    const modifiedText = modifiedLines.join('\n');
    const parsed2 = parse(modifiedText);
    const { skeleton: skel2, clip: srcClip2 } = compile(parsed2, bvh.skeleton);
    const retClip2 = retargetAnimation(targetMesh, skel2, srcClip2);

    pb.setClip(retClip2);
    expect(pb.getDuration()).toBeCloseTo(2.0, 1);
  });
});
