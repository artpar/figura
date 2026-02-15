import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

// Build a mock GLTF scene that resembles the real character.glb
function buildMockGltfScene() {
  const bones = [
    new THREE.Bone(),
    new THREE.Bone(),
  ];
  bones[0].name = 'mixamorigHips';
  bones[0].position.set(0, 90, 0);
  bones[1].name = 'mixamorigSpine';
  bones[0].add(bones[1]);

  const skeleton = new THREE.Skeleton(bones);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([0, 0, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));

  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(bones[0]);
  mesh.bind(skeleton);

  const model = new THREE.Group();
  model.add(mesh);

  return model;
}

const mockModel = buildMockGltfScene();

// Mock GLTFLoader so loadCharacter runs its real traversal on our mock scene
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(url, onLoad) {
      onLoad({ scene: mockModel });
    }
  },
}));

const { loadCharacter } = await import('./character.js');

describe('character loader contract', () => {
  let model, mesh;

  it('loadCharacter resolves with model and mesh', async () => {
    const result = await loadCharacter('/assets/character.glb');
    model = result.model;
    mesh = result.mesh;
    expect(model).toBeDefined();
    expect(mesh).toBeDefined();
  });

  it('model scale is (1,1,1) — no scaling applied', async () => {
    expect(model.scale.x).toBe(1);
    expect(model.scale.y).toBe(1);
    expect(model.scale.z).toBe(1);
  });

  it('SkinnedMesh has frustumCulled === false', () => {
    expect(mesh.frustumCulled).toBe(false);
  });

  it('mesh is a SkinnedMesh with skeleton', () => {
    expect(mesh.isSkinnedMesh).toBe(true);
    expect(mesh.skeleton).toBeDefined();
    expect(mesh.skeleton.bones.length).toBeGreaterThan(0);
  });

  it('skeleton root bone position is cm-scale', () => {
    const root = mesh.skeleton.bones[0];
    expect(root.position.y).toBeGreaterThan(10);
  });
});
