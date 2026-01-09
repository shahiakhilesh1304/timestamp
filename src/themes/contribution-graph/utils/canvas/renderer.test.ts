/**
 * Tests for canvas renderer.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAmbientState, type AmbientState } from './ambient';
import { createCanvasRenderer, type CanvasRenderer } from './renderer';
import { createCanvasGridState, type CanvasGridState } from './state';

/**
 * Create a more complete canvas 2D context mock for testing.
 * Extends the basic mock in vitest.setup.ts with additional methods.
 */
function createFullCanvasContextMock(): CanvasRenderingContext2D {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn().mockReturnValue({ data: [] }),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 0 }),
    fillText: vi.fn(),
    setTransform: vi.fn(),
    quadraticCurveTo: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    canvas: { width: 800, height: 600 },
  } as unknown as CanvasRenderingContext2D;
}

describe('createCanvasRenderer', () => {
  let renderer: CanvasRenderer;
  let grid: CanvasGridState;
  let ambient: AmbientState;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    // Override the global canvas mock with a more complete version
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(
      createFullCanvasContextMock()
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    renderer = createCanvasRenderer();
    grid = createCanvasGridState(800, 600);
    ambient = createAmbientState();
  });

  afterEach(() => {
    renderer.destroy();
    // Restore original mock
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  describe('canvas element', () => {
    it('should create canvas element', () => {
      expect(renderer.canvas).toBeInstanceOf(HTMLCanvasElement);
    });

    it('should set correct class name', () => {
      expect(renderer.canvas.className).toBe('contribution-graph-canvas');
    });

    it('should set testid attribute for E2E tests', () => {
      expect(renderer.canvas.getAttribute('data-testid')).toBe('countdown-display');
    });

    it('should set display style to block', () => {
      expect(renderer.canvas.style.display).toBe('block');
    });
  });

  describe('resize', () => {
    it('should set canvas display dimensions', () => {
      renderer.resize(grid);

      expect(renderer.canvas.style.width).toBe(`${grid.width}px`);
      expect(renderer.canvas.style.height).toBe(`${grid.height}px`);
    });

    it('should mark grid for full repaint after resize', () => {
      grid.fullRepaint = false;

      renderer.resize(grid);

      expect(grid.fullRepaint).toBe(true);
    });
  });

  describe('setColorMode', () => {
    it('should accept dark mode', () => {
      expect(() => renderer.setColorMode('dark')).not.toThrow();
    });

    it('should accept light mode', () => {
      expect(() => renderer.setColorMode('light')).not.toThrow();
    });

    it('should accept system mode', () => {
      expect(() => renderer.setColorMode('system')).not.toThrow();
    });
  });

  describe('render', () => {
    it('should not throw when rendering', () => {
      renderer.resize(grid);

      expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
    });

    it('should render on full repaint', () => {
      grid.fullRepaint = true;

      expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
    });

    it('should render dirty squares only when not full repaint', () => {
      grid.fullRepaint = false;
      grid.dirtySquares.add(0);
      grid.dirtySquares.add(1);

      expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
    });

    it('should clear dirty state after rendering', () => {
      grid.fullRepaint = true;
      grid.dirtySquares.add(0);

      renderer.render(grid, ambient, performance.now());

      expect(grid.fullRepaint).toBe(false);
      expect(grid.dirtySquares.size).toBe(0);
    });
  });

  describe('mouse events', () => {
    beforeEach(() => {
      renderer.resize(grid);
      // Mount canvas to body for getBoundingClientRect
      document.body.appendChild(renderer.canvas);
      // Mock getBoundingClientRect
      vi.spyOn(renderer.canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });

    afterEach(() => {
      renderer.canvas.remove();
    });

    describe('onMouseMove', () => {
      it('should update hover state for square under cursor', () => {
        const { squareSize, gap } = grid;
        // Position cursor in the middle of second square
        const clientX = squareSize + gap + squareSize / 2;
        const clientY = squareSize / 2;

        renderer.onMouseMove(grid, clientX, clientY);

        // The second square (index 1) should be hovered
        expect(grid.squares[1].isHovered).toBe(true);
      });

      it('should mark square as dirty when hover state changes', () => {
        grid.dirtySquares.clear();

        renderer.onMouseMove(grid, 5, 5);

        expect(grid.dirtySquares.has(0)).toBe(true);
      });

      it('should clear previous hover when moving to different square', () => {
        // First hover square 0
        renderer.onMouseMove(grid, 5, 5);
        expect(grid.squares[0].isHovered).toBe(true);

        // Move to a different position
        const { squareSize, gap } = grid;
        renderer.onMouseMove(grid, squareSize + gap + 5, 5);

        // First square no longer hovered
        expect(grid.squares[0].isHovered).toBe(false);
        // Second square now hovered
        expect(grid.squares[1].isHovered).toBe(true);
      });
    });

    describe('onMouseLeave', () => {
      it('should clear all hover states', () => {
        // Hover some squares
        grid.squares[0].isHovered = true;
        grid.squares[5].isHovered = true;

        renderer.onMouseLeave(grid);

        expect(grid.squares[0].isHovered).toBe(false);
        expect(grid.squares[5].isHovered).toBe(false);
      });

      it('should mark affected squares as dirty', () => {
        grid.squares[10].isHovered = true;
        grid.dirtySquares.clear();

        renderer.onMouseLeave(grid);

        expect(grid.dirtySquares.has(10)).toBe(true);
      });
    });
  });

  describe('destroy', () => {
    it('should remove canvas from DOM', () => {
      document.body.appendChild(renderer.canvas);
      expect(document.body.contains(renderer.canvas)).toBe(true);

      renderer.destroy();

      expect(document.body.contains(renderer.canvas)).toBe(false);
    });
  });
});

describe('square color effects', () => {
  let renderer: CanvasRenderer;
  let grid: CanvasGridState;
  let ambient: AmbientState;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(
      createFullCanvasContextMock()
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    renderer = createCanvasRenderer();
    grid = createCanvasGridState(800, 600);
    ambient = createAmbientState();
    renderer.resize(grid);
  });

  afterEach(() => {
    renderer.destroy();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('should render digit squares with correct flag', () => {
    grid.squares[0].isDigit = true;
    grid.fullRepaint = true;

    // Should not throw
    expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
  });

  it('should render wall squares with correct flag', () => {
    grid.squares[0].isWall = true;
    grid.fullRepaint = true;

    expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
  });

  it('should render message squares with correct flag', () => {
    grid.squares[0].isMessage = true;
    grid.fullRepaint = true;

    expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
  });

  it('should render ambient squares with animation', () => {
    grid.squares[0].isAmbient = true;
    grid.squares[0].ambientProgress = 0.5;
    grid.squares[0].ambientTargetIntensity = 3;
    ambient.animations.set(0, {
      index: 0,
      targetIntensity: 3,
      startTime: 0,
      duration: 1000,
    });
    grid.fullRepaint = true;

    expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
  });

  it('should render squares with different intensity levels', () => {
    for (let i = 0; i < 5; i++) {
      grid.squares[i].intensity = i;
    }
    grid.fullRepaint = true;

    expect(() => renderer.render(grid, ambient, performance.now())).not.toThrow();
  });
});
