import * as THREE from 'three';

export const BONE_MAP = {
  'mixamorigHips':           'hip',
  'mixamorigSpine':          'abdomen',
  'mixamorigSpine2':         'chest',
  'mixamorigNeck':           'neck',
  'mixamorigHead':           'head',
  'mixamorigLeftShoulder':   'lCollar',
  'mixamorigLeftArm':        'lShldr',
  'mixamorigLeftForeArm':    'lForeArm',
  'mixamorigLeftHand':       'lHand',
  'mixamorigRightShoulder':  'rCollar',
  'mixamorigRightArm':       'rShldr',
  'mixamorigRightForeArm':   'rForeArm',
  'mixamorigRightHand':      'rHand',
  'mixamorigLeftUpLeg':      'lThigh',
  'mixamorigLeftLeg':        'lShin',
  'mixamorigLeftFoot':       'lFoot',
  'mixamorigRightUpLeg':     'rThigh',
  'mixamorigRightLeg':       'rShin',
  'mixamorigRightFoot':      'rFoot',
};

// Reverse map: BVH bone name → target bone name
const REVERSE_BONE_MAP = Object.fromEntries(
  Object.entries(BONE_MAP).map(([k, v]) => [v, k])
);

let cachedTargetHipY = null;

export function retargetAnimation(targetMesh, sourceSkeleton, sourceClip) {
  const targetHipBone = targetMesh.skeleton.bones.find(b => BONE_MAP[b.name] === 'hip');
  if (cachedTargetHipY === null) {
    cachedTargetHipY = targetHipBone.position.y;
  }
  const sourceHipTrack = sourceClip.tracks.find(t => t.name.endsWith('.position'));
  const hipScale = cachedTargetHipY / sourceHipTrack.values[1];

  // Both skeletons are Mixamo-compatible (same rest pose / bone local frames),
  // so source local rotations apply directly as target local rotations.
  // Just rename tracks from BVH names to target .bones[name] format and
  // scale hip position.
  const tracks = [];
  for (const track of sourceClip.tracks) {
    const dotIdx = track.name.indexOf('.');
    const boneName = track.name.substring(0, dotIdx);
    const prop = track.name.substring(dotIdx + 1);
    const targetName = REVERSE_BONE_MAP[boneName];
    if (!targetName) continue;

    const newName = `.bones[${targetName}].${prop}`;

    if (prop === 'position') {
      const scaled = new Float32Array(track.values.length);
      for (let i = 0; i < track.values.length; i++) {
        scaled[i] = track.values[i] * hipScale;
      }
      tracks.push(new THREE.VectorKeyframeTrack(newName, track.times, scaled));
    } else {
      const renamed = track.clone();
      renamed.name = newName;
      tracks.push(renamed);
    }
  }

  return new THREE.AnimationClip('dsl', sourceClip.duration, tracks);
}
