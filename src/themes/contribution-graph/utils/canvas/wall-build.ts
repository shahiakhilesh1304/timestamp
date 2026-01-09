/**
 * Wall build animation for canvas.
 *
 * Replicates the gravity-constrained brick-laying effect from the DOM version.
 * Builds wall bottom-to-top with shuffled columns using RAF batching.
 */

import type { CanvasGridState } from './state';
import { markDirty } from './state';

/** Wall build configuration. */
const WALL_CONFIG = {
  /** Target animation duration in milliseconds. */
  targetDurationMs: 1800,
  /** Throttle interval between RAF frames. */
  throttleIntervalMs: 100,
  /** Maximum squares to process per frame. */
  maxSquaresPerFrame: 100,
  /** Hold wall visible after build completes. */
  holdDurationMs: 120,
} as const;

/** Shuffle array in place using Fisher-Yates algorithm. */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Compute gravity-constrained placement order (bottom-to-top, shuffled columns).
 */
function computeWallPlacements(grid: CanvasGridState): number[] {
  const placements: number[] = [];
  const columnHeights = new Array<number>(grid.cols).fill(grid.rows);

  // Bottom-to-top creates gravity physics effect
  for (let row = grid.rows - 1; row >= 0; row--) {
    const colsArray = Array.from({ length: grid.cols }, (_, i) => i);
    shuffleArray(colsArray);

    for (const col of colsArray) {
      if (columnHeights[col] > row) {
        placements.push(row * grid.cols + col);
        columnHeights[col] = row;
      }
    }
  }

  return placements;
}

/** Stored placements for symmetrical unbuild. */
let storedPlacements: number[] | null = null;

/**
 * Build wall animation using RAF batching.
 */
export function buildWall(
  grid: CanvasGridState,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    const placements = computeWallPlacements(grid);
    storedPlacements = placements;

    const totalFrames = Math.ceil(WALL_CONFIG.targetDurationMs / WALL_CONFIG.throttleIntervalMs);
    const batchSize = Math.max(
      1,
      Math.min(WALL_CONFIG.maxSquaresPerFrame, Math.ceil(placements.length / totalFrames))
    );

    let placementIndex = 0;
    let lastTime = 0;

    const animationFrame = (timestamp: number): void => {
      if (signal?.aborted) {
        reject(new Error('Wall build aborted'));
        return;
      }

      if (timestamp - lastTime < WALL_CONFIG.throttleIntervalMs) {
        requestAnimationFrame(animationFrame);
        return;
      }
      lastTime = timestamp;

      const endIndex = Math.min(placementIndex + batchSize, placements.length);
      for (let i = placementIndex; i < endIndex; i++) {
        const idx = placements[i];
        const square = grid.squares[idx];
        if (square) {
          square.isWall = true;
          markDirty(grid, idx);
        }
      }
      placementIndex = endIndex;

      if (placementIndex < placements.length) {
        requestAnimationFrame(animationFrame);
      } else {
        setTimeout(() => resolve(), WALL_CONFIG.holdDurationMs);
      }
    };

    requestAnimationFrame(animationFrame);
  });
}

/**
 * Unbuild wall animation using RAF batching.
 * Message squares are revealed progressively and start pulsing as they appear.
 */
export function unbuildWall(
  grid: CanvasGridState,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Include ALL squares (including message squares) in unbuild animation
    // Message squares will have isWall removed but keep isMessage=true
    // This creates the progressive reveal effect as wall comes down
    const placements = (storedPlacements ?? [])
      .slice()
      .reverse();

    const totalFrames = Math.ceil(WALL_CONFIG.targetDurationMs / WALL_CONFIG.throttleIntervalMs);
    const batchSize = Math.max(
      1,
      Math.min(WALL_CONFIG.maxSquaresPerFrame, Math.ceil(placements.length / totalFrames))
    );

    let placementIndex = 0;
    let lastTime = 0;

    const animationFrame = (timestamp: number): void => {
      if (signal?.aborted) {
        reject(new Error('Wall unbuild aborted'));
        return;
      }

      if (timestamp - lastTime < WALL_CONFIG.throttleIntervalMs) {
        requestAnimationFrame(animationFrame);
        return;
      }
      lastTime = timestamp;

      const endIndex = Math.min(placementIndex + batchSize, placements.length);
      for (let i = placementIndex; i < endIndex; i++) {
        const idx = placements[i];
        const square = grid.squares[idx];
        if (square) {
          // Remove wall - square is now revealed
          square.isWall = false;
          
          // If this is a message square, start its pulse animation NOW (as it's revealed)
          if (square.isMessage && square.pulseStartTime === 0) {
            square.pulseStartTime = timestamp;
          }
          
          // If not a message square and was covered by wall, allow ambient to use it
          // (ambient system will handle this automatically via digitBounds check)
          
          // Only reset intensity for truly empty squares
          if (!square.isDigit && !square.isMessage && !square.isAmbient) {
            square.intensity = 0;
          }
          
          markDirty(grid, idx);
        }
      }
      placementIndex = endIndex;

      if (placementIndex < placements.length) {
        requestAnimationFrame(animationFrame);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animationFrame);
  });
}

/**
 * Clear wall immediately.
 */
export function clearWall(grid: CanvasGridState): void {
  for (const square of grid.squares) {
    if (square.isWall) {
      square.isWall = false;
      square.intensity = 0;
    }
  }
  storedPlacements = null;
}
