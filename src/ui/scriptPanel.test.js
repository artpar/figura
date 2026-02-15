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
    expect(document.querySelector('.figura-script-panel')).not.toBeNull();
  });

  it('has a header with title', () => {
    const header = document.querySelector('.figura-script-header');
    expect(header).not.toBeNull();
    expect(header.textContent).toContain('Movement Script');
  });

  it('has an editable textarea', () => {
    const editor = document.querySelector('.figura-script-editor');
    expect(editor).not.toBeNull();
    expect(editor.tagName).toBe('TEXTAREA');
  });

  it('has a resize handle', () => {
    expect(document.querySelector('.figura-script-handle')).not.toBeNull();
  });

  it('has a collapse button', () => {
    expect(document.querySelector('.figura-script-collapse')).not.toBeNull();
  });

  it('has a line number gutter', () => {
    expect(document.querySelector('.figura-script-gutter')).not.toBeNull();
  });

  it('getText returns current text', () => {
    const editor = document.querySelector('.figura-script-editor');
    editor.value = 'test content';
    expect(panel.getText()).toBe('test content');
  });

  it('setText sets editor content and updates line numbers', () => {
    panel.setText('line1\nline2\nline3');
    expect(document.querySelector('.figura-script-editor').value).toBe('line1\nline2\nline3');
    expect(document.querySelector('.figura-script-gutter').textContent).toBe('1\n2\n3');
  });

  it('onChange fires callback after input with debounce', async () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    panel.onChange(cb);

    const editor = document.querySelector('.figura-script-editor');
    editor.value = 'duration 1.00';
    editor.dispatchEvent(new Event('input'));

    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalledWith('duration 1.00');

    vi.useRealTimers();
  });

  it('collapse button toggles collapsed class', () => {
    const btn = document.querySelector('.figura-script-collapse');
    const panel_el = document.querySelector('.figura-script-panel');

    btn.click();
    expect(panel_el.classList.contains('collapsed')).toBe(true);

    btn.click();
    expect(panel_el.classList.contains('collapsed')).toBe(false);
  });

  it('dispose removes panel from DOM and cleans up listeners', () => {
    panel.dispose();
    expect(document.querySelector('.figura-script-panel')).toBeNull();
    panel = null;
  });
});
