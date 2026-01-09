/**
 * Canvas renderer for contribution graph theme.
 *
 * PERFORMANCE: Single `canvas` element replaces 5000+ DOM nodes.
 * - Eliminates WindowServer compositor overhead (49% to under 10% CPU)
 * - One GPU layer instead of thousands
 * - 30fps throttled animation (sufficient for ambient effects)
 * - Dirty-rect rendering: only repaint changed squares
 */

import type { ColorPalette } from '../colors';
import { getColors } from '../colors';
import type { AmbientState } from './ambient';
import { getAmbientIntensity } from './ambient';
import type { CanvasGridState, SquareState } from './state';
import { clearDirty, markDirty, markFullRepaint } from './state';

// =============================================================================
// TYPES
// =============================================================================

/** Canvas renderer instance. */
export interface CanvasRenderer {
  /** Canvas element. */
  canvas: HTMLCanvasElement;
  /** Render the current state. */
  render: (grid: CanvasGridState, ambient: AmbientState, now: number) => void;
  /** Update color palette (for theme switching). */
  setColorMode: (mode: 'dark' | 'light' | 'system') => void;
  /** Resize canvas to match grid state. */
  resize: (grid: CanvasGridState) => void;
  /** Handle mouse move for hover effects. */
  onMouseMove: (grid: CanvasGridState, clientX: number, clientY: number) => void;
  /** Handle mouse leave to clear hover. */
  onMouseLeave: (grid: CanvasGridState) => void;
  /** Destroy renderer and release resources. */
  destroy: () => void;
}

// =============================================================================
// RENDERING
// =============================================================================

/** Border radius as fraction of square size. */
const BORDER_RADIUS_RATIO = 0.15;

/**
 * Draw a rounded rectangle.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * Get square position from index.
 */
function getSquarePosition(
  index: number,
  cols: number,
  squareSize: number,
  gap: number
): { x: number; y: number } {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * (squareSize + gap),
    y: row * (squareSize + gap),
  };
}

/**
 * Get square color and opacity with hover and pulse effects applied.
 * Returns tuple of [color, opacity] for separate canvas rendering.
 * 
 * IMPORTANT: Wall squares cover everything underneath (digits, ambient, etc.).
 * When isWall=true, render solid wall color with NO pulse - the wall "hides" content.
 * Message squares pulse independently of wall state during reveal animation.
 */
function getSquareColorWithEffects(
  square: SquareState,
  index: number,
  palette: ColorPalette,
  ambient: AmbientState,
  now: number,
  colorMode: 'dark' | 'light'
): { color: string; opacity: number } {
  let baseColor: string;
  let opacity = 1;

  // PRIORITY 1: Wall covers everything - solid color, no pulse
  if (square.isWall) {
    baseColor = palette.digit;
    // Wall is opaque and static - no pulse animation
    // This ensures wall "covers" digits underneath during build
    opacity = 1;
  }
  // PRIORITY 2: Message squares (revealed text) - pulse animation
  else if (square.isMessage) {
    baseColor = palette.digit;
    // Pulse animation: organic stagger based on when square was created (like CSS)
    // Each square starts pulsing from its pulseStartTime, creating natural shimmer
    if (now && square.pulseStartTime > 0) {
      const elapsed = now - square.pulseStartTime;
      const pulseProgress = (elapsed % 1200) / 1200; // 0-1 over 1.2 seconds
      const pulseValue = Math.sin(pulseProgress * Math.PI * 2); // -1 to 1
      const minOpacity = colorMode === 'dark' ? 0.7 : 0.82;
      opacity = minOpacity + (1 - minOpacity) * (pulseValue * 0.5 + 0.5);
    }
  }
  // PRIORITY 3: Countdown digits - pulse animation
  else if (square.isDigit) {
    baseColor = palette.digit;
    // Pulse animation: organic stagger based on when square was created (like CSS)
    // Each square starts pulsing from its pulseStartTime, creating natural shimmer
    if (now && square.pulseStartTime > 0) {
      const elapsed = now - square.pulseStartTime;
      const pulseProgress = (elapsed % 1200) / 1200; // 0-1 over 1.2 seconds
      const pulseValue = Math.sin(pulseProgress * Math.PI * 2); // -1 to 1
      const minOpacity = colorMode === 'dark' ? 0.7 : 0.82;
      opacity = minOpacity + (1 - minOpacity) * (pulseValue * 0.5 + 0.5);
    }
  }
  // PRIORITY 4: Ambient activity animation
  else if (square.isAmbient && ambient.animations.has(index)) {
    // Interpolate ambient animation
    const intensity = getAmbientIntensity(
      square.ambientProgress,
      square.ambientTargetIntensity
    );
    if (intensity < 1) {
      baseColor = interpolateColor(palette.squares[0], palette.squares[1], intensity);
    } else {
      const fromIdx = Math.min(4, Math.floor(intensity));
      const toIdx = Math.min(4, Math.ceil(intensity));
      const t = intensity - fromIdx;
      baseColor = interpolateColor(palette.squares[fromIdx], palette.squares[toIdx], t);
    }
  }
  // PRIORITY 5: Base intensity color
  else {
    baseColor = palette.squares[square.intensity];
  }

  return { color: baseColor, opacity };
}

/**
 * Check if square should have hover effect (only non-empty squares).
 */
function canHover(square: SquareState): boolean {
  return (
    square.intensity > 0 ||
    square.isDigit ||
    square.isWall ||
    square.isMessage ||
    square.isAmbient
  );
}
/**
 * Interpolate between two colors.
 */
function interpolateColor(from: string, to: string, t: number): string {
  // Parse hex colors
  const fromR = parseInt(from.slice(1, 3), 16);
  const fromG = parseInt(from.slice(3, 5), 16);
  const fromB = parseInt(from.slice(5, 7), 16);
  
  const toR = parseInt(to.slice(1, 3), 16);
  const toG = parseInt(to.slice(3, 5), 16);
  const toB = parseInt(to.slice(5, 7), 16);
  
  // Interpolate
  const r = Math.round(fromR + (toR - fromR) * t);
  const g = Math.round(fromG + (toG - fromG) * t);
  const b = Math.round(fromB + (toB - fromB) * t);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Draw a rounded square with optional hover effect (1.15x scale) and opacity.
 * Uses canvas globalAlpha for pulse effect (works with alpha:false context).
 * 
 * NOTE: Drop shadows omitted - canvas shadowBlur is too expensive for real-time
 * rendering with 5000+ squares. The performance cost (laggy hover/resize) outweighs
 * the visual benefit. Digits remain visually distinct via color and pulse animation.
 */
function drawSquareWithEffects(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
  color: string,
  opacity: number,
  isHovered: boolean
): void {
  // Save current globalAlpha
  const prevAlpha = context.globalAlpha;
  context.globalAlpha = opacity;
  
  if (isHovered) {
    // Scale up 1.15x for hover effect
    const scale = 1.15;
    const scaledSize = size * scale;
    const offset = (scaledSize - size) / 2;
    context.fillStyle = color;
    drawRoundedRect(context, x - offset, y - offset, scaledSize, scaledSize, radius * scale);
  } else {
    context.fillStyle = color;
    drawRoundedRect(context, x, y, size, size, radius);
  }
  
  // Restore globalAlpha
  context.globalAlpha = prevAlpha;
}

// =============================================================================
// RENDERER FACTORY
// =============================================================================

/**
 * Create canvas renderer.
 */
export function createCanvasRenderer(): CanvasRenderer {
  const canvas = document.createElement('canvas');
  canvas.className = 'contribution-graph-canvas';
  canvas.style.display = 'block';
  canvas.setAttribute('data-testid', 'countdown-display'); // For E2E tests
  
  const ctx = canvas.getContext('2d', {
    alpha: false, // Opaque background - no blending needed
    desynchronized: true, // Hint for lower latency
  });
  
  if (!ctx) {
    throw new Error('Could not get canvas 2D context');
  }
  
  // Non-null context after the check
  const context = ctx;

  let palette: ColorPalette = getColors('system');
  let devicePixelRatio = window.devicePixelRatio || 1;
  let currentColorMode: 'dark' | 'light' = 'dark';

  // IMPORTANT: Paint initial background color immediately to prevent flash
  // This ensures the canvas has the correct background from the moment it's created,
  // not just after the first render() call. Prevents white flash on page load.
  context.fillStyle = palette.background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  /**
   * Resize canvas to match grid dimensions.
   */
  function resize(grid: CanvasGridState): void {
    devicePixelRatio = window.devicePixelRatio || 1;
    
    // Set display size
    canvas.style.width = `${grid.width}px`;
    canvas.style.height = `${grid.height}px`;
    
    // Set actual size for HiDPI
    canvas.width = grid.width * devicePixelRatio;
    canvas.height = grid.height * devicePixelRatio;
    
    // Scale context for HiDPI
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    
    // Paint background immediately after resize to prevent flash
    context.fillStyle = palette.background;
    context.fillRect(0, 0, grid.width, grid.height);
    
    // Force full repaint after resize
    markFullRepaint(grid);
  }

  /**
   * Render full grid (used on full repaint).
   */
  function renderFull(grid: CanvasGridState, ambient: AmbientState, now: number): void {
    const { squareSize, gap, cols } = grid;
    const radius = squareSize * BORDER_RADIUS_RATIO;

    // Clear with background
    context.fillStyle = palette.background;
    context.fillRect(0, 0, grid.width, grid.height);

    // Draw all squares
    for (let i = 0; i < grid.squares.length; i++) {
      const square = grid.squares[i];
      const { x, y } = getSquarePosition(i, cols, squareSize, gap);

      const { color, opacity } = getSquareColorWithEffects(square, i, palette, ambient, now, currentColorMode);
      const showHover = square.isHovered && canHover(square);
      
      drawSquareWithEffects(context, x, y, squareSize, radius, color, opacity, showHover);
    }

    clearDirty(grid);
  }

  /**
   * Render only dirty squares (incremental update).
   */
  function renderDirty(grid: CanvasGridState, ambient: AmbientState, now: number): void {
    const { squareSize, gap, cols } = grid;
    const radius = squareSize * BORDER_RADIUS_RATIO;

    for (const i of grid.dirtySquares) {
      const square = grid.squares[i];
      if (!square) continue;

      const { x, y } = getSquarePosition(i, cols, squareSize, gap);

      // Clear square area with background (account for hover scale)
      const clearSize = squareSize * 1.2; // Buffer for hover effect
      const clearOffset = (clearSize - squareSize) / 2;
      context.fillStyle = palette.background;
      context.fillRect(x - clearOffset, y - clearOffset, clearSize, clearSize);

      const { color, opacity } = getSquareColorWithEffects(square, i, palette, ambient, now, currentColorMode);
      const showHover = square.isHovered && canHover(square);
      
      drawSquareWithEffects(context, x, y, squareSize, radius, color, opacity, showHover);
    }

    clearDirty(grid);
  }

  /**
   * Main render function.
   */
  function render(grid: CanvasGridState, ambient: AmbientState, now: number): void {
    if (grid.fullRepaint) {
      renderFull(grid, ambient, now);
    } else if (grid.dirtySquares.size > 0) {
      renderDirty(grid, ambient, now);
    }
  }

  /**
   * Set color mode.
   */
  function setColorMode(mode: 'dark' | 'light' | 'system'): void {
    palette = getColors(mode);
    currentColorMode = mode === 'system'
      ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
  }

  /**
   * Handle mouse move for hover effects.
   */
  function onMouseMove(grid: CanvasGridState, clientX: number, clientY: number): void {
    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Convert to grid coordinates
    const col = Math.floor(canvasX / (grid.squareSize + grid.gap));
    const row = Math.floor(canvasY / (grid.squareSize + grid.gap));

    // Update hover state
    for (let i = 0; i < grid.squares.length; i++) {
      const square = grid.squares[i];
      const squareCol = i % grid.cols;
      const squareRow = Math.floor(i / grid.cols);
      const wasHovered = square.isHovered;
      const nowHovered = squareCol === col && squareRow === row;

      if (wasHovered !== nowHovered) {
        square.isHovered = nowHovered;
        markDirty(grid, i);
      }
    }
  }

  /**
   * Handle mouse leave to clear hover.
   */
  function onMouseLeave(grid: CanvasGridState): void {
    for (let i = 0; i < grid.squares.length; i++) {
      if (grid.squares[i].isHovered) {
        grid.squares[i].isHovered = false;
        markDirty(grid, i);
      }
    }
  }

  /**
   * Destroy renderer.
   */
  function destroy(): void {
    canvas.remove();
  }

  return {
    canvas,
    render,
    setColorMode,
    resize,
    onMouseMove,
    onMouseLeave,
    destroy,
  };
}
