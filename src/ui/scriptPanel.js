export function createScriptPanel() {
  const el = document.createElement('div');
  el.className = 'figura-script-panel';

  // Resize handle
  const handle = document.createElement('div');
  handle.className = 'figura-script-handle';
  el.appendChild(handle);

  // Header with collapse toggle
  const header = document.createElement('div');
  header.className = 'figura-script-header';

  const title = document.createElement('span');
  title.textContent = 'Movement Script';
  header.appendChild(title);

  const status = document.createElement('span');
  status.style.cssText = 'font-size:10px; opacity:0; transition:opacity 0.3s;';
  header.appendChild(status);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'figura-script-collapse';
  collapseBtn.textContent = '\u25B6';
  collapseBtn.title = 'Collapse panel';
  header.appendChild(collapseBtn);

  el.appendChild(header);

  // Editor area with line numbers
  const editorWrap = document.createElement('div');
  editorWrap.className = 'figura-script-editor-wrap';

  const gutter = document.createElement('div');
  gutter.className = 'figura-script-gutter';
  editorWrap.appendChild(gutter);

  const editor = document.createElement('textarea');
  editor.className = 'figura-script-editor';
  editor.spellcheck = false;
  editor.placeholder = 'DSL motion script...';
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

  // --- Collapse/expand ---
  let collapsed = false;
  let savedWidth = null;

  collapseBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    if (collapsed) {
      savedWidth = el.style.width || null;
      el.classList.add('collapsed');
      collapseBtn.textContent = '\u25C0';
      collapseBtn.title = 'Expand panel';
    } else {
      el.classList.remove('collapsed');
      if (savedWidth) el.style.width = savedWidth;
      collapseBtn.textContent = '\u25B6';
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
    },

    onChange(callback) {
      changeCallback = callback;
    },

    showStatus(text, color) {
      status.textContent = text;
      status.style.color = color;
      status.style.opacity = '1';
      clearTimeout(status._timer);
      status._timer = setTimeout(() => { status.style.opacity = '0'; }, 1200);
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
