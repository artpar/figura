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

**Invariants**
- Mixer created on `mesh` (SkinnedMesh), not Group.
- Clock is internal — `update()` encapsulates `clock.getDelta()` → `mixer.update(delta)`.
- `play()`/`pause()` use `action.paused` property.
- Speed sets `action.timeScale` (per-action, not per-mixer).
- Time is always in seconds.

## ui/controls.js

| | |
|---|---|
| **Input** | `playback: PlaybackHandle`, `container: HTMLElement` |
| **Output** | `{ update(): void, dispose(): void }` |
| **Tests** | `ui/controls.test.js` |

**DOM elements:** play/pause button, speed slider (0.25x–2x), time scrubber (0 to duration).

**Invariants**
- Reads/writes only through playback API. No direct mixer/action/clock access.
- `update()` syncs scrubber position from `playback.getTime()`. Called from render loop.
- `dispose()` removes all DOM elements and event listeners.
- All elements appended to `container`, not document.body.

## main.js

| | |
|---|---|
| **Role** | Orchestrator — wires modules together |
| **Tests** | Manual/visual only |

**Invariants**
- No logic, no transforms, no conditionals.
- Loads assets via `bvh.js` and `character.js`.
- Passes outputs to `retarget.js`, then to `playback.js`.
- Creates playback via `createPlayback(mesh, clip)`.
- Creates UI via `createControls(playback, container)`.
- Render loop: `playback.update`, `ui.update`, `controls.update`, `renderer.render`.

## Rules for adding modules

1. Define the contract (input, output, invariants) before writing code.
2. One module, one contract. If it needs two, split it.
3. Tests validate against real assets. No mocking the code's own constants.
4. `main.js` stays pure wiring. New logic goes in new modules.
5. No unit conversions in loaders or glue. Set boundaries to match the data.
6. Update this file when a contract changes. Tests update first, code second.
