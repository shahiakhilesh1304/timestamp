/**
 * Tests for ambient activity animation.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
    createAmbientState,
    getAmbientIntensity,
    getTickInterval,
    manageAmbientActivity,
    setPhase,
    startAmbient,
    stopAmbient,
    updateAmbientAnimations,
    type AmbientState,
} from './ambient';
import { createCanvasGridState, type CanvasGridState } from './state';

describe('createAmbientState', () => {
  it('should create state with default values', () => {
    const state = createAmbientState();

    expect(state.animations).toBeInstanceOf(Map);
    expect(state.animations.size).toBe(0);
    expect(state.phase).toBe('calm');
    expect(state.isRunning).toBe(false);
    expect(state.nextTickTime).toBe(0);
  });
});

describe('startAmbient', () => {
  it('should set isRunning to true', () => {
    const state = createAmbientState();

    startAmbient(state);

    expect(state.isRunning).toBe(true);
  });

  it('should reset nextTickTime to 0', () => {
    const state = createAmbientState();
    state.nextTickTime = 1000;

    startAmbient(state);

    expect(state.nextTickTime).toBe(0);
  });
});

describe('stopAmbient', () => {
  let ambient: AmbientState;
  let grid: CanvasGridState;

  beforeEach(() => {
    ambient = createAmbientState();
    grid = createCanvasGridState(500, 400);
    startAmbient(ambient);
  });

  it('should set isRunning to false', () => {
    stopAmbient(ambient, grid);

    expect(ambient.isRunning).toBe(false);
  });

  it('should clear all animations', () => {
    // Add some animations
    ambient.animations.set(0, {
      index: 0,
      targetIntensity: 2,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[0].isAmbient = true;

    stopAmbient(ambient, grid);

    expect(ambient.animations.size).toBe(0);
  });

  it('should reset ambient square states', () => {
    // Set up an ambient square
    const squareIndex = 5;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 3,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[squareIndex].isAmbient = true;
    grid.squares[squareIndex].ambientProgress = 0.5;
    grid.squares[squareIndex].ambientTargetIntensity = 3;

    stopAmbient(ambient, grid);

    expect(grid.squares[squareIndex].isAmbient).toBe(false);
    expect(grid.squares[squareIndex].ambientProgress).toBe(0);
    expect(grid.squares[squareIndex].ambientTargetIntensity).toBe(0);
  });

  it('should mark affected squares as dirty', () => {
    const squareIndex = 10;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 2,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[squareIndex].isAmbient = true;
    grid.dirtySquares.clear();
    grid.fullRepaint = false;

    stopAmbient(ambient, grid);

    expect(grid.dirtySquares.has(squareIndex)).toBe(true);
  });
});

describe('setPhase', () => {
  it('should update phase', () => {
    const state = createAmbientState();

    setPhase(state, 'building');
    expect(state.phase).toBe('building');

    setPhase(state, 'intense');
    expect(state.phase).toBe('intense');

    setPhase(state, 'final');
    expect(state.phase).toBe('final');
  });
});

describe('getAmbientIntensity', () => {
  it('should return 0 at progress 0', () => {
    const intensity = getAmbientIntensity(0, 4);

    expect(intensity).toBe(0);
  });

  it('should return target intensity at peak (progress 0.25-0.50)', () => {
    const targetIntensity = 4;

    // At 0.25, should be at full intensity
    const at25 = getAmbientIntensity(0.25, targetIntensity);
    expect(at25).toBeCloseTo(targetIntensity, 1);

    // At 0.40, still at full intensity
    const at40 = getAmbientIntensity(0.40, targetIntensity);
    expect(at40).toBeCloseTo(targetIntensity, 1);
  });

  it('should return 0 at progress 1', () => {
    const intensity = getAmbientIntensity(1, 4);

    expect(intensity).toBe(0);
  });

  it('should fade in during 0-0.25', () => {
    const target = 4;
    const at10 = getAmbientIntensity(0.10, target);
    const at20 = getAmbientIntensity(0.20, target);

    expect(at20).toBeGreaterThan(at10);
    expect(at10).toBeGreaterThan(0);
    expect(at20).toBeLessThan(target);
  });

  it('should fade out during 0.50-1.00', () => {
    const target = 4;
    const at60 = getAmbientIntensity(0.60, target);
    const at80 = getAmbientIntensity(0.80, target);

    expect(at60).toBeGreaterThan(at80);
    expect(at60).toBeLessThan(target);
    expect(at80).toBeGreaterThan(0);
  });

  it('should scale intensity by target', () => {
    const progress = 0.30; // During hold phase
    const low = getAmbientIntensity(progress, 1);
    const high = getAmbientIntensity(progress, 4);

    expect(high).toBeGreaterThan(low);
    expect(high / low).toBeCloseTo(4, 1);
  });
});

describe('getTickInterval', () => {
  it('should return shorter intervals for more intense phases', () => {
    const calm = getTickInterval('calm');
    const building = getTickInterval('building');
    const intense = getTickInterval('intense');
    const final = getTickInterval('final');

    expect(calm).toBeGreaterThan(building);
    expect(building).toBeGreaterThan(intense);
    expect(intense).toBeGreaterThan(final);
  });

  it('should return positive values for all phases', () => {
    expect(getTickInterval('calm')).toBeGreaterThan(0);
    expect(getTickInterval('building')).toBeGreaterThan(0);
    expect(getTickInterval('intense')).toBeGreaterThan(0);
    expect(getTickInterval('final')).toBeGreaterThan(0);
  });
});

describe('manageAmbientActivity', () => {
  let ambient: AmbientState;
  let grid: CanvasGridState;

  beforeEach(() => {
    ambient = createAmbientState();
    grid = createCanvasGridState(500, 400);
    startAmbient(ambient);
    grid.fullRepaint = false;
    grid.dirtySquares.clear();
  });

  it('should not add animations when not running', () => {
    ambient.isRunning = false;

    manageAmbientActivity(grid, ambient, 1000);

    expect(ambient.animations.size).toBe(0);
  });

  it('should add animations when running and time has elapsed', () => {
    manageAmbientActivity(grid, ambient, 1000);

    expect(ambient.animations.size).toBeGreaterThan(0);
  });

  it('should mark new ambient squares as dirty', () => {
    manageAmbientActivity(grid, ambient, 1000);

    expect(grid.dirtySquares.size).toBeGreaterThan(0);
  });

  it('should set isAmbient flag on affected squares', () => {
    manageAmbientActivity(grid, ambient, 1000);

    for (const [index] of ambient.animations) {
      expect(grid.squares[index].isAmbient).toBe(true);
    }
  });

  it('should not add animations to digit squares', () => {
    // Mark first 10 squares as digits
    for (let i = 0; i < 10; i++) {
      grid.squares[i].isDigit = true;
      grid.digitIndices.add(i);
    }

    manageAmbientActivity(grid, ambient, 1000);

    for (const [index] of ambient.animations) {
      expect(grid.squares[index].isDigit).toBe(false);
    }
  });

  it('should not add animations to wall squares', () => {
    // Mark first 10 squares as wall
    for (let i = 0; i < 10; i++) {
      grid.squares[i].isWall = true;
    }

    manageAmbientActivity(grid, ambient, 1000);

    for (const [index] of ambient.animations) {
      expect(grid.squares[index].isWall).toBe(false);
    }
  });

  it('should not add animations to message squares', () => {
    // Mark first 10 squares as message
    for (let i = 0; i < 10; i++) {
      grid.squares[i].isMessage = true;
    }

    manageAmbientActivity(grid, ambient, 1000);

    for (const [index] of ambient.animations) {
      expect(grid.squares[index].isMessage).toBe(false);
    }
  });

  it('should respect digit bounding box exclusion', () => {
    // Set digit bounding box covering top-left area
    grid.digitBounds = { minCol: 0, maxCol: 5, minRow: 0, maxRow: 5 };

    manageAmbientActivity(grid, ambient, 1000);

    // Check no animations are in the exclusion zone
    for (const [index] of ambient.animations) {
      const col = index % grid.cols;
      const row = Math.floor(index / grid.cols);
      const inExclusionZone =
        col >= 0 && col <= 5 && row >= 0 && row <= 5;
      expect(inExclusionZone).toBe(false);
    }
  });
});

describe('updateAmbientAnimations', () => {
  let ambient: AmbientState;
  let grid: CanvasGridState;

  beforeEach(() => {
    ambient = createAmbientState();
    grid = createCanvasGridState(500, 400);
    startAmbient(ambient);
    grid.fullRepaint = false;
    grid.dirtySquares.clear();
  });

  it('should return false when not running', () => {
    ambient.isRunning = false;

    const result = updateAmbientAnimations(grid, ambient, 1000);

    expect(result).toBe(false);
  });

  it('should update animation progress', () => {
    const squareIndex = 10;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 3,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[squareIndex].isAmbient = true;

    updateAmbientAnimations(grid, ambient, 500);

    expect(grid.squares[squareIndex].ambientProgress).toBeCloseTo(0.5, 1);
  });

  it('should remove completed animations', () => {
    const squareIndex = 10;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 3,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[squareIndex].isAmbient = true;

    // Advance past animation duration
    updateAmbientAnimations(grid, ambient, 1500);

    expect(ambient.animations.has(squareIndex)).toBe(false);
    expect(grid.squares[squareIndex].isAmbient).toBe(false);
  });

  it('should return true when animations are active', () => {
    const squareIndex = 10;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 3,
      startTime: 0,
      duration: 2000,
    });
    grid.squares[squareIndex].isAmbient = true;

    const result = updateAmbientAnimations(grid, ambient, 500);

    expect(result).toBe(true);
  });

  it('should return false when no animations exist', () => {
    const result = updateAmbientAnimations(grid, ambient, 1000);

    expect(result).toBe(false);
  });

  it('should mark affected squares as dirty', () => {
    const squareIndex = 10;
    ambient.animations.set(squareIndex, {
      index: squareIndex,
      targetIntensity: 3,
      startTime: 0,
      duration: 1000,
    });
    grid.squares[squareIndex].isAmbient = true;

    updateAmbientAnimations(grid, ambient, 500);

    expect(grid.dirtySquares.has(squareIndex)).toBe(true);
  });
});
