const SEPARATOR_SIZE = 6; // px — wide enough to grab
const MIN_RATIO = 0.15;
const MAX_RATIO = 0.85;

// 2x2 grid layout with draggable split dividers.
// cameras[0] is the interactive orbit camera (top-left).
// Null entries render as empty (just background clear).
// onWheel is a parallel array of callbacks: onWheel[i](deltaY) for scroll-to-zoom per quadrant.

export function createViewport(renderer, canvas, cameras, scene, controls, onWheel) {
  let splitX = 0.5;
  let splitY = 0.5;
  const container = canvas.parentElement;

  // --- Separator divs (draggable, inside container) ---
  const hLine = document.createElement('div');
  hLine.style.cssText =
    `position:absolute;left:0;width:100%;height:${SEPARATOR_SIZE}px;` +
    `background:#222;z-index:10;cursor:row-resize;`;
  container.appendChild(hLine);

  const vLine = document.createElement('div');
  vLine.style.cssText =
    `position:absolute;top:0;height:100%;width:${SEPARATOR_SIZE}px;` +
    `background:#222;z-index:10;cursor:col-resize;`;
  container.appendChild(vLine);

  function clamp(v) {
    return Math.max(MIN_RATIO, Math.min(MAX_RATIO, v));
  }

  function layout() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const leftW = Math.floor(w * splitX);
    const topH = Math.floor(h * splitY);
    const rightW = w - leftW;
    const bottomH = h - topH;

    renderer.setSize(w, h);

    const qw = [leftW, rightW];
    const qh = [topH, bottomH];
    const GRID = [[0, 0], [1, 0], [0, 1], [1, 1]];

    for (let i = 0; i < 4; i++) {
      const cam = cameras[i];
      if (!cam) continue;
      const [col, row] = GRID[i];
      cam.aspect = qw[col] / qh[row];
      cam.updateProjectionMatrix();
    }

    hLine.style.top = (topH - SEPARATOR_SIZE / 2) + 'px';
    vLine.style.left = (leftW - SEPARATOR_SIZE / 2) + 'px';
  }

  layout();

  // ResizeObserver re-layouts when container changes (e.g. script panel resize)
  const resizeObs = new ResizeObserver(layout);
  resizeObs.observe(container);

  // --- Drag logic ---
  let dragging = null;

  function onDragStart(axis) {
    return (e) => {
      e.preventDefault();
      dragging = axis;
    };
  }

  function onDragMove(e) {
    if (!dragging) return;
    const rect = container.getBoundingClientRect();
    if (dragging === 'v') {
      splitX = clamp((e.clientX - rect.left) / rect.width);
    } else {
      splitY = clamp((e.clientY - rect.top) / rect.height);
    }
    layout();
  }

  function onDragEnd() {
    dragging = null;
  }

  hLine.addEventListener('pointerdown', onDragStart('h'));
  vLine.addEventListener('pointerdown', onDragStart('v'));
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);

  // --- Hit-test: which quadrant does a client point land in? ---
  function getQuadrant(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = x < rect.width * splitX ? 0 : 1;
    const row = y < rect.height * splitY ? 0 : 1;
    return row * 2 + col;
  }

  // --- OrbitControls gating: only top-left quadrant ---
  function onPointerDown(e) {
    if (getQuadrant(e.clientX, e.clientY) !== 0) {
      controls.enabled = false;
    }
  }

  function onPointerUp() {
    if (!dragging) controls.enabled = true;
  }

  canvas.addEventListener('pointerdown', onPointerDown, true);
  canvas.addEventListener('pointerup', onPointerUp, true);

  // --- Wheel routing per quadrant ---
  function onWheelEvent(e) {
    if (!onWheel) return;
    const idx = getQuadrant(e.clientX, e.clientY);
    if (onWheel[idx]) {
      onWheel[idx](e.deltaY);
      e.preventDefault();
    }
  }

  canvas.addEventListener('wheel', onWheelEvent, { passive: false });

  // Grid positions: [col, row]
  const GRID = [[0, 0], [1, 0], [0, 1], [1, 1]];

  return {
    render() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const leftW = Math.floor(w * splitX);
      const topH = Math.floor(h * splitY);
      const rightW = w - leftW;
      const bottomH = h - topH;
      const qw = [leftW, rightW];
      const qh = [topH, bottomH];

      renderer.setScissorTest(true);
      renderer.autoClear = false;
      renderer.clear();

      for (let i = 0; i < 4; i++) {
        const cam = cameras[i];
        if (!cam) continue;
        const [col, row] = GRID[i];
        const x = col === 0 ? 0 : leftW;
        const y = row === 0 ? bottomH : 0;
        const cw = qw[col];
        const ch = qh[row];
        renderer.setViewport(x, y, cw, ch);
        renderer.setScissor(x, y, cw, ch);
        renderer.render(scene, cam);
      }

      renderer.setScissorTest(false);
    },

    dispose() {
      resizeObs.disconnect();
      window.removeEventListener('pointermove', onDragMove);
      window.removeEventListener('pointerup', onDragEnd);
      canvas.removeEventListener('pointerdown', onPointerDown, true);
      canvas.removeEventListener('pointerup', onPointerUp, true);
      canvas.removeEventListener('wheel', onWheelEvent);
      hLine.remove();
      vLine.remove();
    },
  };
}
