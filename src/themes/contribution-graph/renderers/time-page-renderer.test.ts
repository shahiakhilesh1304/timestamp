/**
 * Tests for canvas-based time page renderer.
 */

import type { TimePageRenderer } from '@themes/shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasTimePageRenderer } from './time-page-renderer';

/**
 * Create a more complete canvas 2D context mock for testing.
 */
function createFullCanvasContextMock(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: [] }),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    fillText: vi.fn(),
    setTransform: vi.fn(),
    quadraticCurveTo: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

describe('createCanvasTimePageRenderer', () => {
  let renderer: TimePageRenderer;
  let container: HTMLElement;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let mockObserve: ReturnType<typeof vi.fn>;
  let mockUnobserve: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Override canvas context mock
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(
      createFullCanvasContextMock()
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Mock ResizeObserver as a class
    mockObserve = vi.fn();
    mockUnobserve = vi.fn();
    mockDisconnect = vi.fn();
    
    class MockResizeObserver {
      observe = mockObserve;
      unobserve = mockUnobserve;
      disconnect = mockDisconnect;
      constructor(_callback: ResizeObserverCallback) {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    // Create container
    container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 800,
        height: 600,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }),
    });
    document.body.appendChild(container);

    // Create renderer
    const targetDate = new Date(Date.now() + 3600000); // 1 hour from now
    renderer = createCanvasTimePageRenderer(targetDate);
  });

  afterEach(async () => {
    await renderer.destroy();
    container.remove();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  describe('factory', () => {
    it('should create renderer with required methods', () => {
      expect(renderer).toBeDefined();
      expect(typeof renderer.mount).toBe('function');
      expect(typeof renderer.updateTime).toBe('function');
      expect(typeof renderer.onAnimationStateChange).toBe('function');
      expect(typeof renderer.onCounting).toBe('function');
      expect(typeof renderer.onCelebrating).toBe('function');
      expect(typeof renderer.onCelebrated).toBe('function');
      expect(typeof renderer.destroy).toBe('function');
      expect(typeof renderer.getResourceTracker).toBe('function');
    });
  });

  describe('mount', () => {
    it('should append canvas to container', () => {
      renderer.mount(container);

      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('should set up resize observer', () => {
      renderer.mount(container);

      expect(mockObserve).toHaveBeenCalledWith(container);
    });

    it('should accept animation state context', () => {
      const getAnimationState = () => ({ shouldAnimate: true, prefersReducedMotion: false });

      expect(() => {
        renderer.mount(container, { getAnimationState });
      }).not.toThrow();
    });
  });

  describe('updateTime', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should accept time remaining object', () => {
      const time = {
        total: 3600000,
        days: 0,
        hours: 1,
        minutes: 0,
        seconds: 0,
        milliseconds: 0,
      };

      expect(() => renderer.updateTime(time)).not.toThrow();
    });

    it('should update display on time change', () => {
      const time1 = { total: 3600000, days: 0, hours: 1, minutes: 0, seconds: 0, milliseconds: 0 };
      const time2 = { total: 3599000, days: 0, hours: 0, minutes: 59, seconds: 59, milliseconds: 0 };

      renderer.updateTime(time1);
      expect(() => renderer.updateTime(time2)).not.toThrow();
    });
  });

  describe('onAnimationStateChange', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should handle animation enabled', () => {
      expect(() => {
        renderer.onAnimationStateChange({ shouldAnimate: true, prefersReducedMotion: false });
      }).not.toThrow();
    });

    it('should handle animation disabled', () => {
      expect(() => {
        renderer.onAnimationStateChange({ shouldAnimate: false, prefersReducedMotion: false });
      }).not.toThrow();
    });

    it('should handle reduced motion preference', () => {
      expect(() => {
        renderer.onAnimationStateChange({ shouldAnimate: true, prefersReducedMotion: true });
      }).not.toThrow();
    });
  });

  describe('onCounting', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should reset to counting state', () => {
      expect(() => renderer.onCounting()).not.toThrow();
    });
  });

  describe('onCelebrating', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should handle celebration without message', () => {
      expect(() => renderer.onCelebrating()).not.toThrow();
    });

    it('should handle celebration with message', () => {
      expect(() => {
        renderer.onCelebrating({
          fullMessage: 'Happy New Year!',
          message: {
            forTextContent: 'Happy New Year!',
            forAriaLabel: 'Happy New Year!',
          },
        });
      }).not.toThrow();
    });

    it('should handle celebration with empty message', () => {
      expect(() => {
        renderer.onCelebrating({ fullMessage: '' });
      }).not.toThrow();
    });
  });

  describe('onCelebrated', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should handle celebrated state without message', () => {
      expect(() => renderer.onCelebrated()).not.toThrow();
    });

    it('should handle celebrated state with message', () => {
      expect(() => {
        renderer.onCelebrated({
          fullMessage: 'Countdown Complete!',
          message: {
            forTextContent: 'Countdown Complete!',
            forAriaLabel: 'Countdown Complete!',
          },
        });
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should remove canvas from container', async () => {
      expect(container.querySelector('canvas')).not.toBeNull();

      await renderer.destroy();

      expect(container.querySelector('canvas')).toBeNull();
    });

    it('should disconnect resize observer', async () => {
      await renderer.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should clean up resource tracker', async () => {
      const tracker = renderer.getResourceTracker();

      await renderer.destroy();

      // After destroy, tracker should be cleared
      expect(tracker.timeouts).toHaveLength(0);
      expect(tracker.intervals).toHaveLength(0);
    });
  });

  describe('updateContainer', () => {
    beforeEach(() => {
      renderer.mount(container);
    });

    it('should move canvas to new container', () => {
      const newContainer = document.createElement('div');
      Object.defineProperty(newContainer, 'getBoundingClientRect', {
        value: () => ({
          width: 1024,
          height: 768,
          top: 0,
          left: 0,
          right: 1024,
          bottom: 768,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }),
      });
      document.body.appendChild(newContainer);

      renderer.updateContainer?.(newContainer);

      expect(newContainer.querySelector('canvas')).not.toBeNull();
      expect(container.querySelector('canvas')).toBeNull();

      newContainer.remove();
    });
  });

  describe('getResourceTracker', () => {
    it('should return resource tracker object', () => {
      const tracker = renderer.getResourceTracker();

      expect(tracker).toBeDefined();
      expect(Array.isArray(tracker.timeouts)).toBe(true);
      expect(Array.isArray(tracker.intervals)).toBe(true);
      expect(Array.isArray(tracker.rafs)).toBe(true);
      expect(Array.isArray(tracker.observers)).toBe(true);
      expect(Array.isArray(tracker.listeners)).toBe(true);
    });
  });
});
