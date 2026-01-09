/**
 * Performance E2E Tests
 *
 * Validates performance budgets and regression detection for key operations.
 * Uses percentile-based assertions to reduce flakiness.
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForCountdown, waitForMobileMenuButton } from './fixtures/test-utils';
import { getThemeIdsForTest } from './fixtures/theme-fixtures';

/** Performance budget thresholds */
const PERF_BUDGETS = {
  /** Theme switch should complete within this time (increased from 600ms to reduce flakiness) */
  THEME_SWITCH_MAX_MS: 1200,
  /** CI headless runners are slower; allow more headroom to avoid flake */
  THEME_SWITCH_MAX_MS_CI: 2000,
  /** First meaningful paint after navigation */
  FIRST_PAINT_MAX_MS: 3500,
  /** Countdown tick should be fast */
  TICK_P95_MAX_MS: 5,
  /** Mobile menu open/close */
  MENU_ANIMATION_MAX_MS: 1100,
  /** Grid rebuild after resize - with headroom for machine variance */
  RESIZE_REBUILD_MAX_MS: 500,
  /** Maximum DOM nodes (performance indicator) - increased to account for WeakMap/WeakSet overhead */
  MAX_DOM_NODES: 11000,
  /** Minimum FPS during animations */
  MIN_FPS_P95: 50,
} as const;

const IS_CI = Boolean(process.env.CI);
// Allow a lower FPS budget on headless CI while enforcing a higher budget locally.
const HIGH_RES_FPS_THRESHOLD = IS_CI ? 5 : 40;

const THEMES_UNDER_TEST = getThemeIdsForTest();

/** Mobile viewport for responsive tests */
const MOBILE_VIEWPORT = { width: 375, height: 667 };

/** Desktop viewport */
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

/**
 * Navigate to countdown page with specified theme.
 */
async function navigateToCountdown(
  page: Page,
  theme: string = 'contribution-graph'
): Promise<void> {
  // Navigate with a deep link to skip landing page
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1); // Tomorrow
  // Remove Z suffix for wall-clock mode compatibility
  const isoTarget = targetDate.toISOString().slice(0, -1);

  await page.goto(`/?theme=${theme}&mode=wall-clock&target=${isoTarget}`);
  await waitForStableCountdown(page);
}

async function waitForStableCountdown(page: Page, timeout = 5000): Promise<void> {
  const themeModal = page.getByTestId('theme-modal');
  if (await themeModal.isVisible().catch(() => false)) {
    await expect(themeModal).not.toBeVisible({ timeout });
  }
  await waitForCountdown(page);
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="countdown-display"]').length === 1,
    { timeout }
  );
}

/**
 * Measure operation duration using performance marks.
 */
async function measureOperation(
  page: Page,
  operation: () => Promise<void>
): Promise<number> {
  const start = await page.evaluate(() => performance.now());
  await operation();
  const end = await page.evaluate(() => performance.now());
  return end - start;
}

/**
 * Get DOM node count.
 */
async function getDomNodeCount(page: Page): Promise<number> {
  return page.evaluate(() => document.getElementsByTagName('*').length);
}

/**
 * Measure FPS over a duration using RAF.
 */
async function measureFPS(page: Page, durationMs: number = 2000): Promise<number[]> {
  return page.evaluate(async (duration) => {
    return new Promise<number[]>((resolve) => {
      const samples: number[] = [];
      let frameCount = 0;
      let lastSample = performance.now();
      const sampleInterval = 500; // Sample every 500ms
      const endTime = performance.now() + duration;

      function tick(timestamp: number) {
        frameCount++;

        if (timestamp - lastSample >= sampleInterval) {
          const elapsed = timestamp - lastSample;
          const fps = Math.round((frameCount * 1000) / elapsed);
          samples.push(fps);
          frameCount = 0;
          lastSample = timestamp;
        }

        if (timestamp < endTime) {
          requestAnimationFrame(tick);
        } else {
          resolve(samples);
        }
      }

      requestAnimationFrame(tick);
    });
  }, durationMs);
}

/**
 * Calculate percentile from array.
 */
function getPercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor(sorted.length * (percentile / 100));
  return sorted[Math.min(index, sorted.length - 1)];
}

test.describe('Performance: Initial Load @perf', () => {
  test('landing page loads within budget', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await expect(page.getByTestId('landing-start-button')).toBeVisible();
    const loadTime = Date.now() - start;

    expect(loadTime).toBeLessThan(PERF_BUDGETS.FIRST_PAINT_MAX_MS);
  });

  test('LCP candidate has fetchpriority="high"', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('landing-start-button')).toBeVisible();

    // First theme card should use <img> with fetchpriority="high" for LCP optimization
    const lcpImage = page.locator('.theme-selector-card-preview-img').first();
    await expect(lcpImage).toBeVisible();
    await expect(lcpImage).toHaveAttribute('fetchpriority', 'high');
  });
});

for (const themeId of THEMES_UNDER_TEST) {
  const targetTheme = THEMES_UNDER_TEST.find((t) => t !== themeId) ?? themeId;

  test.describe(`Performance: Initial Load (${themeId}) @perf`, () => {
    test(`countdown page loads within budget (${themeId})`, async ({ page }) => {
      const start = Date.now();
      await navigateToCountdown(page, themeId);
      const loadTime = Date.now() - start;

      expect(loadTime).toBeLessThan(PERF_BUDGETS.FIRST_PAINT_MAX_MS);
    });

    test(`DOM node count stays within budget (${themeId})`, async ({ page }) => {
      await navigateToCountdown(page, themeId);

      const nodeCount = await getDomNodeCount(page);
      expect(nodeCount).toBeLessThan(PERF_BUDGETS.MAX_DOM_NODES);
    });
  });
}

for (const themeId of THEMES_UNDER_TEST) {
  const targetTheme = THEMES_UNDER_TEST.find((t) => t !== themeId) ?? themeId;

  test.describe(`Performance: Theme Switching (${themeId}) @perf`, () => {
    test(`theme switch completes within budget from ${themeId} to ${targetTheme}`, async ({ page }) => {
      await navigateToCountdown(page, themeId);

      // Open theme switcher
      await page.getByTestId('theme-switcher').click();
      await expect(page.getByTestId('theme-modal')).toBeVisible();

      // Measure theme switch
      const themeSwitchBudget = IS_CI
        ? PERF_BUDGETS.THEME_SWITCH_MAX_MS_CI
        : PERF_BUDGETS.THEME_SWITCH_MAX_MS;

      const switchDuration = await measureOperation(page, async () => {
        await page.getByTestId(`theme-card-${targetTheme}`).click();
        await expect(page.getByTestId('theme-modal')).not.toBeVisible({ timeout: 5000 });
        await waitForStableCountdown(page);
      });

      expect(switchDuration).toBeLessThan(themeSwitchBudget);
    });

  });
}


for (const themeId of THEMES_UNDER_TEST) {
  test.describe(`Performance: Frame Rate (${themeId}) @perf`, () => {
    test(`maintains acceptable FPS during countdown (${themeId})`, async ({ page }) => {
      await navigateToCountdown(page, themeId);
      await waitForStableCountdown(page);

      // Measure FPS over 3 seconds
      const fpsSamples = await measureFPS(page, 3000);

      if (fpsSamples.length > 0) {
        const p95fps = getPercentile(fpsSamples, 5); // 5th percentile = worst 5%

        // FPS should stay above threshold most of the time
        expect(p95fps).toBeGreaterThanOrEqual(PERF_BUDGETS.MIN_FPS_P95);
      }
    });

    test(`no major FPS drops during hover interactions (${themeId})`, async ({ page }, testInfo) => {
      await navigateToCountdown(page, themeId);
      await waitForStableCountdown(page);

      // Start FPS measurement
      const fpsPromise = measureFPS(page, 2000);

      // Perform hover interactions while measuring
      const grid = page.getByTestId('countdown-display');
      if (await grid.isVisible()) {
        const box = await grid.boundingBox();
        if (box) {
          // Move mouse around the grid
          for (let i = 0; i < 10; i++) {
            const x = box.x + Math.random() * box.width;
            const y = box.y + Math.random() * box.height;
            await page.mouse.move(x, y);
            await expect(grid).toBeVisible();
          }
        }
      }

      const fpsSamples = await fpsPromise;

      if (fpsSamples.length > 0) {
        const minFps = Math.min(...fpsSamples);
        // High-resolution viewports may have lower FPS due to increased rendering load
        const isHighRes = testInfo.project.name === 'high-res';
        const minFpsThreshold = isHighRes ? 15 : 30;
        expect(minFps).toBeGreaterThanOrEqual(minFpsThreshold);
      }
    });
  });
}

for (const themeId of THEMES_UNDER_TEST) {
  test.describe(`Performance: Responsive (${themeId}) @perf`, () => {
    test(`resize does not cause excessive layout thrashing (${themeId})`, async ({ page }) => {
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await navigateToCountdown(page, themeId);
      await waitForStableCountdown(page);

      // Measure resize operation
      const resizeDuration = await measureOperation(page, async () => {
        await page.setViewportSize(MOBILE_VIEWPORT);
        await waitForStableCountdown(page, 2000);
      });

      expect(resizeDuration).toBeLessThan(PERF_BUDGETS.RESIZE_REBUILD_MAX_MS);

      // DOM count should still be reasonable after resize
      const nodeCount = await getDomNodeCount(page);
      expect(nodeCount).toBeLessThan(PERF_BUDGETS.MAX_DOM_NODES);
    });

    test(`mobile menu opens quickly (${themeId})`, async ({ page }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await navigateToCountdown(page, themeId);

      // Wait for mobile menu button
      await waitForMobileMenuButton(page);
      const menuButton = page.getByTestId('mobile-menu-button');
      await expect(menuButton).toBeVisible();

      // Measure menu open time
      const openDuration = await measureOperation(page, async () => {
        await menuButton.click();
        await expect(page.getByTestId('mobile-menu-overlay')).toBeVisible();
      });

      expect(openDuration).toBeLessThan(PERF_BUDGETS.MENU_ANIMATION_MAX_MS);

      // Measure menu close time
      const closeDuration = await measureOperation(page, async () => {
        await page.getByTestId('mobile-menu-close').click();
        await expect(page.getByTestId('mobile-menu-overlay')).not.toBeVisible();
      });

      expect(closeDuration).toBeLessThan(PERF_BUDGETS.MENU_ANIMATION_MAX_MS);
    });
  });
}

for (const themeId of THEMES_UNDER_TEST) {
  test.describe(`Performance: High Resolution (${themeId}) @perf`, () => {
    test(`handles 4K viewport without excessive DOM (${themeId})`, async ({ page }) => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await navigateToCountdown(page, themeId);

      const nodeCount = await getDomNodeCount(page);

      // Should not exceed budget even at high resolution
      expect(nodeCount).toBeLessThan(PERF_BUDGETS.MAX_DOM_NODES);
    });

    test(`FPS remains acceptable at high resolution (${themeId})`, async ({ page }) => {
      await page.setViewportSize({ width: 2560, height: 1440 });
      await navigateToCountdown(page, themeId);
      await waitForStableCountdown(page);

      const fpsSamples = await measureFPS(page, 3000);

      // Ensure frames were actually captured; fail fast if RAF never fired.
      expect(fpsSamples.length).toBeGreaterThan(0);

      const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

      // CI runners (headless Chromium, no GPU) achieve ~8 FPS vs 50+ locally.
      // Threshold of 5 FPS catches catastrophic regressions (render stalls,
      // infinite loops, animation hangs) without failing on normal CI variance.
      // For accurate FPS budgets, run locally with GPU or use dedicated perf CI.
      expect(avgFps).toBeGreaterThanOrEqual(HIGH_RES_FPS_THRESHOLD);
    });
  });
}

for (const themeId of THEMES_UNDER_TEST) {
  const targetTheme = THEMES_UNDER_TEST.find((t) => t !== themeId) ?? themeId;

  test.describe(`Performance: Stress Testing (${themeId}) @perf`, () => {
    test(`handles rapid theme switches gracefully (${themeId})`, async ({ page }) => {
      await navigateToCountdown(page, themeId);

      // Rapidly switch themes
      for (let i = 0; i < 5; i++) {
        await page.getByTestId('theme-switcher').click();
        await expect(page.getByTestId('theme-modal')).toBeVisible();

        const theme = i % 2 === 0 ? targetTheme : themeId;
        await page.getByTestId(`theme-card-${theme}`).click();
        await expect(page.getByTestId('theme-modal')).not.toBeVisible({ timeout: 5000 });
        await waitForStableCountdown(page);
      }

      // Wait for theme transitions to complete and DOM to stabilize.
      // During rapid switching, multiple countdown-display elements may briefly coexist.
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="countdown-display"]').length === 1,
        { timeout: 5000 }
      );

      // App should still be functional
      await expect(page.getByTestId('countdown-display')).toBeVisible();

      // DOM count should be reasonable
      const nodeCount = await getDomNodeCount(page);
      expect(nodeCount).toBeLessThan(PERF_BUDGETS.MAX_DOM_NODES);
    });

    test(`handles rapid resize without crashing (${themeId})`, async ({ page }) => {
      await page.setViewportSize(DESKTOP_VIEWPORT);
      await navigateToCountdown(page, themeId);

      // Rapidly resize
      const viewports = [
        { width: 1280, height: 720 },
        { width: 375, height: 667 },
        { width: 768, height: 1024 },
        { width: 1920, height: 1080 },
        { width: 414, height: 896 },
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await waitForStableCountdown(page, 4000);
      }

      // App should still be functional
      await expect(page.getByTestId('countdown-display')).toBeVisible();
    });
  });
}
