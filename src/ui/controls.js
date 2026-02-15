export function createControls(playback, container) {
  const el = document.createElement('div');
  el.className = 'figura-controls';

  // Play/pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'figura-play-btn';
  playBtn.textContent = 'Pause';
  playBtn.addEventListener('click', onPlayPause);
  el.appendChild(playBtn);

  // Speed slider
  const speedLabel = document.createElement('label');
  speedLabel.className = 'figura-speed-label';
  speedLabel.textContent = '1.00x';

  const speedSlider = document.createElement('input');
  speedSlider.className = 'figura-speed-slider';
  speedSlider.type = 'range';
  speedSlider.min = '0.25';
  speedSlider.max = '2';
  speedSlider.step = '0.25';
  speedSlider.value = '1';
  speedSlider.addEventListener('input', onSpeedChange);

  el.appendChild(speedSlider);
  el.appendChild(speedLabel);

  // Time scrubber
  const scrubber = document.createElement('input');
  scrubber.className = 'figura-scrubber';
  scrubber.type = 'range';
  scrubber.min = '0';
  scrubber.max = String(playback.getDuration());
  scrubber.step = '0.01';
  scrubber.value = '0';
  scrubber.addEventListener('input', onScrub);
  el.appendChild(scrubber);

  container.appendChild(el);

  function onPlayPause() {
    if (playback.isPlaying()) {
      playback.pause();
    } else {
      playback.play();
    }
    playBtn.textContent = playback.isPlaying() ? 'Pause' : 'Play';
  }

  function onSpeedChange() {
    const speed = parseFloat(speedSlider.value);
    playback.setSpeed(speed);
    speedLabel.textContent = speed.toFixed(2) + 'x';
  }

  function onScrub() {
    playback.setTime(parseFloat(scrubber.value));
  }

  return {
    update() {
      scrubber.max = String(playback.getDuration());
      scrubber.value = String(playback.getTime());
      playBtn.textContent = playback.isPlaying() ? 'Pause' : 'Play';
    },

    dispose() {
      playBtn.removeEventListener('click', onPlayPause);
      speedSlider.removeEventListener('input', onSpeedChange);
      scrubber.removeEventListener('input', onScrub);
      el.remove();
    },
  };
}
