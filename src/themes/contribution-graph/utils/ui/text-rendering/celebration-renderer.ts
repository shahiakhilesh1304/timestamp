/**
 * Celebration text rendering as pixel art.
 *
 * Renders celebration messages using 5×7 pixel font patterns,
 * with support for multi-line word wrapping.
 */

import { CSS_CLASSES } from '../../../config';
import type { BoundingBox, GridState, Square } from '../../../types';
import { getSquare } from '../../grid';
import { DIGIT_HEIGHT, DIGIT_PATTERNS, DIGIT_WIDTH } from '../patterns';
import { LETTER_PATTERNS } from '../patterns/letters';
import { PUNCTUATION_PATTERNS } from '../patterns/punctuation';
import {
    celebrationLineWidth,
    CHAR_SPACING,
    cleanMessage,
    LINE_SPACING,
    WORD_SPACING,
    wrapWords,
} from './text-layout';

/** Combined patterns for all supported characters. */
const ALL_PATTERNS: Record<string, number[][]> = {
  ...LETTER_PATTERNS,
  ...PUNCTUATION_PATTERNS,
  ...DIGIT_PATTERNS,
};

/** Render a single character at position, tracking indices. @returns void (mutates messageSquares and messageIndices) */
function renderCharWithIndices(
  state: GridState,
  char: string,
  startCol: number,
  startRow: number,
  messageSquares: Square[],
  messageIndices: Set<number>
): void {
  const pattern = ALL_PATTERNS[char];
  if (!pattern) return;

  for (let row = 0; row < DIGIT_HEIGHT; row++) {
    for (let col = 0; col < DIGIT_WIDTH; col++) {
      if (pattern[row][col] === 1) {
        const gridRow = startRow + row;
        const gridCol = startCol + col;
        const square = getSquare(state, gridCol, gridRow);

        if (square) {
          const idx = gridRow * state.cols + gridCol;
          messageSquares.push(square);
          messageIndices.add(idx);
          square.element.classList.add(CSS_CLASSES.MESSAGE);
        }
      }
    }
  }
}

/** Render a line of text centered at given row, tracking indices. @returns void (mutates messageSquares and messageIndices) */
function renderTextLineWithIndices(
  state: GridState,
  text: string,
  centerRow: number,
  messageSquares: Square[],
  messageIndices: Set<number>
): void {
  const width = celebrationLineWidth(text);
  const startCol = Math.floor((state.cols - width) / 2);

  let currentCol = startCol;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === ' ') {
      currentCol += WORD_SPACING;
    } else {
      renderCharWithIndices(state, char, currentCol, centerRow, messageSquares, messageIndices);
      currentCol += DIGIT_WIDTH;
      if (i < text.length - 1 && text[i + 1] !== ' ') {
        currentCol += CHAR_SPACING;
      }
    }
  }
}

/**
 * Render celebration message as pixel art with auto-wrapping.
 * @returns Message squares, indices, and bounding box for wall fade
 */
export function renderCelebrationText(
  state: GridState,
  message: string
): { messageSquares: Square[]; messageIndices: Set<number>; boundingBox: BoundingBox } {
  const cleanedMessage = cleanMessage(message);
  const padding = 2;
  const lines = wrapWords(cleanedMessage, state.cols, padding);
  const messageSquares: Square[] = [];
  const messageIndices = new Set<number>();

  const totalHeight = lines.length * DIGIT_HEIGHT + (lines.length - 1) * LINE_SPACING;
  const startRow = Math.floor((state.rows - totalHeight) / 2);

  let minCol = state.cols;
  let maxCol = 0;
  let minRow = state.rows;
  let maxRow = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineRow = startRow + i * (DIGIT_HEIGHT + LINE_SPACING);
    const width = celebrationLineWidth(line);
    const lineStartCol = Math.floor((state.cols - width) / 2);

    minCol = Math.min(minCol, lineStartCol);
    maxCol = Math.max(maxCol, lineStartCol + width - 1);
    minRow = Math.min(minRow, lineRow);
    maxRow = Math.max(maxRow, lineRow + DIGIT_HEIGHT - 1);

    renderTextLineWithIndices(state, line, lineRow, messageSquares, messageIndices);
  }

  const margin = 2;
  const boundingBox: BoundingBox = {
    minCol: Math.max(0, minCol - margin),
    maxCol: Math.min(state.cols - 1, maxCol + margin),
    minRow: Math.max(0, minRow - margin),
    maxRow: Math.min(state.rows - 1, maxRow + margin),
  };

  return { messageSquares, messageIndices, boundingBox };
}

/** Clear celebration message classes from all squares. */
export function clearCelebrationText(state: GridState): void {
  for (const square of state.squares) {
    square.element.classList.remove(CSS_CLASSES.MESSAGE);
  }
}
