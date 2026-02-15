import * as THREE from 'three';
import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const [bvh, character] = await Promise.all([
  loadBVH('/assets/pirouette.bvh'),
  loadCharacter('/assets/character.glb'),
]);

scene.add(character.model);

const clip = retargetAnimation(character.mesh, bvh.skeleton, bvh.clip);
const mixer = new THREE.AnimationMixer(character.mesh);
mixer.clipAction(clip).play();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  mixer.update(clock.getDelta());
  controls.update();
  renderer.render(scene, camera);
}

animate();
