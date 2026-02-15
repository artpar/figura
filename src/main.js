import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';
import { createPlayback } from './playback.js';
import { createCamera } from './camera.js';
import { createControls } from './ui/controls.js';
import { createCameraPanel } from './ui/cameraPanel.js';

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const [bvh, character] = await Promise.all([
  loadBVH('/assets/pirouette.bvh'),
  loadCharacter('/assets/character.glb'),
]);

scene.add(character.model);

const clip = retargetAnimation(character.mesh, bvh.skeleton, bvh.clip);
const playback = createPlayback(character.mesh, clip);
const cameraApi = createCamera(camera, controls);
const ui = createControls(playback, document.getElementById('controls'));
const camPanel = createCameraPanel(cameraApi);

function animate() {
  requestAnimationFrame(animate);
  playback.update();
  cameraApi.update();
  ui.update();
  camPanel.update();
  controls.update();
  renderer.render(scene, camera);
}

animate();
