export function createScriptPanel() {
  const el = document.createElement('div');
  el.className = 'sp';

  // Resize handle — just a thin edge
  const handle = document.createElement('div');
  handle.className = 'sp-handle';
  el.appendChild(handle);

  // Header
  const header = document.createElement('div');
  header.className = 'sp-header';

  const titleRow = document.createElement('div');
  titleRow.className = 'sp-title-row';

  const title = document.createElement('span');
  title.className = 'sp-title';
  title.textContent = 'Script';
  titleRow.appendChild(title);

  const exampleSelect = document.createElement('select');
  exampleSelect.className = 'sp-examples';
  titleRow.appendChild(exampleSelect);

  const status = document.createElement('span');
  status.className = 'sp-status';
  titleRow.appendChild(status);

  header.appendChild(titleRow);

  const actions = document.createElement('div');
  actions.className = 'sp-actions';

  const helpBtn = document.createElement('button');
  helpBtn.className = 'sp-btn sp-help-btn';
  helpBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6.06 6a2 2 0 013.88.64c0 1.33-2 2-2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="12" r=".75" fill="currentColor"/></svg>';
  helpBtn.title = 'Syntax reference';
  actions.appendChild(helpBtn);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'sp-btn figura-script-collapse';
  collapseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  collapseBtn.title = 'Collapse panel';
  actions.appendChild(collapseBtn);

  header.appendChild(actions);
  el.appendChild(header);

  // Help reference
  const helpCard = document.createElement('div');
  helpCard.className = 'sp-ref figura-script-help';

  helpCard.innerHTML = [
    sec('Setup', [
      kv('bpm', '120', 'beats per minute, 4/4 time'),
      kv('source', 'pirouette', 'BVH file from assets/'),
    ]),
    sec('Clips', [
      kv('clip', 'spin from pirouette 0.0-2.5', 'named time range'),
    ]),
    sec('Poses', [
      '<div class="sp-ref-code">pose arms-high\n  lShldr rot 0 0 -160\n  rShldr rot 0 0 160</div>',
      '<span class="sp-ref-dim">Only listed bones are overridden. <code>pose rest</code> clears all.</span>',
    ]),
    sec('Sequence', [
      kv('@1:1', 'clip spin', ''),
      kv('@3:1', 'clip spin mirror', ''),
      kv('@5:1', 'clip spin speed 0.8', ''),
      kv('@5:1', 'clip spin reverse', ''),
      kv('@7:1', 'pose arms-high ease-out', ''),
      kv('@9:1', 'pose rest ease-in hold 2', ''),
    ]),
    sec('Easing', [
      '<span class="sp-ref-dim">linear &middot; ease-in &middot; ease-out &middot; ease-in-out</span>',
    ]),
    sec('Bones', [
      '<div class="sp-ref-bones">' +
        'hip abdomen chest neck head<br>' +
        'lCollar lShldr lForeArm lHand<br>' +
        'rCollar rShldr rForeArm rHand<br>' +
        'lThigh lShin lFoot<br>' +
        'rThigh rShin rFoot' +
      '</div>',
    ]),
    sec('Values', [
      kv('rot', 'Z X Y', 'Euler degrees, ZXY order'),
      kv('pos', 'X Y Z', 'cm, hip only'),
    ]),
  ].join('');

  helpCard.style.display = 'none';
  el.appendChild(helpCard);

  let helpOpen = false;
  helpBtn.addEventListener('click', () => {
    helpOpen = !helpOpen;
    helpCard.style.display = helpOpen ? '' : 'none';
    helpBtn.classList.toggle('sp-btn-active', helpOpen);
  });

  // Editor area
  const editorWrap = document.createElement('div');
  editorWrap.className = 'sp-editor-wrap figura-script-editor-wrap';

  const gutter = document.createElement('div');
  gutter.className = 'sp-gutter figura-script-gutter';
  editorWrap.appendChild(gutter);

  const editor = document.createElement('textarea');
  editor.className = 'sp-editor figura-script-editor';
  editor.spellcheck = false;
  editor.autocomplete = 'off';
  editor.autocapitalize = 'off';
  editorWrap.appendChild(editor);

  el.appendChild(editorWrap);
  document.body.appendChild(el);

  // --- Line numbers ---
  function updateGutter() {
    const count = editor.value.split('\n').length;
    const lines = [];
    for (let i = 1; i <= count; i++) lines.push(i);
    gutter.textContent = lines.join('\n');
  }

  function syncScroll() {
    gutter.scrollTop = editor.scrollTop;
  }

  editor.addEventListener('scroll', syncScroll);
  updateGutter();

  // --- Tab key inserts 2 spaces ---
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      editor.dispatchEvent(new Event('input'));
    }
  });

  // --- Example select ---
  let selectCallback = null;
  exampleSelect.addEventListener('change', () => {
    if (selectCallback) selectCallback(exampleSelect.value);
  });

  // --- Debounced change ---
  let changeCallback = null;
  let debounceTimer = null;

  editor.addEventListener('input', () => {
    updateGutter();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (changeCallback) changeCallback(editor.value);
    }, 300);
  });

  // --- Scroll sync ---
  let lastScrollLine = -1;

  // --- Collapse/expand ---
  let collapsed = false;
  let savedWidth = null;
  const collapseSvg = collapseBtn.querySelector('svg');

  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    if (collapsed) {
      savedWidth = el.style.width || null;
      el.classList.add('collapsed');
      collapseSvg.style.transform = 'rotate(180deg)';
      collapseBtn.title = 'Expand panel';
    } else {
      el.classList.remove('collapsed');
      if (savedWidth) el.style.width = savedWidth;
      collapseSvg.style.transform = '';
      collapseBtn.title = 'Collapse panel';
    }
  });

  // --- Resize drag ---
  let dragging = false;
  let startX = 0;
  let startWidth = 0;

  function onMouseDown(e) {
    dragging = true;
    startX = e.clientX;
    startWidth = el.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!dragging) return;
    const dx = startX - e.clientX;
    const newWidth = Math.max(200, Math.min(startWidth + dx, window.innerWidth * 0.6));
    el.style.width = newWidth + 'px';
  }

  function onMouseUp() {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  handle.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  return {
    getText() {
      return editor.value;
    },

    setText(text) {
      editor.value = text;
      updateGutter();
      lastScrollLine = -1;
    },

    onChange(callback) {
      changeCallback = callback;
    },

    setExamples(list) {
      exampleSelect.innerHTML = '';
      for (const item of list) {
        const opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.title;
        exampleSelect.appendChild(opt);
      }
    },

    onSelectExample(callback) {
      selectCallback = callback;
    },

    showStatus(text, color) {
      status.textContent = text;
      status.style.color = color;
      status.style.opacity = '1';
      clearTimeout(status._timer);
      status._timer = setTimeout(() => { status.style.opacity = '0'; }, 1200);
    },

    scrollToLine(n) {
      if (n < 0) return;
      if (n === lastScrollLine) return;
      if (document.activeElement === editor) return;
      lastScrollLine = n;
      const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 16;
      const visibleHeight = editor.clientHeight;
      editor.scrollTop = Math.max(0, n * lineHeight - visibleHeight / 3);
      gutter.scrollTop = editor.scrollTop;
    },

    update() {},

    dispose() {
      clearTimeout(debounceTimer);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      el.remove();
    },
  };
}

// --- Help card HTML builders ---

function sec(label, items) {
  return `<div class="sp-ref-sec"><div class="sp-ref-label">${label}</div>${items.join('')}</div>`;
}

function kv(keyword, value, desc) {
  const d = desc ? `<span class="sp-ref-dim">${desc}</span>` : '';
  return `<div class="sp-ref-row"><code>${keyword}</code> <span class="sp-ref-val">${value}</span>${d}</div>`;
}
