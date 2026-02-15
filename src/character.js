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

        resolve({ model, mesh });
      },
      undefined,
      reject
    );
  });
}
