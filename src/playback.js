import * as THREE from 'three';

export function createPlayback(mesh, clip) {
  const mixer = new THREE.AnimationMixer(mesh);
  const action = mixer.clipAction(clip);
  const clock = new THREE.Clock();

  action.play();

  return {
    update() {
      mixer.update(clock.getDelta());
    },

    play() {
      action.paused = false;
    },

    pause() {
      action.paused = true;
    },

    isPlaying() {
      return !action.paused;
    },

    setSpeed(n) {
      action.timeScale = n;
    },

    getSpeed() {
      return action.timeScale;
    },

    getTime() {
      return action.time;
    },

    setTime(t) {
      action.time = Math.max(0, Math.min(t, clip.duration));
    },

    getDuration() {
      return clip.duration;
    },
  };
}
