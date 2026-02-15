import * as THREE from 'three';
import { BONE_MAP } from './retarget.js';

const DSL_BONES = Object.values(BONE_MAP);
const HIP_BONE = 'hip';

export function generate(skeleton, clip, interval) {
  // Build sample times: use track's native times when no interval given
  const trackTimes = clip.tracks[0].times;
  let sampleTimes;
  if (interval === undefined) {
    sampleTimes = Array.from(trackTimes);
    interval = trackTimes.length > 1 ? trackTimes[1] - trackTimes[0] : 0.0333;
  } else {
    sampleTimes = [];
    const duration = clip.duration;
    for (let t = 0; t <= duration + interval * 0.01; t += interval) {
      sampleTimes.push(Math.min(t, duration));
    }
  }

  const root = new THREE.Object3D();
  for (const bone of skeleton.bones) {
    if (!bone.parent || !skeleton.bones.includes(bone.parent)) {
      root.add(bone);
    }
  }

  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.play();

  const duration = clip.duration;
  const lines = [`# Pirouette`, `duration ${duration.toFixed(4)}`, `frametime ${interval.toFixed(6)}`, ''];

  const boneByName = new Map();
  for (const bone of skeleton.bones) {
    if (DSL_BONES.includes(bone.name)) {
      boneByName.set(bone.name, bone);
    }
  }

  const euler = new THREE.Euler();
  const RAD2DEG = 180 / Math.PI;

  for (const sampleTime of sampleTimes) {
    mixer.setTime(sampleTime);

    lines.push(`@${sampleTime.toFixed(4)}`);

    for (const name of DSL_BONES) {
      const bone = boneByName.get(name);
      if (!bone) continue;

      euler.setFromQuaternion(bone.quaternion, 'ZXY');
      const rz = (euler.z * RAD2DEG).toFixed(1);
      const rx = (euler.x * RAD2DEG).toFixed(1);
      const ry = (euler.y * RAD2DEG).toFixed(1);

      if (name === HIP_BONE) {
        const px = bone.position.x.toFixed(1);
        const py = bone.position.y.toFixed(1);
        const pz = bone.position.z.toFixed(1);
        lines.push(`  ${name}       pos ${px} ${py} ${pz}  rot ${rz} ${rx} ${ry}`);
      } else {
        lines.push(`  ${name.padEnd(10)} rot ${rz} ${rx} ${ry}`);
      }
    }

    lines.push('');
  }

  action.stop();
  mixer.uncacheAction(clip);

  return lines.join('\n');
}

export function parse(text) {
  const lines = text.split('\n');
  let duration = 0;
  const keyframes = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('duration ')) {
      duration = parseFloat(line.slice(9));
      continue;
    }

    if (line.startsWith('frametime ')) {
      continue;
    }

    if (line.startsWith('@')) {
      current = { time: parseFloat(line.slice(1)), bones: {} };
      keyframes.push(current);
      continue;
    }

    if (!current) continue;

    const tokens = line.split(/\s+/);
    const boneName = tokens[0];
    const bone = {};

    let i = 1;
    while (i < tokens.length) {
      if (tokens[i] === 'pos') {
        bone.pos = [parseFloat(tokens[i+1]), parseFloat(tokens[i+2]), parseFloat(tokens[i+3])];
        i += 4;
      } else if (tokens[i] === 'rot') {
        bone.rot = [parseFloat(tokens[i+1]), parseFloat(tokens[i+2]), parseFloat(tokens[i+3])];
        i += 4;
      } else {
        i++;
      }
    }

    current.bones[boneName] = bone;
  }

  return { duration, keyframes };
}

export function compile(parsed, referenceSkeleton) {
  const { duration, keyframes } = parsed;
  const DEG2RAD = Math.PI / 180;
  const tracks = [];

  const boneNames = new Set();
  for (const kf of keyframes) {
    for (const name of Object.keys(kf.bones)) {
      boneNames.add(name);
    }
  }

  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();

  for (const boneName of boneNames) {
    const times = [];
    const quatValues = [];
    const posValues = [];
    let hasPos = false;

    for (const kf of keyframes) {
      const bone = kf.bones[boneName];
      if (!bone || !bone.rot) continue;

      times.push(kf.time);

      euler.set(bone.rot[1] * DEG2RAD, bone.rot[2] * DEG2RAD, bone.rot[0] * DEG2RAD, 'ZXY');
      quat.setFromEuler(euler);
      quatValues.push(quat.x, quat.y, quat.z, quat.w);

      if (bone.pos) {
        hasPos = true;
        posValues.push(bone.pos[0], bone.pos[1], bone.pos[2]);
      }
    }

    if (times.length > 0) {
      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        times,
        new Float32Array(quatValues)
      ));

      if (hasPos) {
        tracks.push(new THREE.VectorKeyframeTrack(
          `${boneName}.position`,
          times,
          new Float32Array(posValues)
        ));
      }
    }
  }

  const clip = new THREE.AnimationClip('dsl', duration, tracks);
  return { skeleton: referenceSkeleton, clip };
}
