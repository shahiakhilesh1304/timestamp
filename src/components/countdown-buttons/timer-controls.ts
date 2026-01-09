/** Timer Controls Component - Play/pause toggle and reset buttons for timer mode countdowns. */

import '../../styles/components/countdown-ui.css';

import { createIcon, createIconButton, ICON_SIZES, type IconSize } from '@core/utils/dom';
import { cloneTemplate } from '@core/utils/dom/template-utils';

/** Options for creating timer controls. */
export interface TimerControlsOptions {
  /** Whether the timer is initially playing (not paused) */
  initialPlaying?: boolean;
  /** Callback invoked when play/pause is toggled */
  onPlayPauseToggle?: (isPlaying: boolean) => void;
  /** Callback invoked when reset is clicked */
  onReset?: () => void;
}

/** Timer controls controller interface. */
export interface TimerControlsController {
  /** Get the container element holding all controls */
  getElement(): HTMLDivElement;
  /** Update the play/pause button state */
  setPlaying(isPlaying: boolean): void;
  /** Check if the timer is currently playing */
  isPlaying(): boolean;
  /** Remove the controls and clean up */
  destroy(): void;
}

/** Minimum time between aria-live announcements to prevent spam (ms) */
const ARIA_LIVE_THROTTLE_MS = 1000;

function createPlayPauseIcon(isPlaying: boolean, size: IconSize = ICON_SIZES.LG): SVGSVGElement {
  return createIcon({
    name: isPlaying ? 'pause' : 'play',
    size,
  });
}

function createResetIcon(size: IconSize = ICON_SIZES.LG): SVGSVGElement {
  return createIcon({
    name: 'sync',
    size,
  });
}

function updatePlayPauseState(button: HTMLButtonElement, isPlaying: boolean): void {
  button.setAttribute('aria-pressed', (!isPlaying).toString());
  button.setAttribute('aria-label', isPlaying ? 'Pause timer' : 'Resume timer');
  
  const oldIcon = button.querySelector('svg');
  const newIcon = createPlayPauseIcon(isPlaying);
  
  if (oldIcon) {
    button.replaceChild(newIcon, oldIcon);
  } else {
    button.appendChild(newIcon);
  }
}

/** Announce state change to screen readers via aria-live region. Announcements are throttled to prevent spam. */
function announceStateChange(
  liveRegion: HTMLSpanElement,
  message: string,
  lastAnnouncementTime: { value: number }
): void {
  const now = Date.now();
  if (now - lastAnnouncementTime.value < ARIA_LIVE_THROTTLE_MS) {
    return;
  }
  
  lastAnnouncementTime.value = now;
  liveRegion.textContent = message;
  
  // Clear after announcement to allow repeat announcements
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 100);
}

/**
 * Create timer controls from template (play/pause toggle and reset button).
 * @returns Controller with getElement, setPlaying, isPlaying, and destroy methods
 */
export function createTimerControls(
  options: TimerControlsOptions = {}
): TimerControlsController {
  let playing = options.initialPlaying ?? true;
  const lastAnnouncementTime = { value: 0 };

  // Clone container from template
  const container = cloneTemplate<HTMLDivElement>('timer-controls-template');

  // Get elements from template
  const liveRegion = container.querySelector('[aria-live]') as HTMLSpanElement;
  const playPauseButton = container.querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
  const resetButton = container.querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;

  // Inject icons (must be done via JS as SVGs change based on state)
  const playPauseIcon = createPlayPauseIcon(playing);
  playPauseButton.appendChild(playPauseIcon);
  
  const resetIcon = createResetIcon();
  resetButton.appendChild(resetIcon);

  // Set initial state
  updatePlayPauseState(playPauseButton, playing);

  /** Handle play/pause toggle click */
  function handlePlayPauseClick(): void {
    playing = !playing;
    updatePlayPauseState(playPauseButton, playing);
    
    const message = playing ? 'Timer resumed' : 'Timer paused';
    announceStateChange(liveRegion, message, lastAnnouncementTime);
    
    options.onPlayPauseToggle?.(playing);
  }

  /** Handle reset button click */
  function handleResetClick(): void {
    announceStateChange(liveRegion, 'Timer reset', lastAnnouncementTime);
    options.onReset?.();
    // Note: Reset preserves play/pause state (AC2.1, AC2.2)
    // The orchestrator handles resetting from celebration state
  }

  playPauseButton.addEventListener('click', handlePlayPauseClick);
  resetButton.addEventListener('click', handleResetClick);

  return {
    getElement(): HTMLDivElement {
      return container;
    },

    setPlaying(isPlaying: boolean): void {
      playing = isPlaying;
      updatePlayPauseState(playPauseButton, playing);
    },

    isPlaying(): boolean {
      return playing;
    },

    destroy(): void {
      playPauseButton.removeEventListener('click', handlePlayPauseClick);
      resetButton.removeEventListener('click', handleResetClick);
      container.remove();
    },
  };
}

/**
 * Options for creating fullscreen timer controls.
 */
export interface FullscreenTimerControlsOptions {
  /** Whether the timer is initially playing (not paused) */
  initialPlaying?: boolean;
  /** Callback invoked when play/pause is toggled */
  onPlayPauseToggle?: (isPlaying: boolean) => void;
  /** Callback invoked when reset is clicked */
  onReset?: () => void;
}

/**
 * Fullscreen timer controls controller interface.
 */
export interface FullscreenTimerControlsController {
  /** Get the container element holding all controls */
  getElement(): HTMLDivElement;
  /** Update the play/pause button state */
  setPlaying(isPlaying: boolean): void;
  /** Check if the timer is currently playing */
  isPlaying(): boolean;
  /** Show the controls (set visibility) */
  show(): void;
  /** Hide the controls (set visibility) */
  hide(): void;
  /** Check if controls are currently visible */
  isVisible(): boolean;
  /** Remove the controls and clean up */
  destroy(): void;
}

/**
 * Create fullscreen timer controls (play/pause toggle and reset button for fullscreen mode).
 *
 * These controls are designed to appear alongside the exit fullscreen button on mouse movement.
 * They use `role="toolbar"` with `aria-label` for keyboard accessibility (AC4.7).
 *
 * @param options - Configuration options
 * @returns Controller with element access, state management, and cleanup methods
 */
export function createFullscreenTimerControls(
  options: FullscreenTimerControlsOptions = {}
): FullscreenTimerControlsController {
  let playing = options.initialPlaying ?? true;
  let visible = false;

  // Create container with toolbar role (AC4.7)
  const container = document.createElement('div');
  container.className = 'fullscreen-timer-controls';
  container.setAttribute('role', 'toolbar');
  container.setAttribute('aria-label', 'Timer controls');
  container.setAttribute('data-testid', 'fullscreen-timer-controls');
  container.setAttribute('data-visible', 'false');

  // Create play/pause button with aria-pressed (AC4.5)
  const playPauseButton = createIconButton({
    testId: 'fullscreen-timer-play-pause',
    label: playing ? 'Pause timer' : 'Resume timer',
    icon: createPlayPauseIcon(playing, ICON_SIZES.XL), // Use XL size for fullscreen visibility
    className: 'countdown-button fullscreen-timer-button',
  });
  playPauseButton.setAttribute('aria-pressed', (!playing).toString());

  // Create reset button
  const resetButton = createIconButton({
    testId: 'fullscreen-timer-reset',
    label: 'Reset timer to original duration',
    icon: createResetIcon(ICON_SIZES.XL), // Use XL size for fullscreen visibility
    className: 'countdown-button fullscreen-timer-button',
  });

  container.appendChild(playPauseButton);
  container.appendChild(resetButton);

  /** Update play/pause button state */
  function updatePlayPauseState(): void {
    playPauseButton.setAttribute('aria-pressed', (!playing).toString());
    playPauseButton.setAttribute('aria-label', playing ? 'Pause timer' : 'Resume timer');

    const oldIcon = playPauseButton.querySelector('svg');
    const newIcon = createPlayPauseIcon(playing, ICON_SIZES.XL); // Use XL size for fullscreen visibility

    if (oldIcon) {
      playPauseButton.replaceChild(newIcon, oldIcon);
    } else {
      playPauseButton.appendChild(newIcon);
    }
  }

  /** Handle play/pause toggle click */
  function handlePlayPauseClick(): void {
    playing = !playing;
    updatePlayPauseState();
    options.onPlayPauseToggle?.(playing);
  }

  /** Handle reset button click */
  function handleResetClick(): void {
    options.onReset?.();
  }

  playPauseButton.addEventListener('click', handlePlayPauseClick);
  resetButton.addEventListener('click', handleResetClick);

  return {
    getElement(): HTMLDivElement {
      return container;
    },

    setPlaying(isPlaying: boolean): void {
      playing = isPlaying;
      updatePlayPauseState();
    },

    isPlaying(): boolean {
      return playing;
    },

    show(): void {
      visible = true;
      container.setAttribute('data-visible', 'true');
      container.classList.add('show-fullscreen-controls');
    },

    hide(): void {
      visible = false;
      container.setAttribute('data-visible', 'false');
      container.classList.remove('show-fullscreen-controls');
    },

    isVisible(): boolean {
      return visible;
    },

    destroy(): void {
      playPauseButton.removeEventListener('click', handlePlayPauseClick);
      resetButton.removeEventListener('click', handleResetClick);
      container.remove();
    },
  };
}
