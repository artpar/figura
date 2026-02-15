import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { PropertyBinding } from 'three';

// Parse real GLB to get ground-truth structure
function parseGlb(filePath) {
  const buf = fs.readFileSync(filePath);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf-8', 20, 20 + jsonLen));
}

const glbPath = path.resolve(__dirname, '../public/assets/character.glb');
const gltf = parseGlb(glbPath);
const skin = gltf.skins[0];
const jointIndices = new Set(skin.joints);

// Build a mock GLTF scene that mirrors the real GLB structure
function buildMockFromGlb() {
  const nodes = gltf.nodes;
  const sceneRootIdx = gltf.scenes[0].nodes[0];
  const sceneRoot = nodes[sceneRootIdx];

  // Create the Armature group with real export scale
  const armature = new THREE.Group();
  armature.name = sceneRoot.name;
  if (sceneRoot.scale) {
    armature.scale.set(...sceneRoot.scale);
  }

  // Create bones from real joint data
  const boneByIdx = new Map();
  for (const idx of jointIndices) {
    const node = nodes[idx];
    const bone = new THREE.Bone();
    bone.name = PropertyBinding.sanitizeNodeName(node.name);
    if (node.translation) bone.position.set(...node.translation);
    if (node.rotation) bone.quaternion.set(...node.rotation);
    boneByIdx.set(idx, bone);
  }

  // Wire real hierarchy
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

  const rootBone = boneByIdx.get(skin.joints[0]);
  const allBones = [...boneByIdx.values()];
  const skeleton = new THREE.Skeleton(allBones);

  // Create SkinnedMesh
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(rootBone);
  mesh.bind(skeleton);

  armature.add(mesh);
  armature.add(rootBone);

  const model = new THREE.Group();
  model.add(armature);

  return model;
}

const mockModel = buildMockFromGlb();

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(url, onLoad) {
      onLoad({ scene: mockModel });
    }
  },
}));

const { loadCharacter } = await import('./character.js');

describe('real GLB structure', () => {
  it('Armature node in GLB has 0.01 export scale', () => {
    const sceneRoot = gltf.nodes[gltf.scenes[0].nodes[0]];
    expect(sceneRoot.name).toBe('Armature');
    expect(sceneRoot.scale[0]).toBeCloseTo(0.01);
  });

  it('skin has joints with mixamorig: prefix', () => {
    const rootJointName = gltf.nodes[skin.joints[0]].name;
    expect(rootJointName).toBe('mixamorig:Hips');
  });
});

describe('loadCharacter', () => {
  let result;

  it('resolves with model and mesh', async () => {
    result = await loadCharacter('/assets/character.glb');
    expect(result.model).toBeDefined();
    expect(result.mesh).toBeDefined();
  });

  it('mesh is a SkinnedMesh with skeleton', () => {
    expect(result.mesh.isSkinnedMesh).toBe(true);
    expect(result.mesh.skeleton).toBeDefined();
    expect(result.mesh.skeleton.bones.length).toBeGreaterThan(0);
  });

  it('frustumCulled is false on SkinnedMesh', () => {
    expect(result.mesh.frustumCulled).toBe(false);
  });

  it('model scale compensates Armature 0.01 so bones are in cm world space', () => {
    expect(result.model.scale.x).toBe(100);
    const rootBone = result.mesh.skeleton.bones[0];
    const armature = rootBone.parent;
    expect(armature.scale.x).toBeCloseTo(0.01);
    expect(result.model.scale.x * armature.scale.x).toBeCloseTo(1);
  });

  it('skeleton root bone position is cm-scale', () => {
    const root = result.mesh.skeleton.bones[0];
    expect(root.position.y).toBeGreaterThan(10);
  });
});
