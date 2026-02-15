# Figura — Session Handoff

## What this is

BVH motion capture → GLTF character retargeting pipeline. Loads `pirouette.bvh`, loads `Xbot.glb` (Mixamo-rigged), retargets the animation using `SkeletonUtils.retargetClip`, plays it back in a Three.js viewport with OrbitControls.

## Current state

Rendering fixes applied. Camera, clipping, unit system, and world matrix propagation corrected. Regression test suite added — 21 tests guard the invariants that broke. Run `npm test`.

## Architecture

```
main.js              orchestrator — load, retarget, play, render loop
  scene.js           renderer, camera, lights, ground, OrbitControls, resize
  bvh.js             BVHLoader — no transforms, data stays in native cm
  character.js       GLTFLoader → extracts SkinnedMesh (mesh) + scene (model), applies S(100) + updateMatrixWorld
  retarget.js        bone name map + SkeletonUtils.retargetClip wrapper
  scene.test.js      scene boundary invariants (cm-scale)
  bvh.test.js        BVH data purity (no unit conversions)
  character.test.js  loader contract (frustumCulled, scale, SkinnedMesh)
  retarget.test.js   bone map coverage + output clip validity
```

### Unit system

Everything is in **centimeters** — the native unit of both BVH files and Mixamo GLB exports. No unit conversions anywhere in the pipeline. Scene boundaries (camera, clipping planes, ground, lights) are set to match cm scale.

### Data flow

```
loadBVH(url) → { skeleton, clip }         BVH bones/keyframes in native cm
loadCharacter(url) → { model, mesh }       model=gltf.scene (for scene graph), mesh=SkinnedMesh (for retarget)

scene.add(model)                           adds character to scene
retargetAnimation(mesh, skeleton, clip)    produces new AnimationClip for the character
AnimationMixer(mesh).clipAction(clip)      plays it
```

### Key contract: SkeletonUtils.retargetClip

Source: `node_modules/three/examples/jsm/utils/SkeletonUtils.js`

- `target` must be a SkinnedMesh (has `.skeleton`). NOT a scene Group.
- `source` can be a Skeleton (gets wrapped internally via `getHelperFromSkeleton`).
- `options.names` maps **target bone name → source bone name**. `getBoneName(bone, options)` does `options.names[bone.name]`.
- `options.hip` is compared against the **mapped** name (source side), not the target name. Default `'hip'` is correct for our BVH.
- `options.scale` only affects the **hip position** (lines 139-143 in SkeletonUtils.js). It does NOT scale child bone offsets. With both sources in cm, `scale: 1` is correct.
- Output tracks use `.bones[name].quaternion` / `.bones[name].position` format — mixer root must have `.bones` (SkinnedMesh).

### Bone map (retarget.js)

```
target (Mixamo/GLTF)         → source (BVH)
mixamorigHips                → hip
mixamorigSpine               → abdomen
mixamorigSpine2              → chest
mixamorigNeck                → neck
mixamorigHead                → head
mixamorigLeft/RightShoulder  → l/rCollar
mixamorigLeft/RightArm       → l/rShldr
mixamorigLeft/RightForeArm   → l/rForeArm
mixamorigLeft/RightHand      → l/rHand
mixamorigLeft/RightUpLeg     → l/rThigh
mixamorigLeft/RightLeg       → l/rShin
mixamorigLeft/RightFoot      → l/rFoot
```

Unmapped BVH bones (skipped): `lButtock`, `rButtock`, `leftEye`, `rightEye`, finger joints.

## Bugs found and fixed

| Bug | Symptom | Root cause | Fix |
|-----|---------|------------|-----|
| target type | `TypeError: can't access property "bones"` | Passed `gltf.scene` (Group) as target — has no `.skeleton` | Pass `character.mesh` (the SkinnedMesh) |
| hip name | Hip position track never created — no root motion | `options.hip = 'mixamorigHips'` but comparison uses mapped name `'hip'` | Removed `hip` option — default `'hip'` is correct |
| mixer root | Tracks like `.bones[name].quaternion` unresolvable from Group | `AnimationMixer(character.model)` — Group has no `.bones` | `AnimationMixer(character.mesh)` |
| unit mismatch | Camera 100x too close, far-plane clipping, legs under floor | BVH scaled cm→m but character stayed in cm. retargetClip's `scale` option only affects hip position, not child bone offsets — creates cascading unit mismatch | Removed cm→m conversion from bvh.js. Both sources now in native cm. Scene boundaries set to cm. |
| frustum culling | Limbs disappear when rotating/zooming | SkinnedMesh bounding sphere stays at rest pose. Animated limbs outside it get culled. | `frustumCulled = false` on all SkinnedMesh |
| stale world matrix | Character invisible (rendered ~100m above camera) | `model.scale.setScalar(100)` not followed by `updateMatrixWorld(true)`. Retarget read Armature's stale `S(0.01)` world matrix, inflating hip positions 100x. | Added `model.updateMatrixWorld(true)` after scale |

## Test suite

`npm test` runs vitest with 21 tests across 4 files:

| File | Tests | What it guards |
|------|-------|----------------|
| `scene.test.js` | 5 | Camera near/far, position, controls target, ground size are cm-scale |
| `bvh.test.js` | 4 | Bone offsets and hip track values are cm, not meters. No `*0.01` scaling. |
| `character.test.js` | 5 | `frustumCulled=false`, scale (1,1,1), SkinnedMesh with skeleton. Mocks GLTFLoader, tests real `loadCharacter` traversal. |
| `retarget.test.js` | 5 | Every BONE_MAP name exists in both skeletons. Output clip has duration, tracks, hip position in cm range. |

Tests run in ~500ms with no browser required. BVH tests parse the real `pirouette.bvh` file. Character tests mock GLTFLoader and exercise the real `loadCharacter` code path. Scene tests mock WebGLRenderer and exercise the real `createScene`.

## What to verify next

1. `npm run dev` — page loads without errors
2. Xbot performs pirouette at correct scale (~170cm tall)
3. Root motion present (character moves, not frozen at origin)
4. Limbs track correctly (no T-pose freeze, no 90-degree arm offset)
5. OrbitControls work (mouse drag rotates camera)
6. No limb clipping when orbiting around

## Known risks not yet verified

- **Bone name mismatch**: The BONE_MAP was built from plan assumptions. If Xbot.glb bone names differ from `mixamorig*` convention, retarget will silently produce no animation. Fix: log `character.mesh.skeleton.bones.map(b => b.name)`.
- **Rest pose mismatch**: If BVH rest pose isn't T-pose (or differs from Xbot's T-pose), arms/legs may be offset. Fix: `options.localOffsets` per-bone rotation corrections.

## Assets

- `public/assets/pirouette.bvh` — 746KB, from three.js examples repo
- `public/assets/character.glb` — 2.8MB, Xbot.glb from three.js examples repo
