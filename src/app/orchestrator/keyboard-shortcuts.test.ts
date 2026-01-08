/**
 * Tests for keyboard shortcuts - Space toggle, Enter/R reset for timer mode.
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupKeyboardShortcuts, initKeyboardShortcuts, type KeyboardShortcutOptions } from './keyboard-shortcuts';

describe('keyboard-shortcuts', () => {
  let onTogglePlayPause: ReturnType<typeof vi.fn>;
  let onReset: ReturnType<typeof vi.fn>;
  let onToggleFullscreen: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    document.body.innerHTML = '';
    onTogglePlayPause = vi.fn();
    onReset = vi.fn();
    onToggleFullscreen = vi.fn();
  });

  afterEach(() => {
    cleanupKeyboardShortcuts();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createOptions(overrides: Partial<KeyboardShortcutOptions> = {}): KeyboardShortcutOptions {
    return {
      mode: 'timer',
      onTogglePlayPause,
      onReset,
      onToggleFullscreen,
      ...overrides,
    };
  }

  function pressKey(key: string, options: Partial<KeyboardEventInit> = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    document.dispatchEvent(event);
    return event;
  }

  describe('Space key (play/pause toggle)', () => {
    it('toggles play/pause on Space key in timer mode (AC2.1)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey(' ');

      expect(onTogglePlayPause).toHaveBeenCalledTimes(1);
    });

    it('calls preventDefault on Space to avoid scroll (AC2.6)', () => {
      initKeyboardShortcuts(createOptions());

      const event = pressKey(' ');

      expect(event.defaultPrevented).toBe(true);
    });

    it('ignores Space when input is focused (AC2.2)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      initKeyboardShortcuts(createOptions());
      pressKey(' ');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });

    it('ignores Space when textarea is focused (AC2.2)', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      initKeyboardShortcuts(createOptions());
      pressKey(' ');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });

    it('ignores Space when modal is open (AC2.3)', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      initKeyboardShortcuts(createOptions());
      pressKey(' ');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });

    it('does NOT work in wall-clock mode (AC2.5)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'wall-clock' }));

      pressKey(' ');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });

    it('does NOT work in absolute mode (AC2.5)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'absolute' }));

      pressKey(' ');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });

    it('does NOT work when button is focused (Space should activate button)', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();

      initKeyboardShortcuts(createOptions());
      pressKey(' ');

      // Space should activate the focused button, not trigger timer shortcut
      expect(onTogglePlayPause).not.toHaveBeenCalled();
    });
  });

  describe('Enter key (reset)', () => {
    it('resets timer on Enter key in timer mode (AC3.1)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('Enter');

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('ignores Enter when input is focused (AC3.3)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      initKeyboardShortcuts(createOptions());
      pressKey('Enter');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('ignores Enter when textarea is focused (AC3.3)', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      initKeyboardShortcuts(createOptions());
      pressKey('Enter');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('ignores Enter when modal is open (AC3.4)', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      initKeyboardShortcuts(createOptions());
      pressKey('Enter');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('does NOT work in wall-clock mode (AC3.6)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'wall-clock' }));

      pressKey('Enter');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('does NOT work in absolute mode (AC3.6)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'absolute' }));

      pressKey('Enter');

      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('R key (reset)', () => {
    it('resets timer on lowercase r key in timer mode (AC3.2)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('r');

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('resets timer on uppercase R key in timer mode (AC3.2 case-insensitive)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('R');

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('ignores R when input is focused (AC3.3)', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      initKeyboardShortcuts(createOptions());
      pressKey('r');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('ignores R when modal is open (AC3.4)', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      initKeyboardShortcuts(createOptions());
      pressKey('r');

      expect(onReset).not.toHaveBeenCalled();
    });

    it('does NOT work in wall-clock mode (AC3.6)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'wall-clock' }));

      pressKey('r');

      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('fullscreen and normal view (AC2.4, AC3.5)', () => {
    it('Space works without fullscreen-mode class', () => {
      initKeyboardShortcuts(createOptions());

      pressKey(' ');

      expect(onTogglePlayPause).toHaveBeenCalled();
    });

    it('Space works with fullscreen-mode class', () => {
      document.body.classList.add('fullscreen-mode');
      initKeyboardShortcuts(createOptions());

      pressKey(' ');

      expect(onTogglePlayPause).toHaveBeenCalled();
    });

    it('Enter works without fullscreen-mode class', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('Enter');

      expect(onReset).toHaveBeenCalled();
    });

    it('Enter works with fullscreen-mode class', () => {
      document.body.classList.add('fullscreen-mode');
      initKeyboardShortcuts(createOptions());

      pressKey('Enter');

      expect(onReset).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('removes event listeners on cleanup', () => {
      initKeyboardShortcuts(createOptions());
      cleanupKeyboardShortcuts();

      pressKey(' ');
      pressKey('Enter');
      pressKey('r');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });

    it('handles cleanup when not initialized', () => {
      // Should not throw
      expect(() => cleanupKeyboardShortcuts()).not.toThrow();
    });

    it('handles multiple cleanups gracefully', () => {
      initKeyboardShortcuts(createOptions());
      cleanupKeyboardShortcuts();
      cleanupKeyboardShortcuts();

      // Should not throw
    });

    it('allows re-initialization after cleanup', () => {
      initKeyboardShortcuts(createOptions());
      cleanupKeyboardShortcuts();
      initKeyboardShortcuts(createOptions());

      pressKey(' ');

      expect(onTogglePlayPause).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('ignores other keys', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('a');
      pressKey('Escape');
      pressKey('Tab');
      pressKey('ArrowUp');

      expect(onTogglePlayPause).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });

    it('handles missing callbacks gracefully', () => {
      initKeyboardShortcuts({
        mode: 'timer',
        // No callbacks provided
      });

      // Should not throw
      pressKey(' ');
      pressKey('Enter');
    });

    it('ignores keys with modifier combinations', () => {
      initKeyboardShortcuts(createOptions());

      // Space with Ctrl should likely be ignored (browser shortcuts)
      pressKey(' ', { ctrlKey: true });
      pressKey('Enter', { metaKey: true });
      pressKey('r', { altKey: true });

      expect(onTogglePlayPause).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('test matrix: key × mode × focus', () => {
    const keys = [
      { key: ' ', type: 'toggle' as const },
      { key: 'Enter', type: 'reset' as const },
      { key: 'r', type: 'reset' as const },
      { key: 'R', type: 'reset' as const },
    ];

    const modes = ['timer', 'wall-clock', 'absolute'] as const;

    it.each(keys.flatMap(({ key, type }) =>
      modes.map((mode) => [key, mode, type] as const)
    ))('key=%s mode=%s type=%s', (key, mode, type) => {
      initKeyboardShortcuts(createOptions({ mode }));
      pressKey(key);

      if (mode === 'timer') {
        if (type === 'toggle') {
          expect(onTogglePlayPause).toHaveBeenCalled();
        } else {
          expect(onReset).toHaveBeenCalled();
        }
      } else {
        expect(onTogglePlayPause).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
      }
    });
  });

  describe('F key (fullscreen toggle)', () => {
    it('toggles fullscreen on F key in timer mode', () => {
      initKeyboardShortcuts(createOptions({ mode: 'timer' }));

      pressKey('f');

      expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('toggles fullscreen on F key (uppercase)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'timer' }));

      pressKey('F');

      expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('works in wall-clock mode (all modes)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'wall-clock' }));

      pressKey('f');

      expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('works in absolute mode (all modes)', () => {
      initKeyboardShortcuts(createOptions({ mode: 'absolute' }));

      pressKey('f');

      expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
    });

    it('ignores F when input is focused', () => {
      const input = document.createElement('input');
      input.type = 'text';
      document.body.appendChild(input);
      input.focus();

      initKeyboardShortcuts(createOptions());
      pressKey('f');

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('ignores F when modal is open (prevents conflict with favorite in theme modal)', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      // Add class to simulate theme modal (but keyboard-guards excludes PWA prompt)
      modal.className = 'theme-modal';
      document.body.appendChild(modal);

      initKeyboardShortcuts(createOptions());
      pressKey('f');

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('ignores F when button is focused', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();

      initKeyboardShortcuts(createOptions());
      pressKey('f');

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('ignores F with Ctrl modifier (browser shortcut)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('f', { ctrlKey: true });

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('ignores F with Alt modifier', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('f', { altKey: true });

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('ignores F with Meta modifier (Cmd+F)', () => {
      initKeyboardShortcuts(createOptions());

      pressKey('f', { metaKey: true });

      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });
  });
});
