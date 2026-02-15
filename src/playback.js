import * as THREE from 'three';

export function createPlayback(mesh, clip) {
  let mixer = new THREE.AnimationMixer(mesh);
  let action = mixer.clipAction(clip);
  let currentClip = clip;
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
      action.time = Math.max(0, Math.min(t, currentClip.duration));
    },

    getDuration() {
      return currentClip.duration;
    },

    setClip(newClip) {
      const speed = action.timeScale;
      mixer.stopAllAction();
      mixer.uncacheRoot(mesh);
      mixer = new THREE.AnimationMixer(mesh);
      currentClip = newClip;
      action = mixer.clipAction(newClip);
      action.timeScale = speed;
      action.play();
    },
  };
}
