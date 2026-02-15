/**
 * hdsl.js — High-level motion DSL: parse, expand, indexLines.
 *
 * Pipeline: HDSL text → parse() → expand(parsed, clipLibrary) → low-level DSL text
 */

// Bone pairs for mirror transform
const MIRROR_PAIRS = [
  ['lCollar', 'rCollar'],
  ['lShldr', 'rShldr'],
  ['lForeArm', 'rForeArm'],
  ['lHand', 'rHand'],
  ['lThigh', 'rThigh'],
  ['lShin', 'rShin'],
  ['lFoot', 'rFoot'],
];

const MIRROR_MAP = {};
for (const [l, r] of MIRROR_PAIRS) {
  MIRROR_MAP[l] = r;
  MIRROR_MAP[r] = l;
}

// Easing functions: t ∈ [0,1] → [0,1]
const EASING = {
  'linear': t => t,
  'ease-in': t => t * t,
  'ease-out': t => t * (2 - t),
  'ease-in-out': t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};

/**
 * Parse high-level DSL text into structured data.
 * Pure string parsing — no Three.js dependency.
 */
export function parse(text) {
  const lines = text.split('\n');
  let bpm = 120;
  const sources = [];
  const clips = {};
  const poses = {};
  const sequence = [];

  let currentPose = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      currentPose = null;
      continue;
    }

    // bpm N
    if (line.startsWith('bpm ')) {
      bpm = parseFloat(line.slice(4));
      currentPose = null;
      continue;
    }

    // source name
    if (line.startsWith('source ')) {
      sources.push(line.slice(7).trim());
      currentPose = null;
      continue;
    }

    // clip name from source start-end
    const clipMatch = line.match(/^clip\s+(\S+)\s+from\s+(\S+)\s+(\S+)/);
    if (clipMatch) {
      const [, name, source, range] = clipMatch;
      const [start, end] = range.split('-').map(Number);
      clips[name] = { source, start, end };
      currentPose = null;
      continue;
    }

    // pose name (header line)
    const poseHeaderMatch = line.match(/^pose\s+(\S+)\s*$/);
    if (poseHeaderMatch) {
      const name = poseHeaderMatch[1];
      poses[name] = {};
      currentPose = name;
      continue;
    }

    // Pose bone line (indented): boneName rot z x y
    if (currentPose && poses[currentPose]) {
      const tokens = line.split(/\s+/);
      const boneName = tokens[0];
      const bone = {};
      let i = 1;
      while (i < tokens.length) {
        if (tokens[i] === 'rot') {
          bone.rot = [parseFloat(tokens[i + 1]), parseFloat(tokens[i + 2]), parseFloat(tokens[i + 3])];
          i += 4;
        } else if (tokens[i] === 'pos') {
          bone.pos = [parseFloat(tokens[i + 1]), parseFloat(tokens[i + 2]), parseFloat(tokens[i + 3])];
          i += 4;
        } else {
          i++;
        }
      }
      poses[currentPose][boneName] = bone;
      continue;
    }

    // Sequence entry: @M:B clip/pose name [modifiers...]
    const seqMatch = line.match(/^@(\d+):(\d+)\s+(clip|pose)\s+(.+)/);
    if (seqMatch) {
      const [, measure, beat, type, rest] = seqMatch;
      const tokens = rest.split(/\s+/);
      const name = tokens[0];

      const entry = {
        measure: parseInt(measure),
        beat: parseInt(beat),
        type,
        name,
      };

      // Parse modifiers
      let j = 1;
      while (j < tokens.length) {
        const tok = tokens[j];
        if (tok === 'mirror') {
          entry.mirror = true;
          j++;
        } else if (tok === 'reverse') {
          entry.reverse = true;
          j++;
        } else if (tok === 'speed') {
          entry.speed = parseFloat(tokens[j + 1]);
          j += 2;
        } else if (tok === 'hold') {
          entry.hold = parseFloat(tokens[j + 1]);
          j += 2;
        } else if (EASING[tok]) {
          entry.ease = tok;
          j++;
        } else {
          j++;
        }
      }

      sequence.push(entry);
      currentPose = null;
      continue;
    }

    currentPose = null;
  }

  return { bpm, sources, clips, poses, sequence };
}

/**
 * Convert measure:beat to seconds.
 * Assumes 4/4 time.
 */
function beatToSeconds(measure, beat, bpm) {
  return (measure - 1) * 4 * (60 / bpm) + (beat - 1) * (60 / bpm);
}

/**
 * Mirror a set of keyframes: swap L↔R bone names, negate hip X-pos and Y-rot.
 */
function mirrorKeyframes(keyframes) {
  return keyframes.map(kf => {
    const newBones = {};
    for (const [name, data] of Object.entries(kf.bones)) {
      const mirrorName = MIRROR_MAP[name] || name;
      const newData = { ...data };

      if (newData.rot) {
        newData.rot = [...newData.rot];
      }
      if (newData.pos) {
        newData.pos = [...newData.pos];
      }

      // For hip bone: negate X-position and Y-rotation
      if (name === 'hip') {
        if (newData.pos) newData.pos[0] = -newData.pos[0];
        if (newData.rot) newData.rot[2] = -newData.rot[2]; // Y rotation (rot is [z,x,y])
      }

      newBones[mirrorName] = newData;
    }
    return { time: kf.time, bones: newBones };
  });
}

/**
 * Reverse keyframe order, reassign times forward.
 */
function reverseKeyframes(keyframes) {
  if (keyframes.length === 0) return [];
  const maxTime = keyframes[keyframes.length - 1].time;
  return keyframes.slice().reverse().map((kf, i, arr) => ({
    time: maxTime - kf.time,
    bones: kf.bones,
  }));
}

/**
 * Scale keyframe times by 1/speed.
 */
function scaleKeyframes(keyframes, speed) {
  return keyframes.map(kf => ({
    time: kf.time / speed,
    bones: kf.bones,
  }));
}

/**
 * Slerp between two Euler-as-array [z,x,y] angles (degrees).
 * Convert to quaternion, slerp, convert back.
 */
function slerpEuler(a, b, t) {
  const DEG = Math.PI / 180;
  const RAD = 180 / Math.PI;

  // Euler ZXY to quaternion (matching dsl.js convention: rot[0]=z, rot[1]=x, rot[2]=y)
  const qa = eulerToQuat(a[1] * DEG, a[2] * DEG, a[0] * DEG);
  const qb = eulerToQuat(b[1] * DEG, b[2] * DEG, b[0] * DEG);

  const qr = quatSlerp(qa, qb, t);
  const e = quatToEuler(qr);

  return [e[2] * RAD, e[0] * RAD, e[1] * RAD]; // back to [z,x,y] degrees
}

// Quaternion from Euler ZXY (input: x, y, z in radians) — matches Three.js
function eulerToQuat(x, y, z) {
  const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2);
  const c2 = Math.cos(y / 2), s2 = Math.sin(y / 2);
  const c3 = Math.cos(z / 2), s3 = Math.sin(z / 2);

  return [
    s1 * c2 * c3 - c1 * s2 * s3,  // x
    c1 * s2 * c3 + s1 * c2 * s3,  // y
    c1 * c2 * s3 + s1 * s2 * c3,  // z
    c1 * c2 * c3 - s1 * s2 * s3,  // w
  ];
}

// Quaternion to Euler ZXY (returns [x, y, z] in radians) — matches Three.js via rotation matrix
function quatToEuler([qx, qy, qz, qw]) {
  // Build rotation matrix elements from quaternion
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  const m11 = 1 - (yy + zz), m12 = xy - wz,       m13 = xz + wy;
  const m21 = xy + wz,       m22 = 1 - (xx + zz),  m23 = yz - wx;
  const m31 = xz - wy,       m32 = yz + wx,         m33 = 1 - (xx + yy);

  // ZXY decomposition (matches Three.js Euler.setFromRotationMatrix)
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ex = Math.asin(clamp(m32, -1, 1));
  let ey, ez;
  if (Math.abs(m32) < 0.9999999) {
    ey = Math.atan2(-m31, m33);
    ez = Math.atan2(-m12, m22);
  } else {
    ey = 0;
    ez = Math.atan2(m21, m11);
  }

  return [ex, ey, ez];
}

// Quaternion slerp
function quatSlerp(a, b, t) {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

  // If dot < 0, negate one to take shortest path
  if (dot < 0) {
    b = [-b[0], -b[1], -b[2], -b[3]];
    dot = -dot;
  }

  if (dot > 0.9995) {
    // Linear interpolation for very close quaternions
    const r = [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2]),
      a[3] + t * (b[3] - a[3]),
    ];
    const len = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2] + r[3] * r[3]);
    return [r[0] / len, r[1] / len, r[2] / len, r[3] / len];
  }

  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;

  return [
    wa * a[0] + wb * b[0],
    wa * a[1] + wb * b[1],
    wa * a[2] + wb * b[2],
    wa * a[3] + wb * b[3],
  ];
}

/**
 * Lerp between two position arrays [x,y,z].
 */
function lerpPos(a, b, t) {
  return [
    a[0] + t * (b[0] - a[0]),
    a[1] + t * (b[1] - a[1]),
    a[2] + t * (b[2] - a[2]),
  ];
}

/**
 * Expand high-level DSL into low-level DSL text.
 *
 * @param {object} parsed — output of parse()
 * @param {object} lib — clipLibrary handle
 * @returns {string} low-level DSL text
 */
export function expand(parsed, lib) {
  const { bpm, clips, poses, sequence } = parsed;
  const FRAME_TIME = 1 / 30;

  // Separate clip and pose entries, sorted by time
  const clipEntries = [];
  const poseEntries = [];

  for (const entry of sequence) {
    const time = beatToSeconds(entry.measure, entry.beat, bpm);
    if (entry.type === 'clip') {
      clipEntries.push({ ...entry, time });
    } else if (entry.type === 'pose') {
      poseEntries.push({ ...entry, time });
    }
  }

  clipEntries.sort((a, b) => a.time - b.time);
  poseEntries.sort((a, b) => a.time - b.time);

  // Resolve each clip entry to keyframes placed at absolute time
  const allFrames = new Map(); // time → bones

  for (const entry of clipEntries) {
    const clipDef = clips[entry.name];
    if (!clipDef) continue;

    let slice = lib.extract(clipDef.source, clipDef.start, clipDef.end);
    let keyframes = slice.keyframes;

    if (entry.reverse) keyframes = reverseKeyframes(keyframes);
    if (entry.speed) keyframes = scaleKeyframes(keyframes, entry.speed);
    if (entry.mirror) keyframes = mirrorKeyframes(keyframes);

    for (const kf of keyframes) {
      const absTime = roundTime(entry.time + kf.time);
      if (!allFrames.has(absTime)) {
        allFrames.set(absTime, {});
      }
      const frame = allFrames.get(absTime);
      // Clip provides base — don't overwrite existing pose overrides
      for (const [bone, data] of Object.entries(kf.bones)) {
        frame[bone] = { ...data };
      }
    }
  }

  // Process pose entries — interpolate between consecutive poses
  for (let i = 0; i < poseEntries.length; i++) {
    const curr = poseEntries[i];
    const next = poseEntries[i + 1];
    const ease = EASING[curr.ease || 'linear'];
    const holdBeats = curr.hold || 0;
    const holdSec = holdBeats * (60 / bpm);

    // Get pose bone data (rest = empty)
    const poseData = curr.name === 'rest' ? {} : (poses[curr.name] || {});

    if (!next) {
      // Last pose — apply at its time
      applyPoseAtTime(allFrames, curr.time, poseData, FRAME_TIME);
      continue;
    }

    const nextPoseData = next.name === 'rest' ? {} : (poses[next.name] || {});
    const interpStart = curr.time + holdSec;
    const interpEnd = next.time;

    // Apply held pose frames
    for (let t = curr.time; t < interpStart + FRAME_TIME * 0.5; t += FRAME_TIME) {
      const rt = roundTime(t);
      applyPoseAtTime(allFrames, rt, poseData, FRAME_TIME);
    }

    // Interpolate between poses
    if (interpEnd > interpStart) {
      // Collect all bones involved in both poses
      const allBones = new Set([...Object.keys(poseData), ...Object.keys(nextPoseData)]);

      for (let t = interpStart; t <= interpEnd + FRAME_TIME * 0.5; t += FRAME_TIME) {
        const rt = roundTime(t);
        const rawT = (t - interpStart) / (interpEnd - interpStart);
        const easedT = ease(Math.max(0, Math.min(1, rawT)));

        if (!allFrames.has(rt)) allFrames.set(rt, {});
        const frame = allFrames.get(rt);

        for (const bone of allBones) {
          const fromData = poseData[bone];
          const toData = nextPoseData[bone];

          if (fromData && toData) {
            // Both poses have this bone — interpolate
            if (fromData.rot && toData.rot) {
              const rot = slerpEuler(fromData.rot, toData.rot, easedT);
              if (!frame[bone]) frame[bone] = {};
              frame[bone] = { ...frame[bone], rot };
            }
            if (fromData.pos && toData.pos) {
              const pos = lerpPos(fromData.pos, toData.pos, easedT);
              if (!frame[bone]) frame[bone] = {};
              frame[bone] = { ...frame[bone], pos };
            }
          } else if (fromData && !toData) {
            // Pose has bone, next doesn't — hold through, fade would need a rest value
            // Since "rest" means no override, we hold the pose bone until interpolation ends
            if (easedT < 1) {
              if (!frame[bone]) frame[bone] = {};
              if (fromData.rot) frame[bone] = { ...frame[bone], rot: [...fromData.rot] };
              if (fromData.pos) frame[bone] = { ...frame[bone], pos: [...fromData.pos] };
            }
          } else if (!fromData && toData) {
            // Previous doesn't have bone, next does — only apply near end
            if (easedT > 0) {
              // We don't know the clip value here, so just apply the target scaled
              // This means the bone snaps in; a proper solution would read clip base
              if (!frame[bone]) frame[bone] = {};
              if (toData.rot) frame[bone] = { ...frame[bone], rot: [...toData.rot] };
              if (toData.pos) frame[bone] = { ...frame[bone], pos: [...toData.pos] };
            }
          }
        }
      }
    }
  }

  // Build low-level DSL text from all frames sorted by time
  const sortedTimes = [...allFrames.keys()].sort((a, b) => a - b);
  if (sortedTimes.length === 0) return 'duration 0\nframetime 0.033333\n';

  const duration = sortedTimes[sortedTimes.length - 1];

  // Find the last clip entry's end time to extend duration if needed
  let maxDuration = duration;
  for (const entry of clipEntries) {
    const clipDef = clips[entry.name];
    if (!clipDef) continue;
    let clipLen = clipDef.end - clipDef.start;
    if (entry.speed) clipLen /= entry.speed;
    const clipEnd = entry.time + clipLen;
    if (clipEnd > maxDuration) maxDuration = clipEnd;
  }

  const lines = [
    `# Generated from HDSL`,
    `duration ${maxDuration.toFixed(4)}`,
    `frametime ${FRAME_TIME.toFixed(6)}`,
    '',
  ];

  for (const t of sortedTimes) {
    const bones = allFrames.get(t);
    lines.push(`@${t.toFixed(4)}`);

    for (const [name, data] of Object.entries(bones)) {
      if (name === 'hip' && data.pos) {
        const p = data.pos;
        const r = data.rot || [0, 0, 0];
        lines.push(`  ${name}       pos ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}  rot ${r[0].toFixed(1)} ${r[1].toFixed(1)} ${r[2].toFixed(1)}`);
      } else if (data.rot) {
        const r = data.rot;
        lines.push(`  ${name.padEnd(10)} rot ${r[0].toFixed(1)} ${r[1].toFixed(1)} ${r[2].toFixed(1)}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

function applyPoseAtTime(allFrames, time, poseData, frameTime) {
  if (!allFrames.has(time)) allFrames.set(time, {});
  const frame = allFrames.get(time);
  for (const [bone, data] of Object.entries(poseData)) {
    if (!frame[bone]) frame[bone] = {};
    if (data.rot) frame[bone] = { ...frame[bone], rot: [...data.rot] };
    if (data.pos) frame[bone] = { ...frame[bone], pos: [...data.pos] };
  }
}

function roundTime(t) {
  return Math.round(t * 10000) / 10000;
}

/**
 * Map @M:B markers to line numbers for scroll sync.
 */
export function indexLines(text) {
  const lines = text.split('\n');
  const index = [];
  let bpm = 120;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith('bpm ')) {
      bpm = parseFloat(trimmed.slice(4));
    }

    const m = trimmed.match(/^@(\d+):(\d+)/);
    if (m) {
      const measure = parseInt(m[1]);
      const beat = parseInt(m[2]);
      const time = beatToSeconds(measure, beat, bpm);
      index.push({ time, line: i });
    }
  }

  return index;
}
