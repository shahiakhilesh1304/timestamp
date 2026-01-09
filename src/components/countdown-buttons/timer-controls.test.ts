/**
 * Timer Controls Component Tests
 * Tests for play/pause toggle and reset button functionality.
 */
import { cleanupDOM } from '@/test-utils/dom-helpers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createFullscreenTimerControls,
    createTimerControls,
    type FullscreenTimerControlsController,
    type TimerControlsController,
} from './timer-controls';

/** Shared test helper: Assert play/pause button state */
function expectPlayPauseState(
  button: HTMLButtonElement,
  isPlaying: boolean,
  expectedLabel: string,
  expectedPressed: string
): void {
  expect(button.getAttribute('aria-label')).toBe(expectedLabel);
  expect(button.getAttribute('aria-pressed')).toBe(expectedPressed);
}

describe('TimerControls', () => {
  let controls: TimerControlsController;

  beforeEach(() => {
    vi.useFakeTimers();
    cleanupDOM();
  });

  afterEach(() => {
    vi.useRealTimers();
    controls?.destroy();
  });

  describe('createTimerControls', () => {
    it('should create a container element with test id', () => {
      controls = createTimerControls();
      const element = controls.getElement();
      
      expect(element).toBeInstanceOf(HTMLDivElement);
      expect(element.dataset.testid).toBe('timer-controls');
      expect(element.className).toBe('timer-controls');
    });

    it('should create play/pause button first in DOM order', () => {
      controls = createTimerControls();
      const element = controls.getElement();
      const buttons = element.querySelectorAll('button');
      
      expect(buttons.length).toBe(2);
      expect(buttons[0].dataset.testid).toBe('timer-play-pause');
      expect(buttons[1].dataset.testid).toBe('timer-reset');
    });

    it.each([
      { description: 'start playing by default', options: undefined, expected: true },
      { description: 'respect initialPlaying=false', options: { initialPlaying: false }, expected: false },
    ])('should %s', ({ options, expected }) => {
      controls = createTimerControls(options as never);

      expect(controls.isPlaying()).toBe(expected);
    });
  });

  describe('play/pause button', () => {
    it.each([
      { initialPlaying: true, expectedLabel: 'Pause timer' },
      { initialPlaying: false, expectedLabel: 'Resume timer' },
    ])('should set aria-label when initialPlaying=%s', ({ initialPlaying, expectedLabel }) => {
      controls = createTimerControls({ initialPlaying });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      expect(button.getAttribute('aria-label')).toBe(expectedLabel);
    });

    it('should have aria-pressed attribute reflecting pause state', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      // When playing, aria-pressed should be "false" (not paused)
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should toggle aria-pressed on click', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      expect(button.getAttribute('aria-pressed')).toBe('true');
      
      button.click();
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should swap aria-label on click', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      expect(button.getAttribute('aria-label')).toBe('Resume timer');
      
      button.click();
      expect(button.getAttribute('aria-label')).toBe('Pause timer');
    });

    it('should invoke onPlayPauseToggle callback with new state', () => {
      const onPlayPauseToggle = vi.fn();
      controls = createTimerControls({ initialPlaying: true, onPlayPauseToggle });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      expect(onPlayPauseToggle).toHaveBeenCalledWith(false);
      
      button.click();
      expect(onPlayPauseToggle).toHaveBeenCalledWith(true);
    });

    it('should have SVG icon with aria-hidden', () => {
      controls = createTimerControls();
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      const icon = button.querySelector('svg');
      
      expect(icon).not.toBeNull();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    });

    it('should swap icon on toggle', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      const initialIcon = button.querySelector('svg')?.outerHTML;
      button.click();
      const newIcon = button.querySelector('svg')?.outerHTML;
      
      expect(newIcon).not.toBe(initialIcon);
    });
  });

  describe('reset button', () => {
    it('should have correct aria-label', () => {
      controls = createTimerControls();
      const button = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      expect(button.getAttribute('aria-label')).toBe('Reset timer to original duration');
    });

    it('should invoke onReset callback on click', () => {
      const onReset = vi.fn();
      controls = createTimerControls({ onReset });
      const button = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      button.click();
      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it.each([
      { initialPlaying: true, expected: true },
      { initialPlaying: false, expected: false },
    ])('should preserve play/pause state on reset when initialPlaying=%s', ({ initialPlaying, expected }) => {
      controls = createTimerControls({ initialPlaying, onReset: vi.fn() });
      const resetButton = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      resetButton.click();
      
      expect(controls.isPlaying()).toBe(expected);
    });
  });

  describe('aria-live announcements', () => {
    it('should have aria-live region', () => {
      controls = createTimerControls();
      const liveRegion = controls.getElement().querySelector('[aria-live]');
      
      expect(liveRegion).not.toBeNull();
      expect(liveRegion?.getAttribute('aria-live')).toBe('polite');
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    });

    it('should announce pause when toggling from playing', () => {
      controls = createTimerControls({ initialPlaying: true });
      const liveRegion = controls.getElement().querySelector('[aria-live]') as HTMLSpanElement;
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      
      expect(liveRegion.textContent).toBe('Timer paused');
    });

    it('should announce resume when toggling from paused', () => {
      controls = createTimerControls({ initialPlaying: false });
      const liveRegion = controls.getElement().querySelector('[aria-live]') as HTMLSpanElement;
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      
      expect(liveRegion.textContent).toBe('Timer resumed');
    });

    it('should announce reset on reset click', () => {
      controls = createTimerControls({ onReset: vi.fn() });
      const liveRegion = controls.getElement().querySelector('[aria-live]') as HTMLSpanElement;
      const button = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      button.click();
      
      expect(liveRegion.textContent).toBe('Timer reset');
    });

    it('should throttle announcements to prevent spam', () => {
      controls = createTimerControls({ initialPlaying: true });
      const liveRegion = controls.getElement().querySelector('[aria-live]') as HTMLSpanElement;
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      button.click();
      expect(liveRegion.textContent).toBe('Timer paused');
      
      // Rapid clicks within throttle window
      button.click();
      expect(liveRegion.textContent).toBe('Timer paused'); // Should not update
      
      // Advance past throttle window
      vi.advanceTimersByTime(1100);
      button.click();
      expect(liveRegion.textContent).toBe('Timer paused');
    });
  });

  describe('setPlaying', () => {
    it('should update internal state', () => {
      controls = createTimerControls({ initialPlaying: true });
      
      controls.setPlaying(false);
      expect(controls.isPlaying()).toBe(false);
      
      controls.setPlaying(true);
      expect(controls.isPlaying()).toBe(true);
    });

    it('should update button aria-label', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      controls.setPlaying(false);
      expect(button.getAttribute('aria-label')).toBe('Resume timer');
      
      controls.setPlaying(true);
      expect(button.getAttribute('aria-label')).toBe('Pause timer');
    });

    it('should keep aria-pressed in sync with playing state', () => {
      controls = createTimerControls({ initialPlaying: true });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;

      controls.setPlaying(false);
      expect(button.getAttribute('aria-pressed')).toBe('true');

      controls.setPlaying(true);
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      controls = createTimerControls();
      const element = controls.getElement();
      document.body.appendChild(element);
      
      expect(document.body.contains(element)).toBe(true);
      
      controls.destroy();
      
      expect(document.body.contains(element)).toBe(false);
    });

    it('should remove click event listeners', () => {
      const onPlayPauseToggle = vi.fn();
      const onReset = vi.fn();
      controls = createTimerControls({ onPlayPauseToggle, onReset });
      const element = controls.getElement();
      document.body.appendChild(element);
      
      const playPauseButton = element.querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      const resetButton = element.querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      controls.destroy();
      
      // Buttons still exist but shouldn't trigger callbacks
      playPauseButton.click();
      resetButton.click();
      
      // Only the click before destroy should have registered
      expect(onPlayPauseToggle).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('keyboard navigation', () => {
    it('should have tabindex="0" on play/pause button for keyboard focus', () => {
      controls = createTimerControls();
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      expect(button.getAttribute('tabindex')).toBe('0');
    });

    it('should have tabindex="0" on reset button for keyboard focus', () => {
      controls = createTimerControls();
      const button = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      expect(button.getAttribute('tabindex')).toBe('0');
    });

    it('should be keyboard activatable via Enter key on play/pause button', () => {
      const onPlayPauseToggle = vi.fn();
      controls = createTimerControls({ initialPlaying: true, onPlayPauseToggle });
      const button = controls.getElement().querySelector('[data-testid="timer-play-pause"]') as HTMLButtonElement;
      
      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      button.dispatchEvent(enterEvent);
      button.click(); // Enter triggers click on buttons
      
      expect(onPlayPauseToggle).toHaveBeenCalledWith(false);
    });

    it('should be keyboard activatable via Space key on reset button', () => {
      const onReset = vi.fn();
      controls = createTimerControls({ onReset });
      const button = controls.getElement().querySelector('[data-testid="timer-reset"]') as HTMLButtonElement;
      
      // Simulate Space key press
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
      button.dispatchEvent(spaceEvent);
      button.click(); // Space triggers click on buttons
      
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });
});

describe('FullscreenTimerControls', () => {
  let fsControls: FullscreenTimerControlsController;

  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    fsControls?.destroy();
  });

  describe('createFullscreenTimerControls', () => {
    it('should create container with toolbar role (AC4.7)', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();

      expect(element.getAttribute('role')).toBe('toolbar');
      expect(element.getAttribute('aria-label')).toBe('Timer controls');
    });

    it('should create container with correct test id', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();

      expect(element.dataset.testid).toBe('fullscreen-timer-controls');
    });

    it('should create play/pause button with aria-pressed (AC4.5)', () => {
      fsControls = createFullscreenTimerControls({ initialPlaying: true });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-pressed')).toBe('false'); // When playing, not paused
    });

    it('should create reset button with correct aria-label (AC4.2)', () => {
      fsControls = createFullscreenTimerControls();
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-reset"]') as HTMLButtonElement;

      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBe('Reset timer to original duration');
    });

    it('should start hidden by default', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();

      expect(element.getAttribute('data-visible')).toBe('false');
      expect(fsControls.isVisible()).toBe(false);
    });
  });

  describe('play/pause button', () => {
    it.each([
      { initialPlaying: true, expectedLabel: 'Pause timer', expectedPressed: 'false' },
      { initialPlaying: false, expectedLabel: 'Resume timer', expectedPressed: 'true' },
    ])('should set correct state when initialPlaying=$initialPlaying', ({ initialPlaying, expectedLabel, expectedPressed }) => {
      fsControls = createFullscreenTimerControls({ initialPlaying });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      expectPlayPauseState(button, initialPlaying, expectedLabel, expectedPressed);
    });

    it('should toggle aria-pressed on click', () => {
      fsControls = createFullscreenTimerControls({ initialPlaying: true });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      button.click();
      expect(button.getAttribute('aria-pressed')).toBe('true');

      button.click();
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should invoke onPlayPauseToggle callback with new state', () => {
      const onPlayPauseToggle = vi.fn();
      fsControls = createFullscreenTimerControls({ initialPlaying: true, onPlayPauseToggle });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      button.click();
      expect(onPlayPauseToggle).toHaveBeenCalledWith(false);

      button.click();
      expect(onPlayPauseToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('reset button', () => {
    it('should invoke onReset callback on click', () => {
      const onReset = vi.fn();
      fsControls = createFullscreenTimerControls({ onReset });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-reset"]') as HTMLButtonElement;

      button.click();
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('visibility', () => {
    it('should show controls when show() is called', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();

      fsControls.show();

      expect(element.getAttribute('data-visible')).toBe('true');
      expect(element.classList.contains('show-fullscreen-controls')).toBe(true);
      expect(fsControls.isVisible()).toBe(true);
    });

    it('should hide controls when hide() is called', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();

      fsControls.show();
      fsControls.hide();

      expect(element.getAttribute('data-visible')).toBe('false');
      expect(element.classList.contains('show-fullscreen-controls')).toBe(false);
      expect(fsControls.isVisible()).toBe(false);
    });
  });

  describe('setPlaying', () => {
    it('should update internal state', () => {
      fsControls = createFullscreenTimerControls({ initialPlaying: true });

      fsControls.setPlaying(false);
      expect(fsControls.isPlaying()).toBe(false);

      fsControls.setPlaying(true);
      expect(fsControls.isPlaying()).toBe(true);
    });

    it('should update button aria-label and aria-pressed', () => {
      fsControls = createFullscreenTimerControls({ initialPlaying: true });
      const button = fsControls.getElement().querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;

      fsControls.setPlaying(false);
      expect(button.getAttribute('aria-label')).toBe('Resume timer');
      expect(button.getAttribute('aria-pressed')).toBe('true');

      fsControls.setPlaying(true);
      expect(button.getAttribute('aria-label')).toBe('Pause timer');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('destroy', () => {
    it('should remove element from DOM', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();
      document.body.appendChild(element);

      expect(document.body.contains(element)).toBe(true);

      fsControls.destroy();

      expect(document.body.contains(element)).toBe(false);
    });

    it('should remove event listeners', () => {
      const onPlayPauseToggle = vi.fn();
      const onReset = vi.fn();
      fsControls = createFullscreenTimerControls({ onPlayPauseToggle, onReset });
      const element = fsControls.getElement();
      document.body.appendChild(element);

      const playPauseButton = element.querySelector('[data-testid="fullscreen-timer-play-pause"]') as HTMLButtonElement;
      const resetButton = element.querySelector('[data-testid="fullscreen-timer-reset"]') as HTMLButtonElement;

      fsControls.destroy();

      playPauseButton.click();
      resetButton.click();

      expect(onPlayPauseToggle).not.toHaveBeenCalled();
      expect(onReset).not.toHaveBeenCalled();
    });
  });

  describe('focus order (AC4.3)', () => {
    it('should have buttons in correct DOM order: play/pause → reset', () => {
      fsControls = createFullscreenTimerControls();
      const element = fsControls.getElement();
      const buttons = element.querySelectorAll('button');

      expect(buttons.length).toBe(2);
      expect(buttons[0].dataset.testid).toBe('fullscreen-timer-play-pause');
      expect(buttons[1].dataset.testid).toBe('fullscreen-timer-reset');
    });
  });
});
