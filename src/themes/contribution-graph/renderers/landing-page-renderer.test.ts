import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createThemeTestContainer, mountLandingPageRenderer } from '../test-utils';
import { contributionGraphLandingPageRenderer } from './landing-page-renderer';

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

describe('ContributionGraph Landing Page Renderer', () => {
  let container: HTMLElement;
  let cleanup: () => void;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    // Override canvas context mock
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(
      createFullCanvasContextMock()
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Mock ResizeObserver as a class
    class MockResizeObserver {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
      constructor(_callback: ResizeObserverCallback) {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const testContainer = createThemeTestContainer();
    container = testContainer.container;
    cleanup = testContainer.cleanup;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  describe('mount', () => {
    it('should create canvas element when renderer mounts', () => {
      const renderer = mountLandingPageRenderer(container);
      const canvas = container.querySelector('canvas');
      expect(canvas).not.toBeNull();
      renderer.destroy();
    });

    it('should set aria-hidden on container when renderer mounts', () => {
      const renderer = mountLandingPageRenderer(container);
      expect(container.getAttribute('aria-hidden')).toBe('true');
      renderer.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up all elements when destroy is called', () => {
      const renderer = contributionGraphLandingPageRenderer(container);
      renderer.mount(container);
      renderer.destroy();
      expect(container.children.length).toBe(0);
    });
  });

  describe('onAnimationStateChange', () => {
    it('should handle animation state changes', () => {
      const renderer = contributionGraphLandingPageRenderer(container);
      renderer.mount(container);

      // Should not throw
      expect(() => {
        renderer.onAnimationStateChange({ shouldAnimate: false, prefersReducedMotion: true, reason: 'test' });
      }).not.toThrow();

      renderer.destroy();
    });
  });

  describe('setSize', () => {
    it('should handle size updates', () => {
      const renderer = contributionGraphLandingPageRenderer(container);
      renderer.mount(container);

      // Should not throw
      expect(() => {
        renderer.setSize(800, 600);
      }).not.toThrow();

      renderer.destroy();
    });
  });

  describe('getElementCount', () => {
    it('should return element counts when background is mounted', () => {
      const renderer = mountLandingPageRenderer(container);
      const counts = renderer.getElementCount();
      expect(counts).toHaveProperty('total');
      expect(counts).toHaveProperty('animated');
      renderer.destroy();
    });

    it('should return non-negative counts', () => {
      const renderer = mountLandingPageRenderer(container);
      const counts = renderer.getElementCount();
      expect(counts.total).toBeGreaterThanOrEqual(0);
      expect(counts.animated).toBeGreaterThanOrEqual(0);
      renderer.destroy();
    });
  });
});
