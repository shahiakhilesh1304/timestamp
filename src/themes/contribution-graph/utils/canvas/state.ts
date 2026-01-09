/**
 * Canvas grid state management.
 *
 * Tracks all square states as simple data structures instead of DOM elements.
 * This enables efficient canvas rendering with dirty-rect optimization.
 */

import { GRID_CONFIG, MAX_NODES } from '../../config';
import { DIGIT_HEIGHT, DIGIT_WIDTH } from '../ui/patterns';

// =============================================================================
// TYPES
// =============================================================================

/** Square state (pure data, no DOM). */
export interface SquareState {
  /** Color intensity 0-4. */
  intensity: number;
  /** Whether square is a countdown digit. */
  isDigit: boolean;
  /** Whether square is part of ambient animation. */
  isAmbient: boolean;
  /** Ambient animation progress (0-1). */
  ambientProgress: number;
  /** Target intensity during ambient animation. */
  ambientTargetIntensity: number;
  /** Whether square is part of wall build. */
  isWall: boolean;
  /** Whether square is part of message text. */
  isMessage: boolean;
  /** Whether mouse is hovering over this square. */
  isHovered: boolean;
  /** Pulse animation phase (0-1) for digits. */
  pulsePhase: number;
  /** Time when square became a digit/message (for organic pulse stagger). */
  pulseStartTime: number;
}

/** Grid state for canvas renderer. */
export interface CanvasGridState {
  /** Number of columns. */
  cols: number;
  /** Number of rows. */
  rows: number;
  /** Size of each square in pixels. */
  squareSize: number;
  /** Gap between squares in pixels. */
  gap: number;
  /** Total grid width in pixels. */
  width: number;
  /** Total grid height in pixels. */
  height: number;
  /** Flat array of square states (row-major order). */
  squares: SquareState[];
  /** Set of dirty square indices (need repaint). */
  dirtySquares: Set<number>;
  /** Whether entire grid needs repaint. */
  fullRepaint: boolean;
  /** Last rendered countdown string (for change detection). */
  lastTimeStr: string | null;
  /** Indices of current digit squares. */
  digitIndices: Set<number>;
  /** Bounding box of digit area (for ambient exclusion). */
  digitBounds: { minCol: number; maxCol: number; minRow: number; maxRow: number } | null;
}

// =============================================================================
// GRID CALCULATIONS
// =============================================================================

/**
 * Calculate width of a text line in grid columns.
 */
function calculateLineWidth(str: string): number {
  const CHAR_SPACING = 1;
  let width = 0;
  for (const char of str) {
    width += (char === ':' ? 3 : DIGIT_WIDTH) + CHAR_SPACING;
  }
  return width - CHAR_SPACING;
}

/**
 * Calculate grid dimensions to fill viewport.
 */
export function calculateGridDimensions(
  viewportWidth: number,
  viewportHeight: number
): { cols: number; rows: number; squareSize: number; gap: number } {
  let squareSize = GRID_CONFIG.maxSquareSize;
  let gap = Math.round(squareSize * GRID_CONFIG.gapRatio);

  let cols = Math.floor(viewportWidth / (squareSize + gap));
  let rows = Math.floor(viewportHeight / (squareSize + gap));

  // Ensure minimum content fits
  const minColsNeeded = calculateLineWidth('00:00') + GRID_CONFIG.edgePadding * 2;
  const minRowsNeeded = DIGIT_HEIGHT * 2 + 3 + GRID_CONFIG.edgePadding * 2; // LINE_SPACING = 3

  while ((cols < minColsNeeded || rows < minRowsNeeded) && squareSize > GRID_CONFIG.minSquareSize) {
    squareSize--;
    gap = Math.round(squareSize * GRID_CONFIG.gapRatio);
    cols = Math.floor(viewportWidth / (squareSize + gap));
    rows = Math.floor(viewportHeight / (squareSize + gap));
  }

  // Recalculate gap to fill viewport evenly
  if (cols > 1) {
    gap = Math.floor((viewportWidth - cols * squareSize) / (cols - 1));
  }
  if (rows > 1) {
    const heightGap = Math.floor((viewportHeight - rows * squareSize) / (rows - 1));
    gap = Math.min(gap, heightGap);
  }

  // Cap at MAX_NODES
  const total = cols * rows;
  if (total > MAX_NODES) {
    const scale = Math.sqrt(MAX_NODES / total);
    cols = Math.max(1, Math.floor(cols * scale));
    rows = Math.max(1, Math.floor(rows * scale));
  }

  return { cols, rows, squareSize, gap };
}

// =============================================================================
// STATE CREATION
// =============================================================================

/** Create initial square state. */
function createSquareState(): SquareState {
  return {
    intensity: 0,
    isDigit: false,
    isAmbient: false,
    ambientProgress: 0,
    ambientTargetIntensity: 0,
    isWall: false,
    isMessage: false,
    isHovered: false,
    pulsePhase: 0,
    pulseStartTime: 0,
  };
}

/**
 * Create canvas grid state for given viewport dimensions.
 */
export function createCanvasGridState(
  viewportWidth: number,
  viewportHeight: number
): CanvasGridState {
  const { cols, rows, squareSize, gap } = calculateGridDimensions(viewportWidth, viewportHeight);

  // Grid content size (may be smaller than viewport due to MAX_NODES cap)
  const gridWidth = cols * squareSize + (cols - 1) * gap;
  const gridHeight = rows * squareSize + (rows - 1) * gap;
  
  // Canvas should fill the full viewport, not just the grid
  // This ensures the background covers everything even if grid is capped
  const width = Math.max(viewportWidth, gridWidth);
  const height = Math.max(viewportHeight, gridHeight);

  const squares: SquareState[] = [];
  for (let i = 0; i < cols * rows; i++) {
    squares.push(createSquareState());
  }

  return {
    cols,
    rows,
    squareSize,
    gap,
    width,
    height,
    squares,
    dirtySquares: new Set(),
    fullRepaint: true,
    lastTimeStr: null,
    digitIndices: new Set(),
    digitBounds: null,
  };
}

/**
 * Get square state at position.
 */
export function getSquare(state: CanvasGridState, col: number, row: number): SquareState | undefined {
  if (col < 0 || col >= state.cols || row < 0 || row >= state.rows) return undefined;
  return state.squares[row * state.cols + col];
}

/**
 * Mark square as dirty (needs repaint).
 */
export function markDirty(state: CanvasGridState, index: number): void {
  state.dirtySquares.add(index);
}

/**
 * Mark all squares as dirty.
 */
export function markFullRepaint(state: CanvasGridState): void {
  state.fullRepaint = true;
}

/**
 * Clear dirty state after painting.
 */
export function clearDirty(state: CanvasGridState): void {
  state.dirtySquares.clear();
  state.fullRepaint = false;
}

/**
 * Reset all square states to default.
 */
export function resetSquares(state: CanvasGridState): void {
  for (const square of state.squares) {
    square.intensity = 0;
    square.isDigit = false;
    square.isAmbient = false;
    square.ambientProgress = 0;
    square.ambientTargetIntensity = 0;
    square.isWall = false;
    square.isMessage = false;
    square.isHovered = false;
    square.pulsePhase = 0;
  }
  state.digitIndices.clear();
  state.digitBounds = null;
  state.lastTimeStr = null;
  markFullRepaint(state);
}
