# Figura — Project Rules

## Architecture

See `CONTRACTS.md` for module contracts. Every module has one job and one tested contract.

```
main.js (orchestrator — wiring only, no logic)
  ├── scene.js            → { scene, camera, renderer, controls }
  ├── bvh.js              → { skeleton, clip }
  ├── character.js        → { model, mesh }
  ├── retarget.js         → AnimationClip
  ├── dsl.js              → { generate, parse, compile }
  ├── playback.js         → { update, play, pause, isPlaying, setSpeed, getSpeed, getTime, setTime, getDuration, setClip }
  ├── faceCamera.js       → { camera, update, zoom }
  ├── viewport.js         → { render, dispose }
  ├── ui/timeline.js      → { setKeyframes, update, dispose }
  └── ui/scriptPanel.js   → { getText, setText, onChange, showStatus, update, dispose }
```

## Unit system

Everything is in centimeters. BVH data is cm. GLB bone positions are cm. GLB mesh vertices are meters but the Armature 0.01 scale bridges them — do not touch it. `model.scale.setScalar(100)` compensates so bones are in cm world space. Scene boundaries (camera, clipping, ground, lights) are set to cm.

**Never convert units in loaders or glue code.** If two data sources are in the same units, leave them alone. Set boundaries to match data.

## Rules

1. **Contract first.** Before adding a feature, identify which module it touches. If it changes a contract, update CONTRACTS.md and tests before code.
2. **One module, one contract.** If a feature needs two responsibilities, make two modules.
3. **main.js is wiring only.** No logic, no transforms, no conditionals. New logic goes in new modules.
4. **Test against real assets.** Tests parse real BVH/GLB files. Never validate against data derived from the code under test.
5. **Read library source before calling it.** Especially for functions where objects cross boundaries (our code → library code). Don't guess from function names.
6. **No dual paths.** Single source of truth. No feature flags or backwards-compatibility shims — change the code directly.
7. **UI never touches Three.js directly.** UI modules talk through module APIs (e.g. playback), not raw mixer/scene/renderer objects.

## Roadmap

### Phase 1: Playback control (done)
- `playback.js` — mixer extracted from main.js, exposes play/pause/speed/time API
- `ui/timeline.js` — DAW-style timeline panel with body-group waveform tracks, transport controls, and scrubbing (replaced `ui/controls.js`)

### Phase 2: BVH Motion DSL (done)
- `dsl.js` — generate/parse/compile DSL from BVH data, editable in script panel
- `playback.js` — added `setClip()` for hot-swapping clips
- `ui/scriptPanel.js` — simplified to DSL textarea (removed move chips)
- Deleted `routine.js` and `moveLibrary.js` (premature abstractions)

### Phase 3: Polish (done)
- IK deferred

### Phase 4: Split-pane face camera (done)
- `faceCamera.js` — face-tracking camera that follows head bone, scroll-to-zoom
- `viewport.js` — scissor-based 2x2 grid with draggable dividers, ResizeObserver-driven layout
- `scene.js` — resize handler removed (viewport.js owns it now)
- `index.html` — flex layout: canvas-wrap + script panel as siblings (panel owns its space)

### Phase 5: DAW-style timeline (done)
- `ui/timeline.js` — replaces `ui/controls.js` with a permanent bottom panel
- Transport bar: play/pause, time display (MM:SS.cc), speed select (0.25x–2x)
- Canvas: time ruler, 5 body-group waveform lanes (Spine, L/R Arm, L/R Leg), sweeping playhead
- Waveform = per-group sum of frame-to-frame rotation deltas, normalized to [0,1]
- Click/drag scrubbing on canvas
- `index.html` — `#main-col` column wrapper stacks viewport + timeline; `#canvas-wrap` unchanged for viewport.js
- Removed `camera.js` and `ui/cameraPanel.js` (camera preset widget)

### Phase 6: Future
- Animation quality: rest-pose offset corrections, crossfade/blending
- `ik.js` — post-process skeleton per frame (foot contact, ground locking)

## Test commands

- `npm test` — runs vitest, 97 tests, ~1.5s, no browser needed
- `npm run dev` — vite dev server with hot reload
