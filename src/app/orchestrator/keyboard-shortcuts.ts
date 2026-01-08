/**
 * Keyboard shortcuts - global keyboard handlers for countdown controls.
 *
 * Provides keyboard shortcuts for control operations:
 * - Space: Toggle play/pause (timer mode only)
 * - Enter / R: Reset timer (timer mode only)
 * - F: Toggle fullscreen (all modes)
 *
 * Shortcuts only activate when not typing in an input, when no modal is open,
 * and when no button/link has focus.
 */

import type { CountdownMode } from '@core/types';
import { isModalOpen, shouldIgnoreShortcut } from '@core/utils/keyboard-guards';

/**
 * Options for initializing keyboard shortcuts.
 */
export interface KeyboardShortcutOptions {
  /** Current countdown mode - shortcuts only activate in 'timer' mode */
  mode: CountdownMode;
  /** Callback invoked when play/pause is toggled via Space key */
  onTogglePlayPause?: () => void;
  /** Callback invoked when reset is triggered via Enter or R key */
  onReset?: () => void;
  /** Callback invoked when fullscreen is toggled via F key (works in all modes) */
  onToggleFullscreen?: () => void;
}

/** Module-level state for cleanup. */
let activeHandler: ((event: KeyboardEvent) => void) | null = null;

/**
 * Check if a modifier key (Ctrl, Alt, Meta, Shift) is pressed.
 * Shortcuts with modifiers are typically browser shortcuts and should be ignored.
 */
function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.altKey || event.metaKey || event.shiftKey;
}

/**
 * Create the keyboard event handler for timer shortcuts.
 *
 * @param options - Configuration including mode and callbacks
 * @returns Event handler function
 */
function createKeyboardHandler(options: KeyboardShortcutOptions): (event: KeyboardEvent) => void {
  const { mode, onTogglePlayPause, onReset, onToggleFullscreen } = options;

  return (event: KeyboardEvent) => {
    // Check guards first (apply to all shortcuts)
    // Ignore when typing in input/textarea/contenteditable
    if (shouldIgnoreShortcut()) return;

    // Ignore when modal is open
    if (isModalOpen()) return;

    // Ignore shortcuts with modifiers (Ctrl+F, etc.)
    if (hasModifier(event)) return;

    const key = event.key;

    // F key: toggle fullscreen (works in ALL modes)
    if (key.toLowerCase() === 'f') {
      onToggleFullscreen?.();
      return;
    }

    // Timer-only shortcuts below this point
    if (mode !== 'timer') return;

    // Space key: toggle play/pause
    if (key === ' ') {
      event.preventDefault(); // Prevent page scroll
      onTogglePlayPause?.();
      return;
    }

    // Enter key: reset
    if (key === 'Enter') {
      onReset?.();
      return;
    }

    // R key (case-insensitive): reset
    if (key.toLowerCase() === 'r') {
      onReset?.();
      return;
    }
  };
}

/**
 * Initialize keyboard shortcuts for countdown controls.
 *
 * Sets up document-level keydown listener for:
 * - Space: toggle play/pause (timer mode)
 * - Enter/R: reset (timer mode)
 * - F: toggle fullscreen (all modes)
 *
 * Call `cleanupKeyboardShortcuts()` to remove the listener.
 *
 * @param options - Configuration including mode and callbacks
 *
 * @example
 * ```ts
 * initKeyboardShortcuts({
 *   mode: 'timer',
 *   onTogglePlayPause: () => handlePlayPause(!isPlaying),
 *   onReset: () => resetTimer(),
 *   onToggleFullscreen: () => toggleFullscreen(),
 * });
 *
 * // Later, during cleanup:
 * cleanupKeyboardShortcuts();
 * ```
 */
export function initKeyboardShortcuts(options: KeyboardShortcutOptions): void {
  // Clean up any existing handler first
  cleanupKeyboardShortcuts();

  activeHandler = createKeyboardHandler(options);
  document.addEventListener('keydown', activeHandler);
}

/**
 * Remove keyboard shortcuts event listener.
 *
 * Safe to call multiple times or when not initialized.
 */
export function cleanupKeyboardShortcuts(): void {
  if (activeHandler) {
    document.removeEventListener('keydown', activeHandler);
    activeHandler = null;
  }
}
