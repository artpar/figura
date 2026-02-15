import { createScene } from './scene.js';
import { loadBVH } from './bvh.js';
import { loadCharacter } from './character.js';
import { retargetAnimation } from './retarget.js';
import { createPlayback } from './playback.js';
import { generate, parse as dslParse, compile, lineForTime } from './dsl.js';
import { parse as hdslParse, expand, indexLines } from './hdsl.js';
import { create as createClipLibrary } from './clipLibrary.js';
import { createFaceCamera } from './faceCamera.js';
import { createViewport } from './viewport.js';
import { createTimeline } from './ui/timeline.js';
import { createScriptPanel } from './ui/scriptPanel.js';
import { examples } from './examples.js';

const base = import.meta.env.BASE_URL;

const canvas = document.getElementById('viewport');
const { scene, camera, renderer, controls } = createScene(canvas);

const character = await loadCharacter(`${base}assets/character.glb`);
scene.add(character.model);

const lib = createClipLibrary();

// Load a BVH source, register in library, return its skeleton
async function loadSource(name) {
  const { skeleton, clip } = await loadBVH(`${base}assets/${name}.bvh`);
  const dslText = generate(skeleton, clip, 1 / 30);
  lib.register(name, dslParse(dslText));
  return skeleton;
}

// Load initial source
const bvhSkeleton = await loadSource('pirouette');

// Compile HDSL text → retargeted AnimationClip + low-level parsed data
async function compilePipeline(text) {
  const hdsl = hdslParse(text);

  // Load any new sources
  for (const name of hdsl.sources) {
    if (!lib.has(name)) await loadSource(name);
  }

  const lowDsl = expand(hdsl, lib);
  const parsed = dslParse(lowDsl);
  const { skeleton: s, clip: c } = compile(parsed, bvhSkeleton);
  const retClip = retargetAnimation(character.mesh, s, c);
  return { clip: retClip, parsed };
}

const defaultScript = examples[0].script;

const { clip: initialClip, parsed: initialParsed } = await compilePipeline(defaultScript);

const playback = createPlayback(character.mesh, initialClip);

const timeline = createTimeline(playback, document.getElementById('timeline'));
timeline.setKeyframes(initialParsed);

let lineIndex = indexLines(defaultScript);

const scriptPanel = createScriptPanel();
scriptPanel.setText(defaultScript);

scriptPanel.onChange(async (text) => {
  try {
    const { clip: retClip, parsed: p } = await compilePipeline(text);
    playback.setClip(retClip);
    timeline.setKeyframes(p);
    lineIndex = indexLines(text);
    scriptPanel.showStatus('Applied', '#4f4');
  } catch (e) {
    console.error('HDSL compile error:', e);
    scriptPanel.showStatus('Error', '#f44');
  }
});

scriptPanel.setExamples(examples.map(ex => ({ id: ex.id, title: ex.title })));

scriptPanel.onSelectExample(async (id) => {
  const ex = examples.find(e => e.id === id);
  if (!ex) return;
  scriptPanel.setText(ex.script);
  try {
    const { clip: retClip, parsed: p } = await compilePipeline(ex.script);
    playback.setClip(retClip);
    timeline.setKeyframes(p);
    lineIndex = indexLines(ex.script);
    scriptPanel.showStatus('Applied', '#4f4');
  } catch (e) {
    console.error('HDSL compile error:', e);
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
  scriptPanel.scrollToLine(lineForTime(lineIndex, playback.getTime()));
  controls.update();
  faceView.update();
  viewport.render();
}

animate();
