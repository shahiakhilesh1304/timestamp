/**
 * Video Playback Controller
 *
 * Centralized management of video playback for theme preview cards.
 * Handles hover/focus triggers, concurrent playback limits, and memory management.
 *
 * @remarks
 * Key features:
 * - State machine prevents race conditions during playback transitions
 * - Concurrent limits: 1 video on mobile, 2 on desktop
 * - IntersectionObserver for viewport-based playback on mobile
 * - Buffer release saves memory when videos exit viewport
 * - Respects `prefers-reduced-motion` preference
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/** Video playback states */
export type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

/** Internal video tracking data */
interface VideoTrackingData {
  state: PlaybackState;
  videoSrc: string;
  playStartTime: number;
  /**
   * Whether the card is currently hovered or focused.
   * Used to determine loop behavior on video end.
   */
  isHovered: boolean;
  /**
   * Whether the first frame has been loaded (loadeddata event fired).
   * Used to ensure seamless image-to-video transition without flash.
   */
  hasFirstFrame: boolean;
}

/** Configuration options for the playback controller */
export interface VideoPlaybackControllerConfig {
  /** Maximum concurrent videos on desktop (default: 2) */
  maxDesktopVideos?: number;
  /** Maximum concurrent videos on mobile (default: 1) */
  maxMobileVideos?: number;
  /** IntersectionObserver threshold (default: 0.5) */
  intersectionThreshold?: number;
  /** Debounce delay for focus events in ms (default: 150) */
  focusDebounceMs?: number;
  /** Debounce delay for intersection callbacks in ms (default: 300) */
  intersectionDebounceMs?: number;
  /** Debounce delay for hover events in ms (default: 100) */
  hoverDebounceMs?: number;
  /** Timeout for canplaythrough fallback in ms (default: 2000) */
  canplaythroughTimeoutMs?: number;
  /**
   * Delay in ms after video starts playing before showing it (default: 150).
   * Set to 0 in tests to avoid waiting.
   */
  compositorPaintDelayMs?: number;
  /**
   * Callback invoked when a video's playback state changes.
   * Use this to coordinate UI elements (e.g., play icon visibility) with playback state.
   *
   * @param video - The video element whose state changed
   * @param state - The new playback state
   */
  onStateChange?: (video: HTMLVideoElement, state: PlaybackState) => void;
}

// =============================================================================
// Constants
// =============================================================================

/** Default configuration values */
const DEFAULT_CONFIG: Required<Omit<VideoPlaybackControllerConfig, 'onStateChange'>> & Pick<VideoPlaybackControllerConfig, 'onStateChange'> = {
  maxDesktopVideos: 2,
  maxMobileVideos: 1,
  intersectionThreshold: 0.5,
  focusDebounceMs: 150,
  intersectionDebounceMs: 300,
  hoverDebounceMs: 100,
  canplaythroughTimeoutMs: 2000,
  compositorPaintDelayMs: 150,
  onStateChange: undefined,
};

/** Mobile breakpoint (matches project's mobile breakpoint) */
const MOBILE_BREAKPOINT = 768;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if user prefers reduced motion.
 * @returns true if reduced motion is preferred
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Check if current viewport is mobile-sized.
 * @returns true if viewport width is at or below mobile breakpoint
 */
export function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

// =============================================================================
// VideoPlaybackController Class
// =============================================================================

/**
 * Centralized controller for video playback in theme preview cards.
 *
 * @example
 * ```typescript
 * // Create controller instance
 * const controller = new VideoPlaybackController();
 *
 * // Attach to a video element
 * controller.attach(videoElement, posterUrl);
 *
 * // Cleanup when done
 * controller.destroy();
 * ```
 */
export class VideoPlaybackController {
  private config: Required<Omit<VideoPlaybackControllerConfig, 'onStateChange'>> & Pick<VideoPlaybackControllerConfig, 'onStateChange'>;
  private activeVideos: Map<HTMLVideoElement, VideoTrackingData> = new Map();
  private intersectionObserver: IntersectionObserver | null = null;
  private focusDebounceTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> = new Map();
  private intersectionDebounceTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> =
    new Map();
  private hoverDebounceTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> = new Map();
  private canplaythroughTimeoutTimers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>> =
    new Map();
  /** Pending compositor delay timeouts for smooth video reveal after first frame */
  private pendingRafCallbacks: Map<HTMLVideoElement, number> = new Map();
  /** Pending loadeddata event listeners (for cleanup if user leaves during load) */
  private pendingLoadedDataListeners: Map<HTMLVideoElement, () => void> = new Map();
  /** Current viewport mode (mobile or desktop) */
  private currentViewportMode: 'mobile' | 'desktop';
  /** Bound resize handler for cleanup */
  private boundHandleResize: () => void;
  private isDestroyed = false;

  /**
   * Create a new VideoPlaybackController.
   * @param config - Optional configuration overrides
   */
  constructor(config: VideoPlaybackControllerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize current viewport mode
    this.currentViewportMode = isMobileViewport() ? 'mobile' : 'desktop';

    // Set up IntersectionObserver for mobile viewport detection
    this.setupIntersectionObserver();

    // Listen for viewport resize to handle mobile/desktop transitions
    this.boundHandleResize = this.handleViewportResize.bind(this);
    window.addEventListener('resize', this.boundHandleResize);
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Attach the controller to a video element.
   * Sets up event listeners for hover, focus, and intersection.
   *
   * @param video - The video element to control
   * @param posterUrl - URL of the poster image for fallback
   */
  public attach(video: HTMLVideoElement, posterUrl: string): void {
    if (this.isDestroyed) return;

    // Initialize tracking data
    this.activeVideos.set(video, {
      state: 'idle',
      videoSrc: video.src || video.dataset.src || '',
      playStartTime: 0,
      isHovered: false,
      hasFirstFrame: false,
    });

    // Set up event listeners
    this.setupVideoEventListeners(video);

    // Observe for viewport intersection (mobile)
    this.intersectionObserver?.observe(video);

    // Store poster URL for graceful degradation
    video.dataset.poster = posterUrl;
  }

  /**
   * Detach the controller from a video element.
   * Removes event listeners and stops playback.
   *
   * @param video - The video element to detach
   */
  public detach(video: HTMLVideoElement): void {
    // Cancel any pending debounce timers
    this.clearDebounceTimer(video, 'focus');
    this.clearDebounceTimer(video, 'intersection');
    this.clearDebounceTimer(video, 'hover');
    this.clearDebounceTimer(video, 'canplaythrough');
    
    // Cancel any pending timeout
    const pendingTimeout = this.pendingRafCallbacks.get(video);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout as unknown as ReturnType<typeof setTimeout>);
      this.pendingRafCallbacks.delete(video);
    }
    
    // Clean up pending loadeddata listener
    this.cleanupLoadedDataListener(video);

    // Stop playback
    this.stopVideo(video);

    // Stop observing
    this.intersectionObserver?.unobserve(video);

    // Remove from tracking
    this.activeVideos.delete(video);
  }

  /**
   * Handle mouse enter event on video card.
   * Sets isHovered immediately, starts preloading video, then triggers playback after debounce
   * on desktop if not in reduced motion mode.
   *
   * @param video - The video element
   */
  public handleMouseEnter(video: HTMLVideoElement): void {
    if (this.isDestroyed || prefersReducedMotion() || isMobileViewport()) return;

    const data = this.activeVideos.get(video);
    if (!data) return;

    // Set isHovered immediately
    data.isHovered = true;

    // Start preloading video immediately (before debounce) so it's ready when we play
    // This helps avoid race conditions where play() is called before video is loaded
    // Always use video.dataset.src (current URL after color mode changes) not cached videoSrc
    const currentSrc = video.dataset.src || data.videoSrc;
    if (!video.src && currentSrc) {
      data.videoSrc = currentSrc; // Update cached src
      video.src = currentSrc;
      video.load();
    }

    // Clear any existing debounce timer
    this.clearDebounceTimer(video, 'hover');

    // Debounce playback trigger to handle rapid hover cycles
    const timer = setTimeout(() => {
      this.hoverDebounceTimers.delete(video);
      // Only trigger if still hovered (debounce honors final state)
      if (data.isHovered) {
        this.triggerPlayback(video);
      }
    }, this.config.hoverDebounceMs);

    this.hoverDebounceTimers.set(video, timer);
  }

  /**
   * Handle mouse leave event on video card.
   * Clears isHovered, cancels pending debounce, and resets video to beginning.
   *
   * @param video - The video element
   */
  public handleMouseLeave(video: HTMLVideoElement): void {
    if (this.isDestroyed || isMobileViewport()) return;

    const data = this.activeVideos.get(video);
    if (data) {
      data.isHovered = false;
    }

    // Clear any pending hover debounce
    this.clearDebounceTimer(video, 'hover');
    // Clear any pending canplaythrough timeout
    this.clearDebounceTimer(video, 'canplaythrough');

    this.resetVideo(video);
  }

  /**
   * Handle focus event on video card.
   * Triggers playback with debounce for keyboard navigation.
   *
   * @param video - The video element
   */
  public handleFocus(video: HTMLVideoElement): void {
    if (this.isDestroyed || prefersReducedMotion()) return;

    // Clear any existing debounce timer
    this.clearDebounceTimer(video, 'focus');

    // Debounce focus to allow keyboard navigation through cards
    const timer = setTimeout(() => {
      this.focusDebounceTimers.delete(video);
      this.triggerPlayback(video);
    }, this.config.focusDebounceMs);

    this.focusDebounceTimers.set(video, timer);
  }

  /**
   * Handle blur event on video card.
   * Resets video to beginning and shows poster.
   *
   * @param video - The video element
   */
  public handleBlur(video: HTMLVideoElement): void {
    if (this.isDestroyed) return;

    // Clear any pending focus debounce
    this.clearDebounceTimer(video, 'focus');

    this.resetVideo(video);
  }

  /**
   * Pause all currently playing videos.
   * Called when theme picker modal closes.
   */
  public pauseAll(): void {
    for (const video of this.activeVideos.keys()) {
      this.pauseVideo(video);
    }
  }

  /**
   * Get current playback state for a video.
   * @param video - The video element
   * @returns Current playback state or 'idle' if not tracked
   */
  public getState(video: HTMLVideoElement): PlaybackState {
    return this.activeVideos.get(video)?.state ?? 'idle';
  }

  /**
   * Get count of currently playing videos.
   * @returns Number of videos in 'playing' or 'loading' state
   */
  public getActiveCount(): number {
    let count = 0;
    for (const data of this.activeVideos.values()) {
      if (data.state === 'playing' || data.state === 'loading') {
        count++;
      }
    }
    return count;
  }

  /**
   * Destroy the controller and clean up all resources.
   */
  public destroy(): void {
    this.isDestroyed = true;

    // Remove resize listener
    window.removeEventListener('resize', this.boundHandleResize);

    // Stop all videos and clear timers
    for (const video of this.activeVideos.keys()) {
      this.detach(video);
    }

    // Clean up intersection observer
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;

    // Clear all remaining timers
    for (const timer of this.focusDebounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.intersectionDebounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.hoverDebounceTimers.values()) {
      clearTimeout(timer);
    }
    for (const timer of this.canplaythroughTimeoutTimers.values()) {
      clearTimeout(timer);
    }
    // Cancel all pending timeouts
    for (const timeoutId of this.pendingRafCallbacks.values()) {
      clearTimeout(timeoutId as unknown as ReturnType<typeof setTimeout>);
    }
    // Note: loadeddata listeners are cleaned up in detach() for each video
    this.focusDebounceTimers.clear();
    this.intersectionDebounceTimers.clear();
    this.hoverDebounceTimers.clear();
    this.canplaythroughTimeoutTimers.clear();
    this.pendingRafCallbacks.clear();
    this.pendingLoadedDataListeners.clear();
  }

  // ===========================================================================
  // Private Methods: Setup
  // ===========================================================================

  /**
   * Handle viewport resize to manage mobile/desktop mode transitions.
   * 
   * @remarks
   * When switching between mobile and desktop viewports:
   * - Desktop → Mobile: Videos in hover/focus state are reset to allow IntersectionObserver control
   * - Mobile → Desktop: Videos are reset to clean state for hover/focus interactions
   * 
   * This ensures consistent behavior regardless of viewport size changes.
   */
  private handleViewportResize(): void {
    const newMode = isMobileViewport() ? 'mobile' : 'desktop';
    
    // Only act on actual mode change
    if (newMode === this.currentViewportMode) return;
    
    const oldMode = this.currentViewportMode;
    this.currentViewportMode = newMode;
    
    // Reset all videos to clean state when switching modes
    // This prevents state corruption from mixing mobile (intersection) and desktop (hover) triggers
    for (const [video, data] of this.activeVideos.entries()) {
      // Clear all pending debounce timers for this video
      this.clearDebounceTimer(video, 'intersection');
      this.clearDebounceTimer(video, 'hover');
      this.clearDebounceTimer(video, 'focus');
      
      // Clear isHovered flag when switching modes
      data.isHovered = false;
      
      // Reset video to idle state to ensure clean slate for new interaction mode
      if (data.state !== 'idle') {
        this.resetVideo(video);
      }
    }
    
    // Log mode change for debugging
    if (import.meta.env.DEV) {
      console.log(`[VideoController] Viewport mode changed: ${oldMode} → ${newMode}`);
    }
  }

  private setupIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => this.handleIntersectionChange(entries),
      { threshold: this.config.intersectionThreshold }
    );
  }

  private setupVideoEventListeners(video: HTMLVideoElement): void {
    // Error handling: fall back to poster on video error
    video.addEventListener('error', () => this.handleVideoError(video));

    // State transitions on video events
    // Use canplaythrough (not canplay) to ensure enough data for seamless playback
    video.addEventListener('canplaythrough', () => this.handleCanPlayThrough(video));
    video.addEventListener('ended', () => this.handleEnded(video));
    
    // Track when first frame is loaded for seamless image-to-video transition
    video.addEventListener('loadeddata', () => this.handleLoadedData(video));
  }

  // ===========================================================================
  // Private Methods: State Transitions
  // ===========================================================================

  /**
   * Trigger video playback with state machine transitions.
   *
   * @remarks
   * Transitions video from IDLE/PAUSED/STOPPED → LOADING state.
   * Waits for `canplaythrough` event before actually calling play().
   * This prevents the browser's loading spinner from appearing.
   * If `canplaythrough` doesn't fire within 2s (e.g., cached videos),
   * a timeout fallback transitions to PLAYING state anyway.
   *
   * @param video - The video element to play
   */
  private triggerPlayback(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data || prefersReducedMotion()) return;

    // Check concurrent limit
    const maxVideos = isMobileViewport()
      ? this.config.maxMobileVideos
      : this.config.maxDesktopVideos;

    if (this.getActiveCount() >= maxVideos) {
      // Pause oldest playing video to make room
      this.pauseOldestVideo();
    }

    // Transition: IDLE/PAUSED/STOPPED → LOADING
    if (data.state === 'idle' || data.state === 'paused' || data.state === 'stopped') {
      this.transitionState(video, data, 'loading');
      data.playStartTime = Date.now();

      // Restore src if it was cleared for buffer release
      // Always use video.dataset.src (current URL after color mode changes) not cached videoSrc
      const currentSrc = video.dataset.src || data.videoSrc;
      if (!video.src && currentSrc) {
        data.videoSrc = currentSrc; // Update cached src
        video.src = currentSrc;
      }

      // Start loading the video (but don't play yet - wait for canplaythrough)
      video.load();

      // Start canplaythrough timeout fallback
      // For cached videos, canplaythrough may not fire, so we timeout after 2s
      this.clearDebounceTimer(video, 'canplaythrough');
      const timer = setTimeout(() => {
        this.canplaythroughTimeoutTimers.delete(video);
        // If still loading, attempt to play now (timeout fallback)
        if (data.state === 'loading') {
          this.startActualPlayback(video, data);
        }
      }, this.config.canplaythroughTimeoutMs);
      this.canplaythroughTimeoutTimers.set(video, timer);
    }
  }

  private handleCanPlayThrough(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Clear the canplaythrough timeout since the event fired
    this.clearDebounceTimer(video, 'canplaythrough');

    // Only start playback if we're in loading state (user is still hovering)
    if (data.state === 'loading') {
      this.startActualPlayback(video, data);
    }
  }

  /**
   * Handle loadeddata event - first frame has been loaded.
   * This is critical for seamless image-to-video transition.
   * 
   * @param video - The video element whose first frame loaded
   */
  private handleLoadedData(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;
    
    // Mark that first frame is now available
    data.hasFirstFrame = true;
  }

  /**
   * Start actual video playback after canplaythrough or timeout.
   * This is called when the video is ready to play seamlessly.
   *
   * @remarks
   * Handles Safari's stricter autoplay policy by checking for NotAllowedError
   * and marking videos that need user gesture to unlock.
   * 
   * CRITICAL: To prevent white flash during image-to-video transition,
   * we wait for play() to succeed, then wait for first frame to be ready,
   * and finally add a 50ms compositor delay before making the video visible.
   *
   * @param video - The video element to play
   * @param data - The video tracking data
   */
  private startActualPlayback(video: HTMLVideoElement, data: VideoTrackingData): void {
    // Safari workaround: ensure video is ready before playing
    // readyState 3 (HAVE_FUTURE_DATA) or 4 (HAVE_ENOUGH_DATA) means video can play
    if (video.readyState < 3) {
      // Video not ready yet, wait for it
      const onCanPlay = (): void => {
        video.removeEventListener('canplay', onCanPlay);
        if (data.state === 'loading' && data.isHovered) {
          this.startActualPlayback(video, data);
        }
      };
      video.addEventListener('canplay', onCanPlay);
      return;
    }

    video.play()
      .then(() => {
        // Playback started successfully, but first frame may not be painted yet
        // Wait for first frame to be loaded AND painted before making video visible
        this.waitForFirstFrameAndReveal(video, data);
      })
      .catch((error: Error) => {
        // Check if this is Safari's autoplay restriction
        if (error.name === 'NotAllowedError') {
          // Safari blocked autoplay - mark video as needing unlock
          // The video will play after user clicks anywhere (setupAutoplayUnlock handles this)
          video.dataset.autoplayBlocked = 'true';
        }
        // Playback failed, reset to idle
        this.transitionState(video, data, 'idle');
      });
  }

  /**
   * Wait for first frame to be ready, then reveal video after compositor paint delay.
   * 
   * @remarks
   * Two-stage approach for seamless transition:
   * 1. Ensure video has buffered enough data (readyState \>= 2 = HAVE_CURRENT_DATA)
   * 2. Add compositor delay to let GPU paint the first frame before showing video
   * 
   * @param video - The video element
   * @param data - The video tracking data
   */
  private waitForFirstFrameAndReveal(video: HTMLVideoElement, data: VideoTrackingData): void {
    // Cancel any pending timeout for this video
    const pendingTimeout = this.pendingRafCallbacks.get(video);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout as unknown as ReturnType<typeof setTimeout>);
      this.pendingRafCallbacks.delete(video);
    }
    
    // Remove any pending loadeddata listener
    this.cleanupLoadedDataListener(video);

    // If user left during playback start, abort
    if (!data.isHovered || this.isDestroyed) {
      return;
    }

    // Check if first frame is ready using readyState
    // HAVE_CURRENT_DATA (2) means data for current playback position is available
    const hasFrameReady = video.readyState >= 2;
    
    if (hasFrameReady) {
      // Frame is ready, add compositor delay before revealing
      this.revealVideoAfterPaint(video, data);
      return;
    }

    // Wait for loadeddata event (first frame loaded)
    const onLoadedData = (): void => {
      this.pendingLoadedDataListeners.delete(video);
      video.removeEventListener('loadeddata', onLoadedData);
      // Re-check conditions after async wait
      if (data.isHovered && !this.isDestroyed && data.state === 'loading') {
        this.revealVideoAfterPaint(video, data);
      }
    };
    
    // Track the listener for cleanup
    this.pendingLoadedDataListeners.set(video, onLoadedData);
    video.addEventListener('loadeddata', onLoadedData);
  }
  
  /**
   * Clean up pending loadeddata listener for a video.
   * @param video - The video element
   */
  private cleanupLoadedDataListener(video: HTMLVideoElement): void {
    const listener = this.pendingLoadedDataListeners.get(video);
    if (listener) {
      video.removeEventListener('loadeddata', listener);
      this.pendingLoadedDataListeners.delete(video);
    }
  }

  /**
   * Reveal video after ensuring browser has painted the first frame.
   * Uses a simple timeout to let the GPU compositor decode and paint the frame.
   * 
   * @remarks
   * Research shows that video.play() promise resolves when playback STARTS,
   * not when the first frame is PAINTED by the GPU compositor.
   * A 50ms delay is the minimum safe time for compositor paint across all browsers.
   * 
   * @param video - The video element
   * @param data - The video tracking data
   */
  private revealVideoAfterPaint(video: HTMLVideoElement, data: VideoTrackingData): void {
    // Simple timeout: Let GPU compositor decode and paint the first frame
    // This is more reliable than RAF because RAF doesn't guarantee compositor paint
    const timeoutId = setTimeout(() => {
      this.pendingRafCallbacks.delete(video);
      
      // Safety checks: user might have left during the timeout
      if (!data.isHovered || this.isDestroyed || data.state !== 'loading') {
        return;
      }
      
      // Now safe to transition to 'playing' - first frame should be painted
      this.transitionState(video, data, 'playing');
    }, this.config.compositorPaintDelayMs);
    
    // Store timeout ID in the same map (it's just a number like RAF ID)
    this.pendingRafCallbacks.set(video, timeoutId as unknown as number);
  }

  /**
   * Handle video ended event.
   *
   * @remarks
   * When isHovered is true, the video loops by restarting from the beginning.
   * When isHovered is false (user left during playback), video resets to idle.
   *
   * @param video - The video element that ended
   */
  private handleEnded(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    if (data.isHovered) {
      // Loop: restart from beginning while still hovered
      // No need to reset hasFirstFrame since video buffer is still loaded
      video.currentTime = 0;
      video.play().catch(() => {
        // Playback failed on loop, reset to idle
        this.transitionState(video, data, 'idle');
      });
    } else {
      // Not hovered: reset to idle
      this.resetVideo(video);
    }
  }

  private pauseVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Transition: PLAYING/LOADING → PAUSED
    if (data.state === 'playing' || data.state === 'loading') {
      video.pause();
      this.transitionState(video, data, 'paused');
    }
  }

  private stopVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    video.pause();
    video.currentTime = 0;
    this.transitionState(video, data, 'stopped');
  }

  /**
   * Reset video to idle state and show poster.
   * Clears the video src to force the browser to display the poster image.
   *
   * @param video - The video element to reset
   */
  private resetVideo(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Cancel any pending timeout
    const pendingTimeout = this.pendingRafCallbacks.get(video);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout as unknown as ReturnType<typeof setTimeout>);
      this.pendingRafCallbacks.delete(video);
    }
    
    // Clean up pending loadeddata listener
    this.cleanupLoadedDataListener(video);

    video.pause();
    video.currentTime = 0;

    // Reset first frame tracking for next playback
    data.hasFirstFrame = false;

    // Clear src to force browser to show poster again
    // This fixes the "empty box" issue when leaving before video is ready
    if (video.src) {
      data.videoSrc = video.src;
      video.removeAttribute('src');
      video.load(); // Force the browser to reset and show poster
    }

    this.transitionState(video, data, 'idle');
  }

  private pauseOldestVideo(): void {
    let oldestVideo: HTMLVideoElement | null = null;
    let oldestTime = Infinity;

    for (const [video, data] of this.activeVideos.entries()) {
      if (
        (data.state === 'playing' || data.state === 'loading') &&
        data.playStartTime < oldestTime
      ) {
        oldestTime = data.playStartTime;
        oldestVideo = video;
      }
    }

    if (oldestVideo) {
      this.pauseVideo(oldestVideo);
    }
  }

  // ===========================================================================
  // Private Methods: Event Handlers
  // ===========================================================================

  private handleIntersectionChange(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const video = entry.target as HTMLVideoElement;
      // Capture the current state immediately (entry.isIntersecting is a snapshot)
      const isCurrentlyIntersecting = entry.isIntersecting;

      // Clear existing debounce timer
      this.clearDebounceTimer(video, 'intersection');

      // Debounce intersection callbacks to prevent rapid firing
      // But capture the state NOW, not later when the callback runs
      const timer = setTimeout(() => {
        this.intersectionDebounceTimers.delete(video);

        // Use the captured state, not entry.isIntersecting which is stale
        if (isCurrentlyIntersecting) {
          // Video entered viewport - trigger playback on mobile only
          if (isMobileViewport() && !prefersReducedMotion()) {
            const data = this.activeVideos.get(video);
            if (data) {
              // Mark as hovered for mobile intersection-based playback
              // This ensures the video will loop if it finishes while in view
              data.isHovered = true;
              this.triggerPlayback(video);
            }
          }
        } else {
          // Video exited viewport - clean up
          const data = this.activeVideos.get(video);
          if (data) {
            data.isHovered = false;
            // Release buffer to save memory
            this.releaseVideoBuffer(video);
          }
        }
      }, this.config.intersectionDebounceMs);

      this.intersectionDebounceTimers.set(video, timer);
    }
  }

  private handleVideoError(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Reset state and show poster (graceful degradation)
    video.currentTime = 0;
    this.transitionState(video, data, 'idle');
  }

  // ===========================================================================
  // Private Methods: Memory Management
  // ===========================================================================

  private releaseVideoBuffer(video: HTMLVideoElement): void {
    const data = this.activeVideos.get(video);
    if (!data) return;

    // Cancel any pending timeout
    const pendingTimeout = this.pendingRafCallbacks.get(video);
    if (pendingTimeout) {
      clearTimeout(pendingTimeout as unknown as ReturnType<typeof setTimeout>);
      this.pendingRafCallbacks.delete(video);
    }
    
    // Clean up pending loadeddata listener
    this.cleanupLoadedDataListener(video);

    // Stop playback
    video.pause();
    video.currentTime = 0;

    // Reset first frame tracking since buffer will be released
    data.hasFirstFrame = false;

    // Clear src to release buffer (poster remains visible)
    // Save the current src before clearing
    if (video.src) {
      data.videoSrc = video.src;
    }
    video.src = '';
    video.load(); // Force buffer release

    this.transitionState(video, data, 'stopped');
  }

  // ===========================================================================
  // Private Methods: Utilities
  // ===========================================================================

  private clearDebounceTimer(
    video: HTMLVideoElement,
    type: 'focus' | 'intersection' | 'hover' | 'canplaythrough'
  ): void {
    let timers: Map<HTMLVideoElement, ReturnType<typeof setTimeout>>;
    switch (type) {
      case 'focus':
        timers = this.focusDebounceTimers;
        break;
      case 'intersection':
        timers = this.intersectionDebounceTimers;
        break;
      case 'hover':
        timers = this.hoverDebounceTimers;
        break;
      case 'canplaythrough':
        timers = this.canplaythroughTimeoutTimers;
        break;
    }
    const timer = timers.get(video);
    if (timer) {
      clearTimeout(timer);
      timers.delete(video);
    }
  }

  /**
   * Transition video state and invoke onStateChange callback.
   * @param video - The video element
   * @param data - The video tracking data
   * @param newState - The new playback state
   */
  private transitionState(
    video: HTMLVideoElement,
    data: VideoTrackingData,
    newState: PlaybackState
  ): void {
    const oldState = data.state;
    data.state = newState;

    // Invoke callback if state actually changed
    if (oldState !== newState && this.config.onStateChange) {
      this.config.onStateChange(video, newState);
    }
  }
}
