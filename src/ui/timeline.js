// DAW-style timeline panel — body-group waveform tracks with transport + scrubbing.

const BODY_GROUPS = [
  { name: 'Spine', bones: ['hip', 'abdomen', 'chest', 'neck', 'head'], color: '#5588ff' },
  { name: 'L Arm', bones: ['lCollar', 'lShldr', 'lForeArm', 'lHand'], color: '#55cc77' },
  { name: 'R Arm', bones: ['rCollar', 'rShldr', 'rForeArm', 'rHand'], color: '#cc7755' },
  { name: 'L Leg', bones: ['lThigh', 'lShin', 'lFoot'], color: '#77aadd' },
  { name: 'R Leg', bones: ['rThigh', 'rShin', 'rFoot'], color: '#ddaa77' },
];

const RULER_H = 20;
const LABEL_W = 60;

export function computeWaveforms(parsed) {
  const { keyframes } = parsed;
  if (keyframes.length < 2) return BODY_GROUPS.map(() => []);

  const waveforms = BODY_GROUPS.map(group => {
    const values = [];
    for (let i = 0; i < keyframes.length; i++) {
      if (i === 0) { values.push(0); continue; }
      const prev = keyframes[i - 1].bones;
      const curr = keyframes[i].bones;
      let delta = 0;
      for (const bone of group.bones) {
        const p = prev[bone];
        const c = curr[bone];
        if (!p || !c || !p.rot || !c.rot) continue;
        delta += Math.abs(c.rot[0] - p.rot[0]) + Math.abs(c.rot[1] - p.rot[1]) + Math.abs(c.rot[2] - p.rot[2]);
      }
      values.push(delta);
    }
    // Normalize to [0,1]
    const max = Math.max(...values);
    if (max > 0) {
      for (let i = 0; i < values.length; i++) values[i] /= max;
    }
    return values;
  });

  return waveforms;
}

export function createTimeline(playback, container) {
  // --- Transport bar (DOM) ---
  const transport = document.createElement('div');
  transport.className = 'figura-transport';

  const playBtn = document.createElement('button');
  playBtn.className = 'figura-transport-btn';
  playBtn.textContent = '\u25B6 Pause';
  playBtn.addEventListener('click', onPlayPause);
  transport.appendChild(playBtn);

  const timeDisplay = document.createElement('span');
  timeDisplay.className = 'figura-transport-time';
  timeDisplay.textContent = '00:00.00 / 00:00.00';
  transport.appendChild(timeDisplay);

  const speedLabel = document.createElement('span');
  speedLabel.className = 'figura-transport-speed-label';
  speedLabel.textContent = 'Speed:';
  transport.appendChild(speedLabel);

  const speedSelect = document.createElement('select');
  speedSelect.className = 'figura-transport-speed';
  for (const v of [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = v + 'x';
    if (v === 1) opt.selected = true;
    speedSelect.appendChild(opt);
  }
  speedSelect.addEventListener('change', onSpeedChange);
  transport.appendChild(speedSelect);

  container.appendChild(transport);

  // --- Tracks canvas ---
  const canvas = document.createElement('canvas');
  canvas.className = 'figura-timeline-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // --- State ---
  let waveforms = BODY_GROUPS.map(() => []);
  let duration = playback.getDuration();
  let scrubbing = false;

  // --- Event handlers ---
  function onPlayPause() {
    if (playback.isPlaying()) playback.pause();
    else playback.play();
  }

  function onSpeedChange() {
    playback.setSpeed(parseFloat(speedSelect.value));
  }

  function timeFromX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left - LABEL_W;
    const trackW = canvas.width / devicePixelRatio - LABEL_W;
    const ratio = Math.max(0, Math.min(1, x / trackW));
    return ratio * duration;
  }

  function onPointerDown(e) {
    // Only handle clicks in the canvas area (below transport)
    scrubbing = true;
    playback.setTime(timeFromX(e.clientX));
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!scrubbing) return;
    playback.setTime(timeFromX(e.clientX));
  }

  function onPointerUp() {
    scrubbing = false;
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  // --- Format time as MM:SS.cc ---
  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return String(m).padStart(2, '0') + ':' + s.toFixed(2).padStart(5, '0');
  }

  // --- Drawing ---
  function draw() {
    if (!ctx) return;

    const dpr = devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const trackW = w - LABEL_W;
    const trackCount = BODY_GROUPS.length;
    const trackH = (h - RULER_H) / trackCount;

    // --- Time ruler ---
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(0, 0, w, RULER_H);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';

    if (duration > 0) {
      // Tick interval: target ~80px between ticks
      const rawInterval = (duration * 80) / trackW;
      const niceIntervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
      let tickInterval = niceIntervals[niceIntervals.length - 1];
      for (const ni of niceIntervals) {
        if (ni >= rawInterval) { tickInterval = ni; break; }
      }

      for (let t = 0; t <= duration; t += tickInterval) {
        const x = LABEL_W + (t / duration) * trackW;
        ctx.fillRect(x, RULER_H - 6, 1, 6);
        ctx.fillText(fmtTime(t), x, RULER_H - 8);
      }
    }

    // --- Track lanes ---
    for (let i = 0; i < trackCount; i++) {
      const y = RULER_H + i * trackH;
      const group = BODY_GROUPS[i];
      const wave = waveforms[i];

      // Background — alternating lanes
      ctx.fillStyle = i % 2 === 0 ? '#16161c' : '#1a1a22';
      ctx.fillRect(0, y, w, trackH);

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(group.name, 6, y + trackH / 2 + 4);

      // Separator line
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(LABEL_W, y, trackW, 1);

      // Waveform
      if (wave.length > 1) {
        const step = trackW / (wave.length - 1);
        const midY = y + trackH / 2;
        const amp = (trackH - 4) / 2;

        // Fill
        ctx.beginPath();
        ctx.moveTo(LABEL_W, midY);
        for (let j = 0; j < wave.length; j++) {
          ctx.lineTo(LABEL_W + j * step, midY - wave[j] * amp);
        }
        for (let j = wave.length - 1; j >= 0; j--) {
          ctx.lineTo(LABEL_W + j * step, midY + wave[j] * amp);
        }
        ctx.closePath();
        ctx.fillStyle = group.color + '40'; // 25% alpha
        ctx.fill();

        // Stroke top
        ctx.beginPath();
        ctx.moveTo(LABEL_W, midY - wave[0] * amp);
        for (let j = 1; j < wave.length; j++) {
          ctx.lineTo(LABEL_W + j * step, midY - wave[j] * amp);
        }
        ctx.strokeStyle = group.color + '99'; // 60% alpha
        ctx.lineWidth = 1;
        ctx.stroke();

        // Stroke bottom
        ctx.beginPath();
        ctx.moveTo(LABEL_W, midY + wave[0] * amp);
        for (let j = 1; j < wave.length; j++) {
          ctx.lineTo(LABEL_W + j * step, midY + wave[j] * amp);
        }
        ctx.stroke();
      }
    }

    // --- Playhead ---
    if (duration > 0) {
      const t = playback.getTime();
      const x = LABEL_W + (t / duration) * trackW;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 7);
      ctx.closePath();
      ctx.fill();
    }
  }

  return {
    setKeyframes(parsed) {
      duration = parsed.duration;
      waveforms = computeWaveforms(parsed);
    },

    update() {
      // Sync transport
      playBtn.textContent = playback.isPlaying() ? '\u25AE\u25AE Pause' : '\u25B6 Play';
      timeDisplay.textContent = fmtTime(playback.getTime()) + ' / ' + fmtTime(playback.getDuration());

      // Sync speed select
      const curSpeed = String(playback.getSpeed());
      if (speedSelect.value !== curSpeed) {
        speedSelect.value = curSpeed;
      }

      duration = playback.getDuration();
      draw();
    },

    dispose() {
      playBtn.removeEventListener('click', onPlayPause);
      speedSelect.removeEventListener('change', onSpeedChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      transport.remove();
      canvas.remove();
    },
  };
}
