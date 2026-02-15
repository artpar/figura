# Figura

BVH motion capture retargeted onto a GLTF character in the browser. Built with Three.js.

**[Live Playground](https://artpar.github.io/figura/)**

## What it does

Figura loads a Mixamo-rigged `.glb` character and `.bvh` motion capture files, retargets the animation at runtime, and plays it back in a split-pane 3D viewport with a DAW-style timeline and a live-editable choreography script.

## Features

- **BVH → GLTF retargeting** — direct bone-name mapping, no SkeletonUtils dependency
- **HDSL choreography language** — define sequences with `bpm`, `clip`, `pose`, `@M:B` timing
- **Clip library** — register BVH sources, extract time-range slices
- **Transforms** — mirror (L↔R swap), speed scaling, reverse
- **Pose interpolation** — slerp rotations, lerp positions, easing curves, hold beats
- **DAW timeline** — 5 body-group waveform lanes (Spine, L/R Arm, L/R Leg), scrubbing, transport controls
- **Split viewport** — 2×2 grid with orbit camera and face-tracking close-up
- **Live script editing** — edit HDSL in-browser, hot-compiles on change

## Architecture

```
main.js (orchestrator — wiring only)
  ├── scene.js            → Three.js scene, camera, renderer, controls
  ├── bvh.js              → parse .bvh → skeleton + clip
  ├── character.js         → load .glb → model + skinned mesh
  ├── retarget.js          → retarget clip from BVH skeleton to GLB skeleton
  ├── hdsl.js              → parse/expand high-level choreography DSL
  ├── clipLibrary.js       → register sources, extract time-range slices
  ├── dsl.js               → generate/parse/compile low-level motion DSL
  ├── playback.js          → mixer wrapper: play/pause/speed/seek/setClip
  ├── faceCamera.js        → head-tracking close-up camera
  ├── viewport.js          → scissor-based 2×2 split with draggable dividers
  ├── ui/timeline.js       → DAW-style waveform timeline + transport
  └── ui/scriptPanel.js    → HDSL editor with syntax reference
```

Every module has one contract. See [CONTRACTS.md](CONTRACTS.md) for full specifications.

## Running locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Requires a Mixamo-rigged `.glb` in `public/assets/character.glb` and at least one `.bvh` in `public/assets/`.

## Tests

```bash
npm test
```

141 tests across 14 files. Tests parse real BVH/GLB assets — no mocks.

## HDSL example

```
bpm 120

source pirouette

clip full from pirouette 0.0-2.5
clip intro from pirouette 0.0-1.0

@1:1  clip intro
@3:1  clip full  mirror
@5:1  clip full  speed 0.5
```

- `bpm` sets tempo (4/4 time assumed)
- `source` names a BVH file to load from `/assets/`
- `clip` defines a named time-range slice from a source
- `@M:B` places clips at measure:beat positions
- Modifiers: `mirror`, `speed N`, `reverse`

## Unit system

Everything is in centimeters. BVH data is cm. GLB bone positions are cm. GLB mesh vertices are meters but the Armature's 0.01 scale bridges them. Scene boundaries match cm scale.

## License

MIT
