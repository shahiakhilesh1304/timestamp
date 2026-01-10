/**
 * Digit rendering for canvas.
 *
 * Computes which squares should display countdown digits
 * using the same 5x7 pixel patterns as the DOM version.
 */

import { DIGIT_HEIGHT, DIGIT_PATTERNS, DIGIT_WIDTH } from '../ui/patterns';
import type { CanvasGridState } from './state';
import { markDirty } from './state';

const CHAR_SPACING = 1;
const LINE_SPACING = 3;
const BOUNDING_BOX_MARGIN = 2;

/**
 * Calculate width of a text line in grid columns.
 */
function calculateLineWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += (char === ':' ? 3 : DIGIT_WIDTH) + CHAR_SPACING;
  }
  return width - CHAR_SPACING;
}

/**
 * Compute grid indices for a line of text.
 */
function computeLineIndices(
  cols: number,
  text: string,
  centerRow: number,
  outIndices: Set<number>
): void {
  const width = calculateLineWidth(text);
  const startCol = Math.floor((cols - width) / 2);

  let currentCol = startCol;
  for (const char of text) {
    const pattern = DIGIT_PATTERNS[char];
    if (!pattern) continue;

    const charWidth = char === ':' ? 3 : DIGIT_WIDTH;
    const colOffset = char === ':' ? 1 : 0;

    for (let row = 0; row < DIGIT_HEIGHT; row++) {
      for (let col = 0; col < charWidth; col++) {
        const patternCol = col + colOffset;
        if (pattern[row][patternCol] === 1) {
          const gridRow = centerRow + row;
          const gridCol = currentCol + col;
          if (gridCol >= 0 && gridCol < cols && gridRow >= 0) {
            outIndices.add(gridRow * cols + gridCol);
          }
        }
      }
    }

    currentCol += charWidth + CHAR_SPACING;
  }
}

/**
 * Update digit display with new countdown lines.
 * Uses differential update - only marks changed squares as dirty.
 */
export function updateDigits(state: CanvasGridState, lines: string[]): void {
  const cacheKey = lines.join('|');
  if (state.lastTimeStr === cacheKey) {
    return; // No change
  }

  state.lastTimeStr = cacheKey;

  // Compute new digit indices
  const newIndices = new Set<number>();
  const totalHeight = lines.length * DIGIT_HEIGHT + (lines.length - 1) * LINE_SPACING;
  const startRow = Math.floor((state.rows - totalHeight) / 2);

  for (let i = 0; i < lines.length; i++) {
    const lineRow = startRow + i * (DIGIT_HEIGHT + LINE_SPACING);
    computeLineIndices(state.cols, lines[i], lineRow, newIndices);
  }

  // Clear old digits not in new set
  for (const idx of state.digitIndices) {
    if (!newIndices.has(idx)) {
      const square = state.squares[idx];
      if (square) {
        square.isDigit = false;
        if (!square.isAmbient && !square.isWall && !square.isMessage) {
          square.intensity = 0;
        }
        markDirty(state, idx);
      }
    }
  }

  // Set new digits not in old set
  const now = performance.now();
  for (const idx of newIndices) {
    if (!state.digitIndices.has(idx)) {
      const square = state.squares[idx];
      if (square) {
        square.isDigit = true;
        // Set pulse start time for organic animation stagger
        square.pulseStartTime = now;
        markDirty(state, idx);
      }
    }
  }

  state.digitIndices = newIndices;

  // Update bounding box for ambient exclusion
  let minCol = state.cols;
  let maxCol = 0;
  let minRow = state.rows;
  let maxRow = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineRow = startRow + i * (DIGIT_HEIGHT + LINE_SPACING);
    const lineW = calculateLineWidth(lines[i]);
    const lineStartCol = Math.floor((state.cols - lineW) / 2);

    minCol = Math.min(minCol, lineStartCol);
    maxCol = Math.max(maxCol, lineStartCol + lineW - 1);
    minRow = Math.min(minRow, lineRow);
    maxRow = Math.max(maxRow, lineRow + DIGIT_HEIGHT - 1);
  }

  state.digitBounds = {
    minCol: Math.max(0, minCol - BOUNDING_BOX_MARGIN),
    maxCol: Math.min(state.cols - 1, maxCol + BOUNDING_BOX_MARGIN),
    minRow: Math.max(0, minRow - BOUNDING_BOX_MARGIN),
    maxRow: Math.min(state.rows - 1, maxRow + BOUNDING_BOX_MARGIN),
  };
}

/**
 * Clear all digits from the grid.
 */
export function clearDigits(state: CanvasGridState): void {
  for (const idx of state.digitIndices) {
    const square = state.squares[idx];
    if (square) {
      square.isDigit = false;
      if (!square.isAmbient && !square.isWall && !square.isMessage) {
        square.intensity = 0;
      }
      markDirty(state, idx);
    }
  }
  state.digitIndices.clear();
  state.digitBounds = null;
  state.lastTimeStr = null;
}
