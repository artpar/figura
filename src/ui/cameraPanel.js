// Camera view control — click directional zones to snap to presets.
// Small circular widget with arrow buttons, like Google Maps 3D nav.

const VIEWS = [
  { label: 'F',  preset: 'front', position: 'top' },
  { label: 'B',  preset: 'back',  position: 'bottom' },
  { label: 'S',  preset: 'side',  position: 'right' },
  { label: 'T',  preset: 'top',   position: 'left' },
];

export function createCameraPanel(camera) {
  const el = document.createElement('div');
  el.className = 'figura-viewctl';

  // Center dot
  const center = document.createElement('button');
  center.className = 'figura-viewctl-center';
  center.title = 'Close-up';
  center.addEventListener('click', () => camera.setPreset('close'));
  el.appendChild(center);

  // Direction buttons
  const buttons = [];
  for (const view of VIEWS) {
    const btn = document.createElement('button');
    btn.className = 'figura-viewctl-btn figura-viewctl-' + view.position;
    btn.textContent = view.label;
    btn.title = view.preset.charAt(0).toUpperCase() + view.preset.slice(1);
    btn.dataset.preset = view.preset;
    btn.addEventListener('click', () => camera.setPreset(view.preset));
    el.appendChild(btn);
    buttons.push(btn);
  }

  document.body.appendChild(el);

  return {
    update() {
      const active = camera.getPreset();
      for (const btn of buttons) {
        btn.classList.toggle('active', btn.dataset.preset === active);
      }
      center.classList.toggle('active', active === 'close');
    },

    dispose() {
      el.remove();
    },
  };
}
