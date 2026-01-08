import { describe, expect, it } from 'vitest';
import { CSS_CLASSES } from '../../../config';
import type { GridState, Square } from '../../../types';
import { clearCelebrationText, renderCelebrationText } from './celebration-renderer';

function createGridState(cols = 20, rows = 15): GridState {
  const squares: Square[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      squares.push({
        element: document.createElement('div'),
        isDigit: false,
        col,
        row,
      });
    }
  }

  return {
    grid: document.createElement('div'),
    squares,
    cols,
    rows,
    lastTimeStr: null,
    lastDigitIndices: new Set(),
    digitBoundingBox: null,
    exclusionZone: null,
    ambientSquares: [],
    activeAmbient: new Set(),
    ambientSquaresDirty: false,
    cancelAnimation: false,
    wallPlacements: null,
    pendingCleanups: new WeakMap(),
    animatingSquares: new WeakSet(),
  };
}

/** Tests for celebration text rendering. */
describe('celebration-renderer', () => {
  it('should render message squares with bounding box when message is provided', () => {
    const state = createGridState();

    const { messageSquares, messageIndices, boundingBox } = renderCelebrationText(state, 'HI');

    expect(messageSquares.length).toBeGreaterThan(0);
    expect(messageIndices.size).toBe(messageSquares.length);
    expect(Array.from(messageSquares).every((sq) => sq.element.classList.contains(CSS_CLASSES.MESSAGE))).toBe(true);
    expect(boundingBox.minCol).toBeGreaterThanOrEqual(0);
    expect(boundingBox.maxCol).toBeLessThan(state.cols);
    expect(boundingBox.minRow).toBeGreaterThanOrEqual(0);
    expect(boundingBox.maxRow).toBeLessThan(state.rows);
  });

  it('should wrap text into multiple lines when width is constrained', () => {
    const state = createGridState(12, 20);

    const { messageSquares, boundingBox } = renderCelebrationText(state, 'HELLO WORLD AGAIN');

    expect(messageSquares.length).toBeGreaterThan(0);
    expect(boundingBox.maxRow - boundingBox.minRow).toBeGreaterThan(6); // spans multiple rows when wrapped
  });

  it('should clear celebration message classes when clearing celebration text', () => {
    const state = createGridState();
    const { messageSquares } = renderCelebrationText(state, 'OK');

    clearCelebrationText(state);

    expect(messageSquares.every((sq) => !sq.element.classList.contains(CSS_CLASSES.MESSAGE))).toBe(true);
  });

  it('should render messages with numbers (digits 0-9)', () => {
    const state = createGridState(80, 20); // Wide grid for long message

    const { messageSquares, messageIndices } = renderCelebrationText(state, '2026');

    // Should render all characters including the numbers
    expect(messageSquares.length).toBeGreaterThan(0);
    expect(messageIndices.size).toBe(messageSquares.length);
    
    // All message squares should have the MESSAGE class
    expect(messageSquares.every((sq) => sq.element.classList.contains(CSS_CLASSES.MESSAGE))).toBe(true);
  });
});