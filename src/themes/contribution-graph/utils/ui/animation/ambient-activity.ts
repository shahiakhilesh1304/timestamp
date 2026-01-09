/**
 * Ambient activity management for contribution-graph theme.
 *
 * Handles the random lighting of squares outside the digit bounding box
 * to create a living, breathing grid effect.
 *
 * ARCHITECTURE: CSS-driven animation lifecycle.
 * - JS adds `is-ambient intensity-N phase-X` class to squares
 * - CSS handles full animation: fade-in → hold → fade-out via keyframes
 * - CSS `animationend` event signals completion → JS removes class
 * - JS tracks "cooling down" squares to prevent immediate re-activation
 *
 * KEY PRINCIPLE: JS only ADDS the `is-ambient` class; CSS animation runs
 * to completion naturally. No JS-driven removal that "pops" the animation.
 */

import type { ResourceTracker } from '@themes/shared/types';

import type { ActivityPhase } from '../../../config';
import {
    buildSquareClass,
    CSS_CLASSES,
    getAmbientClass,
    getPhaseConfigByName,
    getWeightedIntensity,
} from '../../../config';
import { getPhaseDurationMs } from '../../../config/activity-stages';
import type { BoundingBox, GridState, Square } from '../../../types';

/** Check if square is within bounding box (inline for perf on hot path). @returns true if inside */
function isInBoundingBox(square: Square, box: BoundingBox): boolean {
  return (
    square.col >= box.minCol &&
    square.col <= box.maxCol &&
    square.row >= box.minRow &&
    square.row <= box.maxRow
  );
}

/** Fisher-Yates swap-and-pop for O(1) removal from buffer. @returns Removed element */
function swapAndPop<T>(arr: T[], idx: number): T {
  const lastIdx = arr.length - 1;
  const item = arr[idx];
  arr[idx] = arr[lastIdx];
  arr.pop();
  return item;
}

/**
 * Handle animation end for an ambient square.
 * Removes the is-ambient class and marks square as available for re-activation.
 */
function handleAnimationEnd(square: Square, state: GridState): void {
  // Remove from active set
  state.activeAmbient.delete(square);
  state.animatingSquares.delete(square);
  
  // Reset to base state (CSS animation has already faded to base color)
  if (!square.isDigit && 
      !square.element.classList.contains(CSS_CLASSES.WALL) &&
      !square.element.classList.contains(CSS_CLASSES.MESSAGE)) {
    square.element.className = buildSquareClass(0);
  }
}

/**
 * Schedule cleanup without retaining long-lived listeners.
 * Tracks timeout in ResourceTracker and WeakMap for proper disposal.
 *
 * @remarks Cleanup delay accounts for:
 * - Base animation duration (phase-adjusted)
 * - Maximum stagger delay (32% of duration for stagger-4)
 * - Small buffer for CSS timing variance
 */
function scheduleSquareCleanup(
  square: Square,
  state: GridState,
  phase: ActivityPhase,
  resourceTracker: ResourceTracker
): void {
  const duration = getPhaseDurationMs(phase);
  // Max stagger delay is 32% of duration (stagger-4), plus 120ms buffer
  const maxStaggerDelay = duration * 0.32;
  const cleanupDelay = duration + maxStaggerDelay + 120;

  // Use timeout to avoid animationend closures retaining old grid references
  const timeoutId = window.setTimeout(() => {
    if (state.activeAmbient.has(square)) {
      handleAnimationEnd(square, state);
      // Remove from pending cleanups after execution
      state.pendingCleanups.delete(square);
    }
  }, cleanupDelay);

  // Track in resourceTracker for global cleanup
  resourceTracker.timeouts.push(timeoutId);
  // Track per-square for granular cancellation
  state.pendingCleanups.set(square, timeoutId);
}

/**
 * Perform one tick of ambient activity (CSS-driven lifecycle).
 * 
 * Uses "add per tick" model with a concurrent cap: each tick adds new squares
 * up to a maximum concurrent limit. Since animation duration (with stagger) is
 * longer than tick interval, batches naturally overlap creating organic continuous
 * activity. The cap prevents unbounded accumulation that would stress the GPU.
 * 
 * **Overlap calculation:**
 * - Animation duration: 2-5s (phase-dependent)
 * - Stagger spread: 32% of duration (0-32% delays across batch)
 * - Effective batch lifetime: duration × 1.32
 * - Tick interval: 1-2.5s (phase-dependent)
 * - Expected overlap: (duration × 1.32) ÷ tick_interval ≈ 1.5-2.6 batches
 * - Cap at 3× provides headroom for variance and smooth transitions
 * 
 * @remarks JS adds is-ambient class; CSS animation runs to completion naturally
 */
export function activityTick(state: GridState, phase: ActivityPhase, resourceTracker: ResourceTracker): void {
  if (state.ambientSquares.length === 0) return;

  const config = getPhaseConfigByName(phase);
  
  // Calculate squares to ADD this tick (not maintain as active)
  const squaresPerTick = Math.max(
    1,
    Math.ceil((state.ambientSquares.length * config.coveragePerMille) / 1000)
  );
  
  // Cap maximum concurrent animations to prevent GPU overload
  // Factor of 3× accounts for:
  // - Typical 1.5-2.6 batches overlapping (duration×1.32 ÷ tick_interval)
  // - Stagger spread extending batch lifetime by 32%
  // - Variance in cleanup timing and phase transitions
  const maxConcurrent = squaresPerTick * 3;
  const currentActive = state.activeAmbient.size;

  // NOTE: We no longer remove squares - CSS animation runs to completion.
  // The activeAmbient set is cleaned up by timeout after animation ends.
  
  // Skip wall/message squares that may have been promoted during animation
  for (const square of state.activeAmbient) {
    if (
      square.element.classList.contains(CSS_CLASSES.WALL) ||
      square.element.classList.contains(CSS_CLASSES.MESSAGE)
    ) {
      state.activeAmbient.delete(square);
      state.animatingSquares.delete(square);
    }
  }

  // Add new squares up to cap (allows overlap but prevents accumulation)
  const headroom = Math.max(0, maxConcurrent - currentActive);
  const needed = Math.min(squaresPerTick, headroom);
  if (needed === 0) return;
  
  // NOTE: Create local buffer (GC will clean up between ticks)
  const availableBuffer: Square[] = [];
  
  const exclusionZone = state.exclusionZone;
  
  for (const s of state.ambientSquares) {
    if (
      !state.activeAmbient.has(s) &&
      !state.animatingSquares.has(s) && // Don't re-activate if animation still in progress
      !s.isDigit &&
      !s.element.classList.contains(CSS_CLASSES.WALL) &&
      !s.element.classList.contains(CSS_CLASSES.MESSAGE) &&
      // PERF: Skip squares in exclusion zone (e.g., landing page card)
      !(exclusionZone && isInBoundingBox(s, exclusionZone))
    ) {
      availableBuffer.push(s);
    }
  }

  // PERF: Fisher-Yates swap-and-pop for O(1) random selection
  for (let i = 0; i < needed && availableBuffer.length > 0; i++) {
    const idx = Math.floor(Math.random() * availableBuffer.length);
    const square = swapAndPop(availableBuffer, idx);
    
    // Mark as active and animating
    state.activeAmbient.add(square);
    state.animatingSquares.add(square);

    // Add is-ambient with intensity and phase - CSS animation handles the rest
    const intensity = getWeightedIntensity();
    square.element.className = getAmbientClass(intensity, phase);

    // Schedule cleanup after animation duration
    scheduleSquareCleanup(square, state, phase, resourceTracker);
  }
}

/** Clear all ambient activity (forces immediate cleanup, cancels pending timeouts). */
export function clearAmbientActivity(state: GridState): void {
  for (const square of state.activeAmbient) {
    state.animatingSquares.delete(square);
    
    // Cancel pending timeout if exists
    const timeoutId = state.pendingCleanups.get(square);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      state.pendingCleanups.delete(square);
    }
    
    if (!square.isDigit) {
      square.element.className = buildSquareClass(0);
    }
  }
  state.activeAmbient.clear();
  // Clear animating set to allow GC (WeakSet only weakly references, but clearing helps)
  // Note: Can't actually clear a WeakSet, but deleting members above is sufficient
}
