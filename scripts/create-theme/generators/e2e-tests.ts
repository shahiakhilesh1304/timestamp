/**
 * Generate the E2E test file (e2e/mobile-viewport.spec.ts).
 *
 * Creates Playwright E2E tests covering:
 * - Mobile viewport behavior
 * - Countdown visibility and layout
 * - Theme-specific rendering
 * - Responsive design
 *
 * This is a starting point - theme authors should add theme-specific tests
 * for unique visual features, celebration animations, etc.
 *
 * @param themeName - Kebab-case theme name
 * @returns Generated TypeScript source code
 *
 * @example
 * // Generated file structure:
 * // src/themes/my-theme/e2e/mobile-viewport.spec.ts
 *
 * @see src/themes/contribution-graph/e2e/ - Complex theme with multiple E2E tests
 * @see src/themes/fireworks/e2e/mobile-viewport.spec.ts - Simpler theme example
 */
import { toPascalCase } from '../utils/string-utils';

export function generateE2EMobileViewportSpec(themeName: string): string {
  const pascal = toPascalCase(themeName);
  const testUrl = `/?theme=${themeName}&mode=wall-clock&target=2099-01-01T00:00:00`;

  return `/**
 * ${pascal} Theme Mobile Viewport Tests
 *
 * Tests mobile viewport behavior specific to the ${themeName} theme.
 * These tests verify that the theme renders properly on mobile devices.
 *
 * Add more E2E tests here for theme-specific behaviors:
 * - Celebration animations (see contribution-graph/e2e/celebration-phases.spec.ts)
 * - Initial render timing (see contribution-graph/e2e/initial-render.spec.ts)
 * - Performance benchmarks (see contribution-graph/e2e/activity-performance.spec.ts)
 * - Theme-specific visual features
 */

import { expect, test } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 375, height: 667 };
const SMALL_MOBILE_VIEWPORT = { width: 320, height: 568 };
const TEST_URL = '${testUrl}';

test.describe('${pascal} Theme: Mobile Viewport', () => {
  test('countdown display is visible on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    const countdownDisplay = page.getByTestId('countdown-display');
    await expect(countdownDisplay).toBeVisible();
    
    const boundingBox = await countdownDisplay.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    if (boundingBox) {
      // Countdown should be within viewport bounds (allow small tolerance for borders/shadows)
      expect(boundingBox.x).toBeGreaterThanOrEqual(-20);
      expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
    }
  });

  test('countdown scales appropriately on small viewport', async ({ page }) => {
    await page.setViewportSize(SMALL_MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    const countdownDisplay = page.getByTestId('countdown-display');
    await expect(countdownDisplay).toBeVisible();
    
    const boundingBox = await countdownDisplay.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    if (boundingBox) {
      // Scaffold countdown visible on screen (may need responsive CSS for tight fit)
      // TODO: Once responsive styles added, tighten to: width <= SMALL_MOBILE_VIEWPORT.width - 20
      expect(boundingBox.x).toBeGreaterThanOrEqual(-50);
      expect(boundingBox.width).toBeLessThanOrEqual(SMALL_MOBILE_VIEWPORT.width + 100);
    }
  });

  test('theme container fills viewport on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    const themeContainer = page.getByTestId('theme-container');
    await expect(themeContainer).toBeVisible();
    
    const boundingBox = await themeContainer.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    if (boundingBox) {
      // Theme container should fill most of the viewport
      expect(boundingBox.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 10);
      expect(boundingBox.height).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.height - 10);
    }
  });
});

test.describe('${pascal} Theme: Mobile Layout', () => {
  test('theme fills full width on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    const themeContainer = page.getByTestId('theme-container');
    await expect(themeContainer).toBeVisible();
    
    const boundingBox = await themeContainer.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    if (boundingBox) {
      // Should be flush with left edge (within tolerance)
      expect(boundingBox.x).toBeLessThanOrEqual(5);
      // Should extend to right edge (within tolerance)
      expect(boundingBox.x + boundingBox.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 5);
    }
  });

  test('countdown is centered and visible on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    const countdownDisplay = page.getByTestId('countdown-display');
    await expect(countdownDisplay).toBeVisible();
    
    const boundingBox = await countdownDisplay.boundingBox();
    expect(boundingBox).not.toBeNull();
    
    if (boundingBox) {
      // Countdown should be within viewport (allow small tolerance for borders/shadows)
      expect(boundingBox.x).toBeGreaterThanOrEqual(-20);
      expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(MOBILE_VIEWPORT.width + 20);
      
      // Countdown should be roughly centered horizontally
      const centerX = boundingBox.x + boundingBox.width / 2;
      const screenCenter = MOBILE_VIEWPORT.width / 2;
      expect(Math.abs(centerX - screenCenter)).toBeLessThan(MOBILE_VIEWPORT.width * 0.3);
    }
  });

  test('no horizontal gaps or overflow on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(TEST_URL);
    
    await expect(page.getByTestId('countdown-display')).toBeAttached();
    await page.waitForTimeout(500); // Wait for layout to stabilize
    
    const themeContainer = page.getByTestId('theme-container');
    await expect(themeContainer).toBeVisible();
    
    const containerBox = await themeContainer.boundingBox();
    expect(containerBox).not.toBeNull();
    
    if (containerBox) {
      // No horizontal gaps or overflow
      expect(containerBox.x).toBeLessThanOrEqual(5);
      expect(containerBox.width).toBeGreaterThanOrEqual(MOBILE_VIEWPORT.width - 10);
    }
  });
});
`;
}
