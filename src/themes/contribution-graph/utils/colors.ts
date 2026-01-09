/**
 * Color palette for canvas rendering.
 *
 * Provides the same colors as the CSS version but as hex values
 * for direct canvas fillStyle usage.
 */

/** Color palette for a single color mode. */
export interface ColorPalette {
  background: string;
  /** Intensity levels 0-4 (0 = empty, 4 = brightest). */
  squares: readonly [string, string, string, string, string];
  digit: string;
}

/** Color palettes by mode. */
export const COLORS = {
  dark: {
    background: '#0d1117',
    squares: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'] as const,
    digit: '#39d353',
  },
  light: {
    background: '#ffffff',
    squares: ['#f9fafb', '#9be9a8', '#40c463', '#30a14e', '#216e39'] as const,
    digit: '#166534',
  },
} as const satisfies Record<string, ColorPalette>;

/**
 * Get color palette for current color mode.
 * @param colorMode - 'dark' or 'light' (or 'system' to detect)
 */
export function getColors(colorMode: 'dark' | 'light' | 'system' = 'system'): ColorPalette {
  if (colorMode === 'system') {
    const prefersDark = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? COLORS.dark : COLORS.light;
  }
  return COLORS[colorMode];
}

/**
 * Get color for a square based on its state.
 * @param palette - Color palette
 * @param intensity - 0-4 intensity level
 * @param isDigit - Whether square is part of countdown digits
 */
export function getSquareColor(palette: ColorPalette, intensity: number, isDigit: boolean): string {
  if (isDigit) return palette.digit;
  return palette.squares[Math.min(Math.max(0, intensity), 4)];
}
