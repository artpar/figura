import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

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

export function retargetAnimation(targetMesh, sourceSkeleton, sourceClip) {
  const targetHipBone = targetMesh.skeleton.bones.find(b => BONE_MAP[b.name] === 'hip');
  const sourceHipTrack = sourceClip.tracks.find(t => t.name.endsWith('.position'));
  const scale = targetHipBone.position.y / sourceHipTrack.values[1];

  const options = {
    names: BONE_MAP,
    scale,
  };

  return SkeletonUtils.retargetClip(targetMesh, sourceSkeleton, sourceClip, options);
}
