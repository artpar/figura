import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';
import { createPlayback } from './playback.js';
import { generate, parse, compile } from './dsl.js';
import { createCamera } from './camera.js';
import { createControls } from './ui/controls.js';
import { createCameraPanel } from './ui/cameraPanel.js';
import { createScriptPanel } from './ui/scriptPanel.js';

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const { skeleton: bvhSkeleton, clip: bvhClip } = await loadBVH('/assets/pirouette.bvh');
const character = await loadCharacter('/assets/character.glb');
scene.add(character.model);

const dslText = generate(bvhSkeleton, bvhClip);

function clipFromDSL(text) {
  const parsed = parse(text);
  const { skeleton, clip } = compile(parsed, bvhSkeleton);
  return retargetAnimation(character.mesh, skeleton, clip);
}

const playback = createPlayback(character.mesh, clipFromDSL(dslText));

const scriptPanel = createScriptPanel();
scriptPanel.setText(dslText);

scriptPanel.onChange((text) => {
  playback.setClip(clipFromDSL(text));
});

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
