import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const BONE_MAP = {
  mixamorigHips:           'hip',
  mixamorigSpine:          'abdomen',
  mixamorigSpine2:         'chest',
  mixamorigNeck:           'neck',
  mixamorigHead:           'head',
  mixamorigLeftShoulder:   'lCollar',
  mixamorigLeftArm:        'lShldr',
  mixamorigLeftForeArm:    'lForeArm',
  mixamorigLeftHand:       'lHand',
  mixamorigRightShoulder:  'rCollar',
  mixamorigRightArm:       'rShldr',
  mixamorigRightForeArm:   'rForeArm',
  mixamorigRightHand:      'rHand',
  mixamorigLeftUpLeg:      'lThigh',
  mixamorigLeftLeg:        'lShin',
  mixamorigLeftFoot:       'lFoot',
  mixamorigRightUpLeg:     'rThigh',
  mixamorigRightLeg:       'rShin',
  mixamorigRightFoot:      'rFoot',
};

export function retargetAnimation(targetMesh, sourceSkeleton, sourceClip) {
  const options = {
    names: BONE_MAP,
    scale: 1,
  };

  return SkeletonUtils.retargetClip(targetMesh, sourceSkeleton, sourceClip, options);
}
