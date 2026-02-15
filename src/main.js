import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';
import { createPlayback } from './playback.js';
import { createControls } from './ui/controls.js';

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const [bvh, character] = await Promise.all([
  loadBVH('/assets/pirouette.bvh'),
  loadCharacter('/assets/character.glb'),
]);

scene.add(character.model);

const clip = retargetAnimation(character.mesh, bvh.skeleton, bvh.clip);
const playback = createPlayback(character.mesh, clip);
const ui = createControls(playback, document.getElementById('controls'));

function animate() {
  requestAnimationFrame(animate);
  playback.update();
  ui.update();
  controls.update();
  renderer.render(scene, camera);
}

animate();
