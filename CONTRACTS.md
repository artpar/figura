# Figura — Module Contracts

Every module has one contract. If a feature needs two contracts, it's two modules.

## bvh.js

| | |
|---|---|
| **Input** | URL to a `.bvh` file |
| **Output** | `{ skeleton: THREE.Skeleton, clip: THREE.AnimationClip }` |
| **Tests** | `bvh.test.js` |

**Invariants**
- No unit transforms. Data stays in the BVH file's native units (cm).
- `skeleton.bones[0].updateMatrixWorld(true)` called before returning.
- No filtering, renaming, or reordering of bones or tracks.

## character.js

| | |
|---|---|
| **Input** | URL to a `.glb` file |
| **Output** | `{ model: THREE.Group, mesh: THREE.SkinnedMesh }` |
| **Tests** | `character.test.js` |

**Invariants**
- `mesh` is the first SkinnedMesh found via traversal. Has `.skeleton` with `.bones`.
- `frustumCulled = false` on every SkinnedMesh.
- `model.scale.setScalar(100)` applied — compensates Armature's 0.01 export scale so bones land in cm world space.
- `model.updateMatrixWorld(true)` called after scale — no stale matrices on output.
- Armature scale and SkinnedMesh binding left untouched. They are internally consistent.

## retarget.js

| | |
|---|---|
| **Input** | `targetMesh: THREE.SkinnedMesh`, `sourceSkeleton: THREE.Skeleton`, `sourceClip: THREE.AnimationClip` |
| **Output** | `THREE.AnimationClip` (retargeted for target skeleton) |
| **Tests** | `retarget.test.js` |

**Invariants**
- `targetMesh` must be a SkinnedMesh (not a Group). Has `.skeleton.bones`.
- `BONE_MAP` keys are target (GLB) bone names. Values are source (BVH) bone names.
- Every BONE_MAP key exists in the real GLB skeleton. Every BONE_MAP value exists in the real BVH skeleton.
- Both skeletons are Mixamo-compatible (same rest pose / bone local frames). Source local rotations apply directly as target local rotations — no rest-pose correction needed.
- Direct track rename: BVH bone names → `.bones[targetName].property` format. No SkeletonUtils dependency.
- Hip position tracks scaled by `targetHipBone.position.y / sourceHipTrack.values[1]`.
- Output clip has `duration > 0`, tracks in cm-scale.

## scene.js

| | |
|---|---|
| **Input** | `canvas: HTMLCanvasElement` |
| **Output** | `{ scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls }` |
| **Tests** | `scene.test.js` |

**Invariants**
- All boundaries (camera near/far, position, controls target, ground size, light positions, shadow camera) are in cm.
- Camera near >= 1 cm, far >= 10000 cm.
- Ground plane >= 100 cm.
- No resize handler — caller (viewport.js) manages resize.

## playback.js

| | |
|---|---|
| **Input** | `mesh: THREE.SkinnedMesh`, `clip: THREE.AnimationClip` |
| **Output** | Playback handle (object with methods) |
| **Tests** | `playback.test.js` |

**API:**

| Method | Returns | Description |
|--------|---------|-------------|
| `update()` | void | Read clock delta, call `mixer.update()`. Called once per frame. |
| `play()` | void | Resume playback. Idempotent. |
| `pause()` | void | Freeze playback. Idempotent. |
| `isPlaying()` | boolean | `true` when animation is advancing. |
| `setSpeed(n)` | void | Set playback speed multiplier. |
| `getSpeed()` | number | Current speed multiplier. |
| `getTime()` | number | Current playback time in seconds. |
| `setTime(t)` | void | Seek to time `t`. Clamps to `[0, duration]`. |
| `getDuration()` | number | Clip duration in seconds. |
| `setClip(clip)` | void | Stop current action, uncache it, play new clip. Preserves speed. |

**Invariants**
- Mixer created on `mesh` (SkinnedMesh), not Group.
- Clock is internal — `update()` encapsulates `clock.getDelta()` → `mixer.update(delta)`.
- `play()`/`pause()` use `action.paused` property.
- Speed sets `action.timeScale` (per-action, not per-mixer).
- Time is always in seconds.
- `setClip()` stops the old action, uncaches it, creates a new action for the new clip, preserves speed, and auto-plays.

## dsl.js

| | |
|---|---|
| **Input** | See individual functions |
| **Output** | See individual functions |
| **Tests** | `dsl.test.js` |

**Functions:**

| Function | Input | Output |
|----------|-------|--------|
| `generate(skeleton, clip, interval?)` | BVH skeleton + clip | DSL text string |
| `parse(text)` | DSL text string | `{ duration, keyframes: [{ time, bones }] }` |
| `compile(parsed, referenceSkeleton)` | Parsed DSL + skeleton | `{ skeleton, clip }` |

**Invariants**
- `generate` defaults to native frame rate (reads `clip.tracks[0].times`). Explicit `interval` overrides.
- Rotations in Euler ZXY degrees (matching BVH channel order). Positions in cm.
- Only the 19 `BONE_MAP` bones are included. Hip gets `pos` + `rot`, others get `rot` only.
- DSL header: `duration`, `frametime`. Keyframes start with `@<time>`.
- `parse` is pure string parsing — no Three.js dependency. Comments (`#`), `frametime`, and empty lines are ignored.
- `compile` converts Euler degrees back to quaternions (ZXY order) and builds `QuaternionKeyframeTrack` + `VectorKeyframeTrack` (hip).
- Round-trip fidelity at native frame rate: max 0.11° rotation error, 0.07 cm position error.
- Track names use BVH bone names: `boneName.quaternion`, `hip.position`.

## faceCamera.js

| | |
|---|---|
| **Input** | `headBone: THREE.Bone` |
| **Output** | `{ camera: THREE.PerspectiveCamera, update(): void, zoom(deltaY): void }` |
| **Tests** | `faceCamera.test.js` |

**Invariants**
- PerspectiveCamera with FOV 50, near=1, far=5000 (cm-scale).
- `update()` reads head bone world position/quaternion, places camera ~140cm in front of face.
- Camera looks at eye level (~5cm above head center).
- No unit conversions — head bone world position is already in cm.
- Aspect ratio set externally by viewport.js.
- `zoom(deltaY)` adjusts camera distance (multiplicative, clamped 40–500cm). Positive = zoom out.
- `FACE_FORWARD_LOCAL` defines which local axis is the face direction (empirically determined per skeleton).

## viewport.js

| | |
|---|---|
| **Input** | `renderer, canvas, cameras: Array<Camera|null>[4], scene, controls, onWheel?: Array<fn|null>[4]` |
| **Output** | `{ render(): void, dispose(): void }` |
| **Tests** | `viewport.test.js` |

**Invariants**
- 2x2 grid: cameras[0] top-left, [1] top-right, [2] bottom-left, [3] bottom-right.
- Null entries are skipped (empty quadrant, cleared background).
- `cameras[0]` is the interactive orbit camera — OrbitControls only active in top-left quadrant.
- `render()` uses `setScissor()`/`setViewport()` to render each non-null camera on a single canvas.
- Reads dimensions from `canvas.parentElement` (container). ResizeObserver auto-relayouts on container size changes.
- `onWheel` array routes scroll events to per-quadrant callbacks (e.g. face camera zoom).
- OrbitControls gated: capture-phase `pointerdown` disables controls outside top-left quadrant, `pointerup` re-enables.
- 6px draggable separator cross (horizontal + vertical `<div>`s). Drag to resize quadrants (clamped 15%–85%).
- `dispose()` removes resize listener, drag listeners, pointer listeners, and separators.

## ui/timeline.js

| | |
|---|---|
| **Input** | `playback: PlaybackHandle`, `container: HTMLElement` |
| **Output** | `{ setKeyframes(parsed): void, update(): void, dispose(): void }` |
| **Tests** | `ui/timeline.test.js` |

**Also exports:** `computeWaveforms(parsed)` — pure function for testing.

**DOM:** Transport bar (play/pause, time display, speed select) + canvas (time ruler, 5 body-group waveform lanes, playhead).

**Body groups:** Spine (hip/abdomen/chest/neck/head), L Arm, R Arm, L Leg, R Leg — each with a distinct color.

**Invariants**
- Reads/writes only through playback API. No direct mixer/action/clock access.
- `setKeyframes(parsed)` recomputes waveforms from parsed DSL data (rotation deltas per group, normalized to [0,1]).
- `update()` redraws canvas (playhead, transport state). Called from render loop.
- Click/drag on canvas scrubs via `playback.setTime()`.
- `dispose()` removes all DOM elements and event listeners.
- All elements appended to `container`, not document.body.

## ui/scriptPanel.js

| | |
|---|---|
| **Input** | (none) |
| **Output** | `{ getText(), setText(text), onChange(callback), showStatus(text, color), update(), dispose() }` |
| **Tests** | `ui/scriptPanel.test.js` |

**Invariants**
- Textarea editor for DSL text with line number gutter.
- Left-edge drag handle for resizing (min 200px, max 60% viewport).
- Collapse/expand toggle button in header.
- Tab key inserts 2 spaces.
- `onChange(callback)` fires with 300ms debounce after user input.
- `showStatus(text, color)` displays a status indicator in the header that fades after 1.2s.
- Appended to `document.body`.
- `dispose()` removes panel from DOM and cleans up document-level event listeners.

## main.js

| | |
|---|---|
| **Role** | Orchestrator — wires modules together |
| **Tests** | Manual/visual only |

**Invariants**
- No logic, no transforms, no conditionals.
- Loads BVH via `bvh.js`, character via `character.js`.
- Generates DSL text from BVH skeleton+clip via `dsl.generate()`.
- DSL text is the single source of truth. Both initial load and edits go through the same path: `parse → compile → retarget → playback`.
- Shows DSL in script panel. On edit: `parse → compile → retarget → playback.setClip()`.
- Finds `mixamorigHead` bone and creates face camera via `createFaceCamera(headBone)`.
- Creates viewport via `createViewport(renderer, canvas, [cameras...], scene, controls, [onWheel...])`.
- Creates timeline via `createTimeline(playback, container)`. Calls `timeline.setKeyframes(parsed)` on initial load and DSL edits.
- Render loop: `playback.update`, `timeline.update`, `controls.update`, `faceView.update`, `viewport.render`.

## Rules for adding modules

1. Define the contract (input, output, invariants) before writing code.
2. One module, one contract. If it needs two, split it.
3. Tests validate against real assets. No mocking the code's own constants.
4. `main.js` stays pure wiring. New logic goes in new modules.
5. No unit conversions in loaders or glue. Set boundaries to match the data.
6. Update this file when a contract changes. Tests update first, code second.
