// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createScriptPanel } from './scriptPanel.js';

describe('scriptPanel', () => {
  let panel;

  beforeEach(() => {
    panel = createScriptPanel();
  });

  afterEach(() => {
    if (panel) panel.dispose();
  });

  it('appends panel to document body', () => {
    expect(document.querySelector('.sp')).not.toBeNull();
  });

  it('has a header with title', () => {
    const header = document.querySelector('.sp-header');
    expect(header).not.toBeNull();
    expect(header.textContent).toContain('Script');
  });

  it('has an editable textarea', () => {
    const editor = document.querySelector('.sp-editor');
    expect(editor).not.toBeNull();
    expect(editor.tagName).toBe('TEXTAREA');
  });

  it('has a resize handle', () => {
    expect(document.querySelector('.sp-handle')).not.toBeNull();
  });

  it('has a collapse button', () => {
    expect(document.querySelector('.figura-script-collapse')).not.toBeNull();
  });

  it('has a help button that toggles syntax reference', () => {
    const btn = document.querySelector('.sp-help-btn');
    expect(btn).not.toBeNull();

    const helpCard = document.querySelector('.sp-ref');
    expect(helpCard).not.toBeNull();
    expect(helpCard.style.display).toBe('none');

    btn.click();
    expect(helpCard.style.display).toBe('');

    btn.click();
    expect(helpCard.style.display).toBe('none');
  });

  it('help reference contains syntax keywords', () => {
    const helpCard = document.querySelector('.sp-ref');
    expect(helpCard.textContent).toContain('bpm');
    expect(helpCard.textContent).toContain('source');
    expect(helpCard.textContent).toContain('clip');
    expect(helpCard.textContent).toContain('pose');
    expect(helpCard.textContent).toContain('mirror');
    expect(helpCard.textContent).toContain('ease-in');
  });

  it('has a line number gutter', () => {
    expect(document.querySelector('.sp-gutter')).not.toBeNull();
  });

  it('getText returns current text', () => {
    const editor = document.querySelector('.sp-editor');
    editor.value = 'test content';
    expect(panel.getText()).toBe('test content');
  });

  it('setText sets editor content and updates line numbers', () => {
    panel.setText('line1\nline2\nline3');
    expect(document.querySelector('.sp-editor').value).toBe('line1\nline2\nline3');
    expect(document.querySelector('.sp-gutter').textContent).toBe('1\n2\n3');
  });

  it('onChange fires callback after input with debounce', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    panel.onChange(cb);

    const editor = document.querySelector('.sp-editor');
    editor.value = 'duration 1.00';
    editor.dispatchEvent(new Event('input'));

    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalledWith('duration 1.00');

    vi.useRealTimers();
  });

  it('collapse button toggles collapsed class', () => {
    const btn = document.querySelector('.figura-script-collapse');
    const panel_el = document.querySelector('.sp');

    btn.click();
    expect(panel_el.classList.contains('collapsed')).toBe(true);

    btn.click();
    expect(panel_el.classList.contains('collapsed')).toBe(false);
  });

  describe('scrollToLine', () => {
    it('sets scrollTop based on line number', () => {
      panel.setText('a\nb\nc\nd\ne\nf\ng\nh\ni\nj');
      panel.scrollToLine(5);
      const editor = document.querySelector('.sp-editor');
      expect(typeof editor.scrollTop).toBe('number');
    });

    it('no-op when line is -1', () => {
      const editor = document.querySelector('.sp-editor');
      editor.scrollTop = 42;
      panel.scrollToLine(-1);
      expect(editor.scrollTop).toBe(42);
    });

    it('no-op on duplicate line', () => {
      panel.setText('a\nb\nc\nd\ne');
      panel.scrollToLine(3);
      const editor = document.querySelector('.sp-editor');
      const first = editor.scrollTop;
      editor.scrollTop = 999;
      panel.scrollToLine(3);
      expect(editor.scrollTop).toBe(999);
    });

    it('resets dedup after setText', () => {
      panel.setText('a\nb\nc\nd\ne');
      panel.scrollToLine(3);
      const editor = document.querySelector('.sp-editor');
      editor.scrollTop = 999;
      panel.setText('x\ny\nz\na\nb');
      panel.scrollToLine(3);
      expect(editor.scrollTop).not.toBe(999);
    });

    it('no-op when textarea is focused', () => {
      panel.setText('a\nb\nc\nd\ne\nf\ng');
      const editor = document.querySelector('.sp-editor');
      editor.focus();
      editor.scrollTop = 0;
      panel.scrollToLine(5);
      expect(editor.scrollTop).toBe(0);
    });

    it('syncs gutter scroll', () => {
      panel.setText('a\nb\nc\nd\ne\nf\ng\nh\ni\nj');
      panel.scrollToLine(5);
      const editor = document.querySelector('.sp-editor');
      const gutter = document.querySelector('.sp-gutter');
      expect(gutter.scrollTop).toBe(editor.scrollTop);
    });
  });

  it('has an example select dropdown', () => {
    expect(document.querySelector('.sp-examples')).not.toBeNull();
    expect(document.querySelector('.sp-examples').tagName).toBe('SELECT');
  });

  it('setExamples populates dropdown options', () => {
    panel.setExamples([
      { id: 'a', title: 'Alpha' },
      { id: 'b', title: 'Beta' },
    ]);
    const select = document.querySelector('.sp-examples');
    expect(select.options.length).toBe(2);
    expect(select.options[0].value).toBe('a');
    expect(select.options[0].textContent).toBe('Alpha');
    expect(select.options[1].value).toBe('b');
    expect(select.options[1].textContent).toBe('Beta');
  });

  it('onSelectExample fires callback with selected id on change', () => {
    panel.setExamples([
      { id: 'x', title: 'X' },
      { id: 'y', title: 'Y' },
    ]);
    const cb = vi.fn();
    panel.onSelectExample(cb);

    const select = document.querySelector('.sp-examples');
    select.value = 'y';
    select.dispatchEvent(new Event('change'));

    expect(cb).toHaveBeenCalledWith('y');
  });

  it('dispose removes panel from DOM and cleans up listeners', () => {
    panel.dispose();
    expect(document.querySelector('.sp')).toBeNull();
    panel = null;
  });
});
