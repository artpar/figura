import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function loadCharacter(url) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const model = gltf.scene;
        let mesh = null;

        model.traverse((child) => {
          if (child.isSkinnedMesh) {
            child.castShadow = true;
            child.frustumCulled = false;
            if (!mesh) {
              mesh = child;
            }
          }
        });

        // GLB has Armature scale 0.01 (FBX→Blender→GLB artifact) and mesh vertices in meters.
        // Scale model by 100 so effective Armature scale = 100*0.01 = 1, putting bones in cm world space.
        // The S(100) left in boneMatrix correctly converts meter-scale vertices to cm.
        // Leave Armature scale and binding untouched — they are internally consistent.
        model.scale.setScalar(100);
        model.updateMatrixWorld(true);

        resolve({ model, mesh });
      },
      undefined,
      reject
    );
  });
}
