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
- Hip scale derived from data: `targetHipBone.position.y / sourceHipTrack.values[1]`.
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
- Resize handler installed on window.

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

## camera.js

| | |
|---|---|
| **Input** | `camera: THREE.PerspectiveCamera`, `controls: OrbitControls` |
| **Output** | `{ setPreset(name), getPreset(), getAzimuth(), setAzimuth(angle), update() }` |
| **Tests** | `camera.test.js` |

**Presets (all cm):**

| Name | Position | Target |
|------|----------|--------|
| front | (0, 350, -500) | (0, 30, 0) |
| back | (0, 350, 500) | (0, 30, 0) |
| side | (500, 350, 0) | (0, 30, 0) |
| top | (0, 600, 1) | (0, 0, 0) |
| close | (0, 220, -250) | (0, 70, 0) |

**Invariants**
- `update()` lerps camera position and controls target toward preset destination.
- Transition stops when distance < 0.5 cm (snaps to exact position).
- Manual orbit (OrbitControls `start` event) clears the active preset — `getPreset()` returns `null`.
- `setPreset()` with an invalid name is a no-op.
- `getAzimuth()` returns `atan2(offset.x, offset.z)` — the azimuthal angle (theta) of the camera relative to target.
- `setAzimuth(angle)` rotates the camera around the target at the current distance and elevation. Clears active preset.

## ui/controls.js

| | |
|---|---|
| **Input** | `playback: PlaybackHandle`, `container: HTMLElement` |
| **Output** | `{ update(): void, dispose(): void }` |
| **Tests** | `ui/controls.test.js` |

**DOM elements:** play/pause button, speed slider (0.25x–2x), time scrubber (0 to duration).

**Invariants**
- Reads/writes only through playback API. No direct mixer/action/clock access.
- `update()` syncs scrubber position from `playback.getTime()` and play button text. Called from render loop.
- `dispose()` removes all DOM elements and event listeners.
- All elements appended to `container`, not document.body.

## ui/cameraPanel.js

| | |
|---|---|
| **Input** | `camera: CameraHandle` |
| **Output** | `{ update(): void, dispose(): void }` |
| **Tests** | `ui/cameraPanel.test.js` |

**DOM:** Circular view control widget (`position: fixed; bottom-right`), appended to `document.body`.

**Invariants**
- 4 direction buttons (F/B/S/T) at cardinal positions around a circular dark background.
- Center dot button snaps to `close` preset.
- Click a direction button: calls `camera.setPreset()` for that view.
- `update()` toggles `.active` class on buttons matching `camera.getPreset()`.
- `dispose()` removes widget from DOM.
- Talks only through camera API (`setPreset`, `getPreset`), no direct Three.js access.

## ui/scriptPanel.js

| | |
|---|---|
| **Input** | (none) |
| **Output** | `{ getText(), setText(text), onChange(callback), update(), dispose() }` |
| **Tests** | `ui/scriptPanel.test.js` |

**Invariants**
- Textarea editor for DSL text with line number gutter.
- Left-edge drag handle for resizing (min 200px, max 60% viewport).
- Collapse/expand toggle button in header.
- Tab key inserts 2 spaces.
- `onChange(callback)` fires with 300ms debounce after user input.
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
- Creates camera API via `createCamera(camera, controls)`.
- Creates UI via `createControls(playback, container)`.
- Creates camera panel via `createCameraPanel(cameraApi)`.
- Render loop: `playback.update`, `cameraApi.update`, `ui.update`, `camPanel.update`, `controls.update`, `renderer.render`.

## Rules for adding modules

1. Define the contract (input, output, invariants) before writing code.
2. One module, one contract. If it needs two, split it.
3. Tests validate against real assets. No mocking the code's own constants.
4. `main.js` stays pure wiring. New logic goes in new modules.
5. No unit conversions in loaders or glue. Set boundaries to match the data.
6. Update this file when a contract changes. Tests update first, code second.
