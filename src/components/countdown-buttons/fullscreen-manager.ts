/** Fullscreen manager utilities - Handles fullscreen lifecycle, exit button behavior, and vendor prefixes. */

import type { CountdownMode } from '@core/types';
import { createIcon, createIconButton, ICON_SIZES } from '@core/utils/dom';

import { cancelAll, createResourceTracker, type ResourceTracker, safeSetTimeout } from '@/core/resource-tracking';

import { EXIT_BUTTON_HIDE_DELAY_MS } from './constants';
import {
    createFullscreenTimerControls,
    type FullscreenTimerControlsController,
} from './timer-controls';

const EXIT_BUTTON_VISIBLE_CLASS = 'show-exit-button';

/**
 * Detect whether Fullscreen API is available (guards vendor-prefixed false values).
 * @returns true if Fullscreen API is available
 */
export function isFullscreenApiAvailable(): boolean {
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
    msFullscreenEnabled?: boolean;
  };
  const flags = [doc.fullscreenEnabled, doc.webkitFullscreenEnabled, doc.mozFullScreenEnabled, doc.msFullscreenEnabled];
  return !flags.some((value) => value === false);
}

function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ||
    (document as Document & { mozFullScreenElement?: Element }).mozFullScreenElement ||
    (document as Document & { msFullscreenElement?: Element }).msFullscreenElement
  );
}

/**
 * Toggle fullscreen mode - enters fullscreen if not active, exits if active.
 * @returns Promise resolving when fullscreen state changes
 * @throws Error if fullscreen request fails
 */
export async function requestFullscreen(): Promise<void> {
  // Check if already in fullscreen - if so, exit instead
  if (isFullscreen()) {
    await exitFullscreen();
    return;
  }

  // Otherwise, enter fullscreen
  const elem = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  try {
    if (elem.requestFullscreen) await elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) await elem.webkitRequestFullscreen();
    else if (elem.mozRequestFullScreen) await elem.mozRequestFullScreen();
    else if (elem.msRequestFullscreen) await elem.msRequestFullscreen();
  } catch (error) {
    console.error('Failed to enter fullscreen:', error);
    throw error;
  }
}

async function exitFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  try {
    if (doc.exitFullscreen) await doc.exitFullscreen();
    else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen();
    else if (doc.msExitFullscreen) await doc.msExitFullscreen();
  } catch (error) {
    console.error('Failed to exit fullscreen:', error);
  }
}

function createExitButton(): HTMLButtonElement {
  const button = createIconButton({
    testId: 'exit-fullscreen-button',
    label: 'Exit fullscreen mode',
    icon: createIcon({ name: 'screen-normal', size: ICON_SIZES.XL }), // Use XL size for better visibility
    className: 'countdown-button exit-fullscreen-button',
  });
  button.id = 'exit-fullscreen-button';
  button.setAttribute('data-visible', 'false');

  const text = document.createElement('span');
  text.textContent = 'Exit Fullscreen';
  button.appendChild(text);

  return button;
}

interface FullscreenManagerState {
  exitButton: HTMLButtonElement | null;
  timerControls: FullscreenTimerControlsController | null;
  resourceTracker: ResourceTracker;
  mouseMoveHandler: (() => void) | null;
  fullscreenChangeHandler: (() => void) | null;
  keydownHandler: ((event: KeyboardEvent) => void) | null;
  /** Track if mouse is hovering over controls (WCAG 1.4.13) */
  isHoveringControls: boolean;
  /** Currently configured mode */
  mode: CountdownMode | null;
}

/** Options for fullscreen manager. */
export interface FullscreenManagerOptions {
  /** Container for fullscreen styling hooks. */
  container?: HTMLElement | null;
  /** Current countdown mode - timer controls only appear in 'timer' mode */
  mode?: CountdownMode;
  /** Callback invoked when timer play/pause is toggled (timer mode only) */
  onTimerPlayPauseToggle?: (isPlaying: boolean) => void;
  /** Callback invoked when timer reset is clicked (timer mode only) */
  onTimerReset?: () => void;
  /** Initial playing state for timer controls */
  initialTimerPlaying?: boolean;
}

const managerState: FullscreenManagerState = {
  exitButton: null,
  timerControls: null,
  resourceTracker: createResourceTracker(),
  mouseMoveHandler: null,
  fullscreenChangeHandler: null,
  keydownHandler: null,
  isHoveringControls: false,
  mode: null,
};

function showExitButton(exitButton: HTMLButtonElement): void {
  // Clear existing hide timer
  cancelAll(managerState.resourceTracker);

  exitButton.setAttribute('data-visible', 'true');
  exitButton.setAttribute('aria-hidden', 'false');
  exitButton.style.visibility = 'visible';
  exitButton.classList.add(EXIT_BUTTON_VISIBLE_CLASS);

  // Show timer controls if in timer mode (AC1.3)
  if (managerState.mode === 'timer' && managerState.timerControls) {
    managerState.timerControls.show();
  }

  // Schedule hide unless hovering (WCAG 1.4.13)
  scheduleAutoHide(exitButton);
}

/**
 * Schedule auto-hide for fullscreen controls.
 * Respects hover persistence (WCAG 1.4.13).
 */
function scheduleAutoHide(exitButton: HTMLButtonElement): void {
  cancelAll(managerState.resourceTracker);

  safeSetTimeout(
    () => {
      // Don't hide if hovering (WCAG 1.4.13)
      if (managerState.isHoveringControls) {
        // Re-schedule check
        scheduleAutoHide(exitButton);
        return;
      }
      hideExitButton(exitButton);
    },
    EXIT_BUTTON_HIDE_DELAY_MS,
    managerState.resourceTracker
  );
}

function hideExitButton(exitButton: HTMLButtonElement): void {
  // Check if any control has focus - if so, blur it (AC4.4)
  const activeElement = document.activeElement as HTMLElement | null;
  const controlsHaveFocus =
    exitButton.contains(activeElement) ||
    managerState.timerControls?.getElement().contains(activeElement);

  if (controlsHaveFocus && activeElement?.blur) {
    activeElement.blur();
  }

  exitButton.setAttribute('data-visible', 'false');
  exitButton.setAttribute('aria-hidden', 'true');
  exitButton.style.visibility = 'hidden';
  exitButton.classList.remove(EXIT_BUTTON_VISIBLE_CLASS);

  // Hide timer controls too
  managerState.timerControls?.hide();
}

/**
 * Initialize fullscreen management with exit button and chrome hiding.
 * @returns Cleanup function to remove listeners and exit fullscreen
 */
export function initFullscreenManager(options: FullscreenManagerOptions = {}): () => void {
  if (!isFullscreenApiAvailable()) return () => undefined;

  const container = options.container ?? document.getElementById('app');

  // Store mode for later checks
  managerState.mode = options.mode ?? null;

  // Create exit button
  managerState.exitButton = createExitButton();
  document.body.appendChild(managerState.exitButton);
  hideExitButton(managerState.exitButton);
  managerState.exitButton.addEventListener('click', exitFullscreen);

  // Create timer controls in timer mode (AC1.3)
  if (options.mode === 'timer') {
    managerState.timerControls = createFullscreenTimerControls({
      initialPlaying: options.initialTimerPlaying,
      onPlayPauseToggle: options.onTimerPlayPauseToggle,
      onReset: options.onTimerReset,
    });
    // Insert timer controls before (left of) exit button (AC1.1)
    managerState.exitButton.parentElement?.insertBefore(
      managerState.timerControls.getElement(),
      managerState.exitButton
    );
  }

  // Set up hover persistence handlers (WCAG 1.4.13)
  setupHoverPersistence();

  managerState.mouseMoveHandler = () => {
    const fullscreenActive = isFullscreen() || document.body.classList.contains('fullscreen-mode');
    if (fullscreenActive && managerState.exitButton) showExitButton(managerState.exitButton);
  };
  document.addEventListener('mousemove', managerState.mouseMoveHandler);

  managerState.fullscreenChangeHandler = () => {
    const fullscreenActive = isFullscreen();
    const chrome = document.querySelector('.countdown-button-container');

    if (chrome) chrome.setAttribute('data-chrome-hidden', fullscreenActive ? 'true' : 'false');
    document.body.classList.toggle('fullscreen-mode', fullscreenActive);
    if (container) {
      container.classList.toggle('fullscreen-mode', fullscreenActive);
      container.toggleAttribute('data-fullscreen', fullscreenActive);
    }

    cancelAll(managerState.resourceTracker);
    if (managerState.exitButton) hideExitButton(managerState.exitButton);
  };

  document.addEventListener('fullscreenchange', managerState.fullscreenChangeHandler);
  document.addEventListener('webkitfullscreenchange', managerState.fullscreenChangeHandler);
  document.addEventListener('mozfullscreenchange', managerState.fullscreenChangeHandler);
  document.addEventListener('MSFullscreenChange', managerState.fullscreenChangeHandler);

  managerState.keydownHandler = (event: KeyboardEvent) => {
    const fullscreenActive = isFullscreen() || document.body.classList.contains('fullscreen-mode');
    if (event.key === 'Escape' && fullscreenActive) void exitFullscreen();
  };
  document.addEventListener('keydown', managerState.keydownHandler);

  return () => {
    if (isFullscreen()) void exitFullscreen();
    cancelAll(managerState.resourceTracker);
    if (managerState.mouseMoveHandler) {
      document.removeEventListener('mousemove', managerState.mouseMoveHandler);
      managerState.mouseMoveHandler = null;
    }
    if (managerState.fullscreenChangeHandler) {
      document.removeEventListener('fullscreenchange', managerState.fullscreenChangeHandler);
      document.removeEventListener('webkitfullscreenchange', managerState.fullscreenChangeHandler);
      document.removeEventListener('mozfullscreenchange', managerState.fullscreenChangeHandler);
      document.removeEventListener('MSFullscreenChange', managerState.fullscreenChangeHandler);
      managerState.fullscreenChangeHandler = null;
    }
    if (managerState.keydownHandler) {
      document.removeEventListener('keydown', managerState.keydownHandler);
      managerState.keydownHandler = null;
    }
    // Clean up timer controls
    if (managerState.timerControls) {
      managerState.timerControls.destroy();
      managerState.timerControls = null;
    }
    if (managerState.exitButton?.parentElement) {
      managerState.exitButton.parentElement.removeChild(managerState.exitButton);
    }
    managerState.exitButton = null;
    managerState.mode = null;
    managerState.isHoveringControls = false;
  };
}

/**
 * Set up hover persistence handlers for WCAG 1.4.13 compliance.
 * Controls stay visible while mouse is hovering over them.
 */
function setupHoverPersistence(): void {
  const exitButton = managerState.exitButton;
  const timerControls = managerState.timerControls?.getElement();

  const handleMouseEnter = (): void => {
    managerState.isHoveringControls = true;
  };

  const handleMouseLeave = (): void => {
    managerState.isHoveringControls = false;
    // Re-schedule auto-hide when mouse leaves
    if (exitButton && exitButton.getAttribute('data-visible') === 'true') {
      scheduleAutoHide(exitButton);
    }
  };

  // Add hover listeners to exit button
  exitButton?.addEventListener('mouseenter', handleMouseEnter);
  exitButton?.addEventListener('mouseleave', handleMouseLeave);

  // Add hover listeners to timer controls if present
  timerControls?.addEventListener('mouseenter', handleMouseEnter);
  timerControls?.addEventListener('mouseleave', handleMouseLeave);
}

/**
 * Update the fullscreen timer controls playing state.
 * Call this when the timer state changes externally (e.g., from keyboard shortcuts).
 * @param isPlaying - Whether the timer is playing
 */
export function setFullscreenTimerPlaying(isPlaying: boolean): void {
  managerState.timerControls?.setPlaying(isPlaying);
}

/**
 * Get the current fullscreen timer controls playing state.
 * @returns Whether the timer is playing, or undefined if no timer controls
 */
export function getFullscreenTimerPlaying(): boolean | undefined {
  return managerState.timerControls?.isPlaying();
}
