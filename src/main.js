import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';
import { createPlayback } from './playback.js';
import { generate, parse, compile } from './dsl.js';
import { createFaceCamera } from './faceCamera.js';
import { createViewport } from './viewport.js';
import { createTimeline } from './ui/timeline.js';
import { createScriptPanel } from './ui/scriptPanel.js';

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const { skeleton: bvhSkeleton, clip: bvhClip } = await loadBVH('/assets/pirouette.bvh');
const character = await loadCharacter('/assets/character.glb');
scene.add(character.model);

const dslText = generate(bvhSkeleton, bvhClip, 1/30);

const parsed = parse(dslText);
const { skeleton: compiledSkel, clip: compiledClip } = compile(parsed, bvhSkeleton);
const initialClip = retargetAnimation(character.mesh, compiledSkel, compiledClip);

const playback = createPlayback(character.mesh, initialClip);

const timeline = createTimeline(playback, document.getElementById('timeline'));
timeline.setKeyframes(parsed);

const scriptPanel = createScriptPanel();
scriptPanel.setText(dslText);

scriptPanel.onChange((text) => {
  try {
    const p = parse(text);
    const { skeleton: s, clip: c } = compile(p, bvhSkeleton);
    const retClip = retargetAnimation(character.mesh, s, c);
    playback.setClip(retClip);
    timeline.setKeyframes(p);
    scriptPanel.showStatus('Applied', '#4f4');
  } catch (e) {
    console.error('DSL compile error:', e);
    scriptPanel.showStatus('Error', '#f44');
  }
});

const headBone = character.mesh.skeleton.bones.find(b => b.name === 'mixamorigHead');
const faceView = createFaceCamera(headBone);
const viewport = createViewport(
  renderer, canvas,
  [camera, faceView.camera, null, null],
  scene, controls,
  [null, (dy) => faceView.zoom(dy), null, null]
);

function animate() {
  requestAnimationFrame(animate);
  playback.update();
  timeline.update();
  controls.update();
  faceView.update();
  viewport.render();
}

animate();
