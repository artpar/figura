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
  ├── camera.js           → { setPreset, getPreset, getAzimuth, setAzimuth, update }
  ├── ui/controls.js      → { update, dispose }
  ├── ui/cameraPanel.js   → { update, dispose }
  └── ui/scriptPanel.js   → { getText, setText, onChange, update, dispose }
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
- `ui/controls.js` — DOM controls that talk only through playback API

### Phase 2: BVH Motion DSL (done)
- `dsl.js` — generate/parse/compile DSL from BVH data, editable in script panel
- `playback.js` — added `setClip()` for hot-swapping clips
- `ui/scriptPanel.js` — simplified to DSL textarea (removed move chips)
- Deleted `routine.js` and `moveLibrary.js` (premature abstractions)

### Phase 3: Polish (done — camera presets)
- `camera.js` — camera preset API with smooth lerp transitions (front, back, side, top, close)
- `ui/cameraPanel.js` — floating button panel (top-right), highlights active preset
- `ui/controls.js` reverted to `(playback, container)` — playback only
- IK deferred

### Phase 4: Future
- Animation quality: rest-pose offset corrections, crossfade/blending
- `ik.js` — post-process skeleton per frame (foot contact, ground locking)

## Test commands

- `npm test` — runs vitest, 78 tests, ~1.5s, no browser needed
- `npm run dev` — vite dev server with hot reload
