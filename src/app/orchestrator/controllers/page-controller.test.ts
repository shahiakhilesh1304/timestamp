/**
 * Tests for createPageController
 *
 * @module orchestrator/controllers/page-controller.test
 */

import { reducedMotionManager } from '@core/utils/accessibility';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageController, type AnimationStateAwareRenderer } from './page-controller';

// Mock the accessibility module
vi.mock('@core/utils/accessibility', () => ({
  reducedMotionManager: {
    isActive: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe('createPageController', () => {
  let mockIsActive: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;
  let mockRenderer: AnimationStateAwareRenderer;
  let subscribeCallback: ((active: boolean) => void) | null = null;

  beforeEach(() => {
    mockIsActive = vi.mocked(reducedMotionManager.isActive);
    mockSubscribe = vi.mocked(reducedMotionManager.subscribe);
    mockUnsubscribe = vi.fn();

    // Capture the subscribe callback for later testing
    mockSubscribe.mockImplementation((callback: (active: boolean) => void) => {
      subscribeCallback = callback;
      return mockUnsubscribe;
    });

    // Default to reduced motion OFF
    mockIsActive.mockReturnValue(false);

    // Create a mock renderer with required hook
    mockRenderer = {
      onAnimationStateChange: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    subscribeCallback = null;
    // Clean up any attribute that may have been set
    document.documentElement.removeAttribute('data-reduced-motion');
  });

  describe('init()', () => {
    it.each([
      { active: false, expected: 'false' },
      { active: true, expected: 'true' },
    ])('should set data-reduced-motion to $expected when active=$active', ({ active, expected }) => {
      mockIsActive.mockReturnValue(active);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe(expected);
      controller.destroy();
    });

    it('should subscribe to reducedMotionManager changes', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
      controller.destroy();
    });
  });

  describe('reduced-motion change handling', () => {
    it('should update attribute and call onAnimationStateChange when reduced-motion preference changes', () => {
      mockIsActive.mockReturnValue(false);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      subscribeCallback?.(true);
      subscribeCallback?.(false);

      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledTimes(2);
      expect(mockRenderer.onAnimationStateChange).toHaveBeenNthCalledWith(1, expect.objectContaining({
        shouldAnimate: false,
        prefersReducedMotion: true,
        reason: 'reduced-motion',
      }));
      expect(mockRenderer.onAnimationStateChange).toHaveBeenNthCalledWith(2, expect.objectContaining({
        shouldAnimate: true,
        prefersReducedMotion: false,
        reason: 'reduced-motion',
      }));
      controller.destroy();
    });

    it('should handle null renderer gracefully during transitions', () => {
      mockIsActive.mockReturnValue(false);
      let currentRenderer: AnimationStateAwareRenderer | null = mockRenderer;

      const controller = createPageController({
        getCurrentRenderer: () => currentRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Set renderer to null (simulating theme transition)
      currentRenderer = null;

      // Should not throw when preference changes with null renderer
      expect(() => {
        subscribeCallback?.(true);
      }).not.toThrow();

      // Attribute should still be updated even without renderer
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
      controller.destroy();
    });

  });

  describe('getMountContext()', () => {
    it.each([
      { active: false, expected: { shouldAnimate: true, prefersReducedMotion: false } },
      { active: true, expected: { shouldAnimate: false, prefersReducedMotion: true } },
    ])('should return mount context with getter when active=$active', ({ active, expected }) => {
      mockIsActive.mockReturnValue(active);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });

      const context = controller.getMountContext();
      expect(typeof context.getAnimationState).toBe('function');
      expect(context.getAnimationState()).toEqual(expected);
    });
  });

  describe('isReducedMotionActive()', () => {
    it('should return current reduced-motion state', () => {
      mockIsActive.mockReturnValue(false);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });

      expect(controller.isReducedMotionActive()).toBe(false);

      mockIsActive.mockReturnValue(true);
      expect(controller.isReducedMotionActive()).toBe(true);
    });
  });

  describe('destroy() - removeAttributeOnDestroy=true', () => {
    it('should unsubscribe from reducedMotionManager', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      expect(mockUnsubscribe).not.toHaveBeenCalled();

      controller.destroy();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should be safe to destroy before init', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });

      expect(() => controller.destroy()).not.toThrow();
      expect(mockUnsubscribe).not.toHaveBeenCalled();
    });

    it('should remove data-reduced-motion attribute when removeAttributeOnDestroy=true', () => {
      mockIsActive.mockReturnValue(true);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');

      controller.destroy();

      expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
    });

    it('should be safe to call destroy multiple times', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      expect(() => {
        controller.destroy();
        controller.destroy();
      }).not.toThrow();

      // Unsubscribe should only be called once
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy() - removeAttributeOnDestroy=false', () => {
    it('should NOT remove data-reduced-motion attribute when removeAttributeOnDestroy=false', () => {
      mockIsActive.mockReturnValue(true);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: false,
      });
      controller.init();

      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');

      controller.destroy();

      // Attribute is NOT removed (shared lifecycle)
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    });
  });

  describe('visibility change handling', () => {
    it('should pause animations when tab becomes hidden', () => {
      mockIsActive.mockReturnValue(false);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Simulate tab becoming hidden
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldAnimate: false,
          prefersReducedMotion: false,
          reason: 'page-hidden',
        })
      );
      // PERF: Verify attribute is set to pause CSS animations
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
      controller.destroy();
    });

    it('should resume animations when tab becomes visible', () => {
      mockIsActive.mockReturnValue(false);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // First hide the tab
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // Clear mock calls
      vi.clearAllMocks();

      // Simulate tab becoming visible
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldAnimate: true,
          prefersReducedMotion: false,
          reason: 'page-hidden',
        })
      );
      // PERF: Verify attribute is cleared to resume CSS animations
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
      controller.destroy();
    });

    it('should set data-reduced-motion attribute even with null renderer', () => {
      mockIsActive.mockReturnValue(false);
      let currentRenderer: AnimationStateAwareRenderer | null = mockRenderer;

      const controller = createPageController({
        getCurrentRenderer: () => currentRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Set renderer to null (simulating theme transition)
      currentRenderer = null;

      // Should not throw and should still update attribute
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      // PERF: Attribute should still be set to pause CSS animations even without renderer
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');

      controller.destroy();
    });

    it('should respect reduced-motion when visibility changes', () => {
      mockIsActive.mockReturnValue(true);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Tab becomes visible, but reduced-motion is active
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldAnimate: false,
          prefersReducedMotion: true,
          reason: 'page-hidden',
        })
      );
      controller.destroy();
    });

    it('should remove visibility listener on destroy', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      controller.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('reduced-motion × visibility matrix', () => {
    // Matrix tests for reduced-motion state changes
    // These tests verify behavior under different combinations

    it('should handle rapid preference toggling', () => {
      mockIsActive.mockReturnValue(false);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Rapid toggling
      subscribeCallback?.(true);
      subscribeCallback?.(false);
      subscribeCallback?.(true);
      subscribeCallback?.(false);

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledTimes(4);
      expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('false');
      controller.destroy();
    });

    it('should correctly report state after multiple changes', () => {
      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Initial state
      mockIsActive.mockReturnValue(false);
      expect(controller.isReducedMotionActive()).toBe(false);

      // After change
      mockIsActive.mockReturnValue(true);
      subscribeCallback?.(true);
      expect(controller.isReducedMotionActive()).toBe(true);

      controller.destroy();
    });

    it('should handle visibility change while reduced-motion is active', () => {
      mockIsActive.mockReturnValue(true);

      const controller = createPageController({
        getCurrentRenderer: () => mockRenderer,
        removeAttributeOnDestroy: true,
      });
      controller.init();

      // Tab hidden with reduced-motion active
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldAnimate: false,
          prefersReducedMotion: true,
          reason: 'page-hidden',
        })
      );

      // Tab visible with reduced-motion active
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
      document.dispatchEvent(new Event('visibilitychange'));

      expect(mockRenderer.onAnimationStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          shouldAnimate: false,
          prefersReducedMotion: true,
          reason: 'page-hidden',
        })
      );

      controller.destroy();
    });
  });
});
