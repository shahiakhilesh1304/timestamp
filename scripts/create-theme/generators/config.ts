/**
 * Generate the theme configuration file (config/index.ts).
 *
 * Contains theme-specific constants, colors, animation timings, and ThemeConfig.
 * The ThemeConfig is the source of truth for theme metadata - the registry
 * imports from here to avoid duplication.
 *
 * Imports ThemeConfig from \@themes/shared/types for consistency.
 *
 * @param themeName - Kebab-case theme name
 * @param author - GitHub username of author (normalized, without \@) or null
 * @returns Generated TypeScript source code
 */
import { toPascalCase, toSnakeCase } from '../utils/string-utils';

export function generateConfigTs(themeName: string, author: string | null): string {
  const pascal = toPascalCase(themeName);
  const snakeUpper = toSnakeCase(themeName).toUpperCase();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const authorValue = author ? `'${author}'` : 'null';

  return `/**
 * ${pascal} Theme Configuration
 *
 * Centralized settings for visuals, animations, and ThemeConfig.
 *
 * IMPORTANT: The ThemeConfig here is the source of truth for theme metadata.
 * The registry imports from this file to avoid duplication.
 */

import type { ThemeConfig } from '@themes/shared/types';

// =============================================================================
// THEME CONFIGURATION
// =============================================================================

/**
 * Theme configuration for ${pascal}.
 *
 * @remarks
 * This is the source of truth for theme metadata. The registry imports
 * from this file to avoid duplication of id, name, description, etc.
 */
export const ${snakeUpper}_CONFIG: ThemeConfig = {
  id: '${themeName}',
  name: '${pascal}',
  description: 'A countdown theme with a pulsing ring animation',
  publishedDate: '${today}',
  author: ${authorValue},
  tags: ['countdown', 'animation', 'pulsing'],
  /**
   * External npm packages used by this theme. Generates README Dependencies section.
   * These are used to showcase the dependencies used in the theme's auto-generated readme
   * and as a tooltip in the theme selection UI. The intent is to callback to the great
   * open source projects that power our themes!
   *
   * @example
   * dependencies: [
   *   \\{ name: 'package-name', url: 'https://github.com/owner/package' \\}
   * ]
   */
  dependencies: [],
  supportsWorldMap: true,
  availableInIssueTemplate: true,
  optionalComponents: {
    timezoneSelector: true,
    worldMap: true,
  },
  colors: {
    dark: {
      accentPrimary: '#58a6ff',   // Blue accent for dark mode
      accentSecondary: '#8b949e', // Gray accent for dark mode
      // Optional overrides (uncomment to customize):
      // textOnAccent: '#ffffff',   // Text color on accent backgrounds (buttons, checkmarks)
      // success: '#238636',        // Success state color
      // textOnSuccess: '#ffffff',  // Text color on success backgrounds
      // error: '#f85149',          // Error state color
      // focusRing: '#58a6ff',      // Keyboard focus indicator
    },
    light: {
      accentPrimary: '#0969da',   // Darker blue for light mode
      accentSecondary: '#656d76', // Darker gray for light mode
      // Optional overrides (uncomment to customize):
      // textOnAccent: '#ffffff',   // Text color on accent backgrounds (buttons, checkmarks)
      // success: '#1a7f37',        // Success state color
      // textOnSuccess: '#ffffff',  // Text color on success backgrounds
      // error: '#cf222e',          // Error state color
      // focusRing: '#0969da',      // Keyboard focus indicator
    },
  },
};
`;
}
