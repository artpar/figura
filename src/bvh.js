import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';

export function loadBVH(url) {
  return new Promise((resolve, reject) => {
    new BVHLoader().load(
      url,
      (result) => {
        result.skeleton.bones[0].updateMatrixWorld(true);
        resolve({ skeleton: result.skeleton, clip: result.clip });
      },
      undefined,
      reject
    );
  });
}
