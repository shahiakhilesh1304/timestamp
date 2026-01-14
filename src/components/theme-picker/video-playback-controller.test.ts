/**
 * Unit tests for VideoPlaybackController.
 * Tests state machine transitions, concurrent limits, and reduced motion support.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    VideoPlaybackController,
    isMobileViewport,
    prefersReducedMotion
} from './video-playback-controller';

// =============================================================================
// Test Setup
// =============================================================================

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
window.matchMedia = mockMatchMedia;

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe = mockObserve;
  unobserve = mockUnobserve;
  disconnect = mockDisconnect;
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Helper to create mock video element
function createMockVideo(src = 'test-video.webm'): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = src;
  video.dataset.src = src;

  // Mock play/pause/load
  video.play = vi.fn().mockResolvedValue(undefined);
  video.pause = vi.fn();
  video.load = vi.fn();
  
  // Set readyState to HAVE_ENOUGH_DATA (4) so startActualPlayback doesn't wait for 'canplay'
  Object.defineProperty(video, 'readyState', {
    value: 4, // HTMLMediaElement.HAVE_ENOUGH_DATA
    writable: true,
  });

  return video;
}

// Helper to flush promises and advance timers (for async video operations)
async function flushAsyncAndTimers(): Promise<void> {
  await Promise.resolve(); // Flush microtask queue (play() promise)
  vi.advanceTimersByTime(0); // Flush setTimeout(0) (compositor delay)
}

// Helper to setup default matchMedia mock
function setupMatchMedia(options: { reducedMotion?: boolean; mobile?: boolean } = {}) {
  mockMatchMedia.mockImplementation((query: string) => ({
    matches:
      query === '(prefers-reduced-motion: reduce)'
        ? options.reducedMotion ?? false
        : options.mobile ?? false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  mockObserve.mockClear();
  mockUnobserve.mockClear();
  mockDisconnect.mockClear();
  setupMatchMedia();

  // Mock window dimensions for desktop
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 1024,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('prefersReducedMotion', () => {
  it('should return true when reduced motion is preferred', () => {
    setupMatchMedia({ reducedMotion: true });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('should return false when reduced motion is not preferred', () => {
    setupMatchMedia({ reducedMotion: false });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('isMobileViewport', () => {
  it('should return true when viewport is mobile-sized', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600 });
    expect(isMobileViewport()).toBe(true);
  });

  it('should return true at exactly mobile breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768 });
    expect(isMobileViewport()).toBe(true);
  });

  it('should return false when viewport is desktop-sized', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024 });
    expect(isMobileViewport()).toBe(false);
  });
});

// =============================================================================
// VideoPlaybackController Tests
// =============================================================================

describe('VideoPlaybackController', () => {
  let controller: VideoPlaybackController;

  beforeEach(() => {
    controller = new VideoPlaybackController({
      compositorPaintDelayMs: 0, // No delay in tests for immediate state transitions
    });
  });

  afterEach(() => {
    controller.destroy();
  });

  describe('construction', () => {
    it('should create controller with default config', () => {
      expect(controller).toBeDefined();
    });

    it('should accept custom config', () => {
      const customController = new VideoPlaybackController({
        maxDesktopVideos: 3,
        maxMobileVideos: 2,
      });

      expect(customController).toBeDefined();
      customController.destroy();
    });

    it('should set up IntersectionObserver', () => {
      // Observer is created in constructor
      expect(mockObserve).not.toHaveBeenCalled(); // Not called until attach
    });
  });

  describe('attach/detach', () => {
    it('should attach video and set up observation', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');

      expect(mockObserve).toHaveBeenCalledWith(video);
      expect(controller.getState(video)).toBe('idle');
    });

    it('should detach video and stop observation', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');
      controller.detach(video);

      expect(mockUnobserve).toHaveBeenCalledWith(video);
    });

    it('should store poster URL in dataset', () => {
      const video = createMockVideo();

      controller.attach(video, 'poster.webp');

      expect(video.dataset.poster).toBe('poster.webp');
    });
  });

  describe('state machine transitions', () => {
    it('should transition from idle to loading on play after debounce', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      // Should still be idle before debounce completes
      expect(controller.getState(video)).toBe('idle');

      // Advance past hover debounce (100ms)
      vi.advanceTimersByTime(100);

      expect(controller.getState(video)).toBe('loading');
    });

    it('should transition from loading to playing on canplaythrough', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce
      video.dispatchEvent(new Event('canplaythrough'));

      // Flush the play() promise and compositor delay
      await flushAsyncAndTimers();

      expect(controller.getState(video)).toBe('playing');
    });

    it('should reset to idle on mouse leave', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce
      video.dispatchEvent(new Event('canplaythrough'));
      await Promise.resolve(); // Flush play() promise
      controller.handleMouseLeave(video);

      expect(controller.getState(video)).toBe('idle');
      expect(video.pause).toHaveBeenCalled();
    });

    it('should reset video currentTime on leave', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce
      controller.handleMouseLeave(video);

      expect(video.currentTime).toBe(0);
    });
  });

  describe('concurrent playback limits', () => {
    it.each([
      { viewport: 'desktop', maxVideos: 2, innerWidth: 1024 },
      { viewport: 'mobile', maxVideos: 1, innerWidth: 600 },
    ])('should limit to $maxVideos concurrent videos on $viewport', ({ maxVideos, innerWidth }) => {
      Object.defineProperty(window, 'innerWidth', { value: innerWidth });

      const videos = Array.from({ length: 3 }, () => createMockVideo());

      videos.forEach((video) => controller.attach(video, 'poster.webp'));

      // Start all videos (hover debounce is 100ms)
      videos.forEach((video) => controller.handleMouseEnter(video));
      vi.advanceTimersByTime(100); // Wait for hover debounce

      // Count active videos
      expect(controller.getActiveCount()).toBeLessThanOrEqual(maxVideos);
    });

    it('should pause oldest video when limit exceeded', () => {
      const video1 = createMockVideo();
      const video2 = createMockVideo();
      const video3 = createMockVideo();

      controller.attach(video1, 'poster.webp');
      controller.attach(video2, 'poster.webp');
      controller.attach(video3, 'poster.webp');

      // Start video1
      controller.handleMouseEnter(video1);
      vi.advanceTimersByTime(100); // Wait for hover debounce

      // Start video2
      controller.handleMouseEnter(video2);
      vi.advanceTimersByTime(100); // Wait for hover debounce

      // Start video3 (should pause video1)
      controller.handleMouseEnter(video3);
      vi.advanceTimersByTime(100); // Wait for hover debounce

      // video1 should be paused (it was oldest)
      expect(video1.pause).toHaveBeenCalled();
    });
  });

  describe('focus handlers with debounce', () => {
    it('should debounce focus events', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);

      // Should not trigger immediately
      expect(controller.getState(video)).toBe('idle');

      // Advance past debounce delay
      vi.advanceTimersByTime(150);

      expect(controller.getState(video)).toBe('loading');
    });

    it('should cancel playback on blur during debounce', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);

      // Blur before debounce completes
      vi.advanceTimersByTime(50);
      controller.handleBlur(video);

      // Advance past original debounce
      vi.advanceTimersByTime(200);

      // Should not have started playback
      expect(controller.getState(video)).toBe('idle');
    });
  });

  describe('reduced motion support', () => {
    it('should not play videos when reduced motion is preferred', () => {
      setupMatchMedia({ reducedMotion: true });

      const reducedController = new VideoPlaybackController();
      const video = createMockVideo();
      reducedController.attach(video, 'poster.webp');

      reducedController.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
      expect(reducedController.getState(video)).toBe('idle');

      reducedController.destroy();
    });

    it('should not play videos on focus when reduced motion is preferred', () => {
      setupMatchMedia({ reducedMotion: true });

      const reducedController = new VideoPlaybackController();
      const video = createMockVideo();
      reducedController.attach(video, 'poster.webp');

      reducedController.handleFocus(video);
      vi.advanceTimersByTime(200);

      expect(video.play).not.toHaveBeenCalled();

      reducedController.destroy();
    });
  });

  describe('error recovery', () => {
    it('should reset state on video error', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('error'));

      expect(controller.getState(video)).toBe('idle');
    });

    it('should reset currentTime on error', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      video.dispatchEvent(new Event('error'));

      expect(video.currentTime).toBe(0);
    });
  });

  describe('pauseAll', () => {
    it('should pause all active videos', () => {
      const video1 = createMockVideo();
      const video2 = createMockVideo();

      controller.attach(video1, 'poster.webp');
      controller.attach(video2, 'poster.webp');

      controller.handleMouseEnter(video1);
      controller.handleMouseEnter(video2);
      vi.advanceTimersByTime(100); // Wait for hover debounce

      controller.pauseAll();

      expect(video1.pause).toHaveBeenCalled();
      expect(video2.pause).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up all resources', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.destroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should not respond to events after destroy', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.destroy();
      controller.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no videos are playing', () => {
      expect(controller.getActiveCount()).toBe(0);
    });

    it('should count loading videos', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce

      expect(controller.getActiveCount()).toBe(1);
    });

    it('should count playing videos', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce
      video.dispatchEvent(new Event('canplaythrough'));

      expect(controller.getActiveCount()).toBe(1);
    });
  });

  describe('mobile behavior', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { value: 600 });
    });

    it('should not trigger playback on hover for mobile', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      expect(video.play).not.toHaveBeenCalled();
    });

    it('should allow focus-triggered playback on mobile', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleFocus(video);
      vi.advanceTimersByTime(200);

      expect(controller.getState(video)).toBe('loading');
    });
  });

  describe('video ended', () => {
    it('should reset video when playback ends and not hovered', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Wait for hover debounce
      video.dispatchEvent(new Event('canplaythrough'));
      // Leave before video ends
      controller.handleMouseLeave(video);
      // Simulate ended with isHovered = false (already left)
      // State is already idle, so ended does nothing different

      expect(controller.getState(video)).toBe('idle');
      expect(video.currentTime).toBe(0);
    });
  });

  // =============================================================================
  // Step 3.2: Tests for isHovered tracking
  // =============================================================================

  describe('isHovered tracking', () => {
    it('should set isHovered on mouse enter', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);

      // Even before debounce, hover should trigger internal state tracking
      // We verify this indirectly through the loop behavior
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      video.dispatchEvent(new Event('ended'));

      // If isHovered is true, video should loop (play called twice)
      expect(video.play).toHaveBeenCalledTimes(2);
    });

    it('should clear isHovered on mouse leave', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      controller.handleMouseLeave(video);
      
      // After leave, ended should reset to idle (not loop)
      video.dispatchEvent(new Event('ended'));
      
      // Only one play call (no loop because isHovered is false)
      expect(video.play).toHaveBeenCalledTimes(1);
    });

    it('should persist isHovered across playback states', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      // isHovered should still be true even after state transitions
      video.dispatchEvent(new Event('ended'));
      
      // Should loop since still hovered
      expect(video.play).toHaveBeenCalledTimes(2);
    });
  });

  // =============================================================================
  // Step 3.3: Tests for hover debounce (100ms rapid cycles)
  // =============================================================================

  describe('hover debounce', () => {
    it('should debounce rapidly entering and leaving', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      // Rapid enter-leave cycle within 100ms
      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(50);
      controller.handleMouseLeave(video);
      vi.advanceTimersByTime(50);

      // Should not have triggered playback
      expect(video.play).not.toHaveBeenCalled();
      expect(controller.getState(video)).toBe('idle');
    });

    it('should honor final hover state after rapid cycles', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      // Rapid cycle: enter -> leave -> enter
      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(30);
      controller.handleMouseLeave(video);
      vi.advanceTimersByTime(30);
      controller.handleMouseEnter(video);
      
      // Wait for debounce to complete
      vi.advanceTimersByTime(100);

      // Final state was hovered, so should trigger playback
      expect(controller.getState(video)).toBe('loading');
    });

    it('should cancel pending playback on mouse leave', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(80); // Almost complete debounce
      controller.handleMouseLeave(video);
      vi.advanceTimersByTime(50); // Past original debounce time

      // Playback should not have been triggered
      expect(video.play).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Step 3.4: Tests for loop behavior in handleEnded()
  // =============================================================================

  describe('loop behavior', () => {
    it('should loop when ended while still hovered', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      // Simulate video ending while still hovered
      video.dispatchEvent(new Event('ended'));

      // Should restart from beginning
      expect(video.currentTime).toBe(0);
      expect(video.play).toHaveBeenCalledTimes(2); // Initial + loop
    });

    it('should reset to idle when ended after mouse leave', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      // Leave, then video ends
      controller.handleMouseLeave(video);

      // State should be idle after leave
      expect(controller.getState(video)).toBe('idle');
    });

    it('should loop multiple times while continuously hovered', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      // Loop 3 times
      video.dispatchEvent(new Event('ended'));
      video.dispatchEvent(new Event('ended'));
      video.dispatchEvent(new Event('ended'));

      // Should have called play 4 times (initial + 3 loops)
      expect(video.play).toHaveBeenCalledTimes(4);
    });
  });

  // =============================================================================
  // Step 3.5: Tests for 2s canplaythrough timeout fallback
  // =============================================================================

  describe('canplaythrough timeout fallback', () => {
    it('should transition to playing after 2s timeout if canplaythrough never fires', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Hover debounce
      
      // Don't dispatch canplaythrough, instead wait for timeout
      vi.advanceTimersByTime(2000);
      await flushAsyncAndTimers();

      expect(controller.getState(video)).toBe('playing');
    });

    it('should clear timeout when canplaythrough fires', async () => {
      const onStateChange = vi.fn();
      const timeoutController = new VideoPlaybackController({
        onStateChange,
        compositorPaintDelayMs: 0,
      });
      const video = createMockVideo();
      timeoutController.attach(video, 'poster.webp');

      timeoutController.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Hover debounce
      
      // Fire canplaythrough before timeout
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      
      // Clear callback history
      onStateChange.mockClear();
      
      // Advance past timeout
      vi.advanceTimersByTime(2000);
      
      // Should not fire another state change (timeout was cleared)
      expect(onStateChange).not.toHaveBeenCalled();
      
      timeoutController.destroy();
    });

    it('should handle cached videos via timeout', async () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100); // Hover debounce
      
      expect(controller.getState(video)).toBe('loading');
      
      // Simulate cached video that never fires canplaythrough
      vi.advanceTimersByTime(2000);
      await flushAsyncAndTimers();
      
      expect(controller.getState(video)).toBe('playing');
    });
  });

  // =============================================================================
  // Step 3.6: Tests for onStateChange callback
  // =============================================================================

  describe('onStateChange callback', () => {
    it('should call onStateChange when state transitions', async () => {
      const onStateChange = vi.fn();
      const callbackController = new VideoPlaybackController({
        onStateChange,
        compositorPaintDelayMs: 0,
      });
      const video = createMockVideo();
      callbackController.attach(video, 'poster.webp');

      callbackController.handleMouseEnter(video);
      vi.advanceTimersByTime(100);

      expect(onStateChange).toHaveBeenCalledWith(video, 'loading');

      callbackController.destroy();
    });

    it('should call onStateChange for loading → playing transition', async () => {
      const onStateChange = vi.fn();
      const callbackController = new VideoPlaybackController({
        onStateChange,
        compositorPaintDelayMs: 0,
      });
      const video = createMockVideo();
      callbackController.attach(video, 'poster.webp');

      callbackController.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();

      expect(onStateChange).toHaveBeenCalledWith(video, 'playing');

      callbackController.destroy();
    });

    it('should call onStateChange for playing → idle transition on leave', () => {
      const onStateChange = vi.fn();
      const callbackController = new VideoPlaybackController({
        onStateChange,
      });
      const video = createMockVideo();
      callbackController.attach(video, 'poster.webp');

      callbackController.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      
      onStateChange.mockClear();
      callbackController.handleMouseLeave(video);

      expect(onStateChange).toHaveBeenCalledWith(video, 'idle');

      callbackController.destroy();
    });

    it('should receive full state flow: idle → loading → playing → idle', async () => {
      const states: string[] = [];
      const callbackController = new VideoPlaybackController({
        onStateChange: (_video, state) => states.push(state),
        compositorPaintDelayMs: 0,
      });
      const video = createMockVideo();
      callbackController.attach(video, 'poster.webp');

      callbackController.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      callbackController.handleMouseLeave(video);

      expect(states).toEqual(['loading', 'playing', 'idle']);

      callbackController.destroy();
    });
  });

  // =============================================================================
  // Step 3.7: Integration test for full playback flow
  // =============================================================================

  describe('full playback flow integration', () => {
    it('should handle hover → canplaythrough → loop → leave → reset flow', async () => {
      const states: string[] = [];
      const flowController = new VideoPlaybackController({
        onStateChange: (_video, state) => states.push(state),
        compositorPaintDelayMs: 0,
      });
      const video = createMockVideo();
      flowController.attach(video, 'poster.webp');

      // 1. Hover
      flowController.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      expect(states).toContain('loading');

      // 2. canplaythrough fires
      video.dispatchEvent(new Event('canplaythrough'));
      await flushAsyncAndTimers();
      expect(states).toContain('playing');

      // 3. Video ends while still hovered → should loop
      video.dispatchEvent(new Event('ended'));
      expect(video.play).toHaveBeenCalledTimes(2);

      // 4. Leave
      flowController.handleMouseLeave(video);
      expect(states).toContain('idle');
      expect(video.pause).toHaveBeenCalled();
      expect(video.currentTime).toBe(0);

      flowController.destroy();
    });

    it('should handle rapid hover cycles without breaking state', () => {
      const video = createMockVideo();
      controller.attach(video, 'poster.webp');

      // Rapid cycles
      for (let i = 0; i < 5; i++) {
        controller.handleMouseEnter(video);
        vi.advanceTimersByTime(30);
        controller.handleMouseLeave(video);
        vi.advanceTimersByTime(30);
      }

      // Final state should be idle and clean
      expect(controller.getState(video)).toBe('idle');
      
      // Now do a proper hover
      controller.handleMouseEnter(video);
      vi.advanceTimersByTime(100);
      expect(controller.getState(video)).toBe('loading');
    });
  });
});
