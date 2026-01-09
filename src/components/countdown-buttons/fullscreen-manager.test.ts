/**
 * Fullscreen manager utilities
 * Covers API availability, request fallbacks, UI behavior, and cleanup.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EXIT_BUTTON_HIDE_DELAY_MS } from './constants';
import {
    getFullscreenTimerPlaying,
    initFullscreenManager,
    isFullscreenApiAvailable,
    requestFullscreen,
    setFullscreenTimerPlaying,
} from './fullscreen-manager';

vi.mock('@core/utils/dom', () => ({
  createIcon: vi.fn(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    return svg;
  }),
  createIconButton: vi.fn((options: { testId?: string; className?: string; label: string }) => {
    const button = document.createElement('button');
    if (options.testId) button.dataset.testid = options.testId;
    if (options.className) button.className = options.className;
    button.setAttribute('aria-label', options.label);
    button.type = 'button';
    return button;
  }),
  ICON_SIZES: { LG: 24 },
}));

vi.mock('@/core/resource-tracking', () => {
  const createResourceTracker = () => new Set<number>();
  const cancelAll = (tracker: Set<number>) => {
    tracker.forEach((id) => clearTimeout(id));
    tracker.clear();
  };
  const safeSetTimeout = (fn: () => void, ms: number, tracker: Set<number>) => {
    const id = setTimeout(fn, ms) as unknown as number;
    tracker.add(id);
    return id;
  };
  return { createResourceTracker, cancelAll, safeSetTimeout };
});

describe('fullscreen-manager', () => {
  const originalFullscreenEnabled = (document as Document & { fullscreenEnabled?: boolean }).fullscreenEnabled;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.className = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    (document as Document & { fullscreenEnabled?: boolean }).fullscreenEnabled = originalFullscreenEnabled;
    delete (document as Document & { fullscreenElement?: Element }).fullscreenElement;
    delete (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement;
    vi.restoreAllMocks();
  });

  describe('isFullscreenApiAvailable', () => {
    it('should return false when any vendor flag is explicitly false', () => {
      (document as Document & { fullscreenEnabled?: boolean }).fullscreenEnabled = false;
      expect(isFullscreenApiAvailable()).toBe(false);
    });

    it('should return true when flags are undefined/true', () => {
      (document as Document & { fullscreenEnabled?: boolean }).fullscreenEnabled = true;
      expect(isFullscreenApiAvailable()).toBe(true);
    });
  });

  describe('requestFullscreen', () => {
    it('should call standard requestFullscreen when available', async () => {
      const original = document.documentElement.requestFullscreen;
      const spy = vi.fn().mockResolvedValue(undefined);
      document.documentElement.requestFullscreen = spy;

      await requestFullscreen();

      expect(spy).toHaveBeenCalledTimes(1);
      document.documentElement.requestFullscreen = original;
    });

    it('should fallback to webkitRequestFullscreen', async () => {
      const elem = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      const originalRequest = elem.requestFullscreen;
      const originalWebkit = elem.webkitRequestFullscreen;
      elem.requestFullscreen = undefined as unknown as typeof elem.requestFullscreen;
      const spy = vi.fn().mockResolvedValue(undefined);
      elem.webkitRequestFullscreen = spy;

      await requestFullscreen();

      expect(spy).toHaveBeenCalledTimes(1);
      elem.requestFullscreen = originalRequest;
      elem.webkitRequestFullscreen = originalWebkit;
    });
  });

  describe('initFullscreenManager', () => {
    it('should append exit button and toggle classes on fullscreen change', () => {
      document.querySelectorAll('.countdown-button-container').forEach((el) => el.remove());
      const container = document.createElement('div');
      container.id = 'app';
      const chrome = document.createElement('div');
      chrome.className = 'countdown-button-container';
      document.body.appendChild(chrome);
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container });

      const exitButton = document.getElementById('exit-fullscreen-button');
      expect(exitButton).not.toBeNull();
      expect(exitButton?.getAttribute('data-visible')).toBe('false');
      expect(exitButton?.getAttribute('aria-hidden')).toBe('true');

      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));

      expect(document.body.classList.contains('fullscreen-mode')).toBe(true);
      expect(container.classList.contains('fullscreen-mode')).toBe(true);
      expect(container.hasAttribute('data-fullscreen')).toBe(true);

      cleanup();
      expect(document.getElementById('exit-fullscreen-button')).toBeNull();
    });

    it('should reveal and hide exit button on mouse movement while fullscreen', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container });
      const exitButton = document.getElementById('exit-fullscreen-button') as HTMLButtonElement;

      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));

      document.dispatchEvent(new Event('mousemove'));
      expect(exitButton.dataset.visible).toBe('true');
      expect(exitButton.getAttribute('aria-hidden')).toBe('false');

      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 10);
      expect(exitButton.dataset.visible).toBe('false');
      expect(exitButton.getAttribute('aria-hidden')).toBe('true');

      cleanup();
    });
  });

  describe('timer controls integration', () => {
    it('should not create timer controls when mode is not timer', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'wall-clock' });

      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]');
      expect(timerControls).toBeNull();

      cleanup();
    });

    it('should create timer controls when mode is timer (AC1.3)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });

      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]');
      expect(timerControls).not.toBeNull();
      expect(timerControls?.getAttribute('role')).toBe('toolbar');

      cleanup();
    });

    it('should position timer controls left of exit button (AC1.1)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });

      const exitButton = document.getElementById('exit-fullscreen-button');
      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]');

      // Timer controls should be before exit button in DOM (thus to its left visually)
      const children = Array.from(document.body.children);
      const timerIndex = children.indexOf(timerControls as Element);
      const exitIndex = children.indexOf(exitButton as Element);

      expect(timerIndex).toBeLessThan(exitIndex);

      cleanup();
    });

    it('should show timer controls on mouse movement in fullscreen', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });
      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]') as HTMLElement;

      // Enter fullscreen
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));

      // Initially hidden
      expect(timerControls.getAttribute('data-visible')).toBe('false');

      // Show on mouse move
      document.dispatchEvent(new Event('mousemove'));
      expect(timerControls.getAttribute('data-visible')).toBe('true');

      cleanup();
    });

    it('should auto-hide timer controls after delay (AC1.2)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });
      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]') as HTMLElement;

      // Enter fullscreen and trigger show
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('mousemove'));

      expect(timerControls.getAttribute('data-visible')).toBe('true');

      // Advance time past hide delay
      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 10);

      expect(timerControls.getAttribute('data-visible')).toBe('false');

      cleanup();
    });

    it('should invoke onTimerPlayPauseToggle callback on button click', () => {
      const onPlayPauseToggle = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({
        container,
        mode: 'timer',
        onTimerPlayPauseToggle: onPlayPauseToggle,
        initialTimerPlaying: true,
      });

      const playPauseButton = document.querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;
      playPauseButton.click();

      expect(onPlayPauseToggle).toHaveBeenCalledWith(false);

      cleanup();
    });

    it('should invoke onTimerReset callback on reset button click', () => {
      const onReset = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({
        container,
        mode: 'timer',
        onTimerReset: onReset,
      });

      const resetButton = document.querySelector('[data-testid="fullscreen-timer-reset"]') as HTMLButtonElement;
      resetButton.click();

      expect(onReset).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('should clean up timer controls on destroy', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });

      expect(document.querySelector('[data-testid="fullscreen-timer-controls"]')).not.toBeNull();

      cleanup();

      expect(document.querySelector('[data-testid="fullscreen-timer-controls"]')).toBeNull();
    });
  });

  describe('setFullscreenTimerPlaying and getFullscreenTimerPlaying', () => {
    it('should return undefined when no timer controls exist', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'wall-clock' });

      expect(getFullscreenTimerPlaying()).toBeUndefined();

      cleanup();
    });

    it('should update and return timer playing state', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer', initialTimerPlaying: true });

      expect(getFullscreenTimerPlaying()).toBe(true);

      setFullscreenTimerPlaying(false);
      expect(getFullscreenTimerPlaying()).toBe(false);

      setFullscreenTimerPlaying(true);
      expect(getFullscreenTimerPlaying()).toBe(true);

      cleanup();
    });
  });

  describe('hover persistence (WCAG 1.4.13)', () => {
    it('should not auto-hide while hovering over exit button (AC4.8)', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });
      const exitButton = document.getElementById('exit-fullscreen-button') as HTMLButtonElement;
      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]') as HTMLElement;

      // Enter fullscreen and show controls
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('mousemove'));

      expect(exitButton.getAttribute('data-visible')).toBe('true');
      expect(timerControls.getAttribute('data-visible')).toBe('true');

      // Hover over exit button
      exitButton.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Advance time - should NOT hide because we're hovering
      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 100);

      expect(exitButton.getAttribute('data-visible')).toBe('true');
      expect(timerControls.getAttribute('data-visible')).toBe('true');

      // Mouse leaves - should start hide timer again
      exitButton.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 100);

      expect(exitButton.getAttribute('data-visible')).toBe('false');
      expect(timerControls.getAttribute('data-visible')).toBe('false');

      cleanup();
    });

    it('should not auto-hide while hovering over timer controls', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });
      const timerControls = document.querySelector('[data-testid="fullscreen-timer-controls"]') as HTMLElement;

      // Enter fullscreen and show controls
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('mousemove'));

      expect(timerControls.getAttribute('data-visible')).toBe('true');

      // Hover over timer controls
      timerControls.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

      // Advance time - should NOT hide because we're hovering
      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 100);

      expect(timerControls.getAttribute('data-visible')).toBe('true');

      cleanup();
    });
  });

  describe('focus restoration (AC4.4)', () => {
    it('should blur focused control when auto-hide triggers', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const cleanup = initFullscreenManager({ container, mode: 'timer' });
      const playPauseButton = document.querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      // Enter fullscreen and show controls
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement = container;
      document.dispatchEvent(new Event('fullscreenchange'));
      document.dispatchEvent(new Event('mousemove'));

      // Focus play/pause button
      playPauseButton.focus();
      expect(document.activeElement).toBe(playPauseButton);

      // Advance time to trigger auto-hide
      vi.advanceTimersByTime(EXIT_BUTTON_HIDE_DELAY_MS + 100);

      // Focus should NOT be on the now-hidden button anymore
      // (in real browser it goes to body, in JSDOM it may vary)
      expect(document.activeElement).not.toBe(playPauseButton);

      cleanup();
    });
  });
});
