/**
 * Timer Controls E2E Tests
 * Tests for play/pause toggle and reset button functionality in timer mode.
 * 
 * Note: Controls are only visible in timer mode (not wall-clock or absolute).
 */
import { expect, test } from '@playwright/test';
import { waitForCountdown } from './fixtures/test-utils';

test.describe('Timer Controls', () => {
  test.describe('Mode-specific visibility', () => {
    const modeVisibilityCases = [
      {
        mode: 'timer',
        query: '/?mode=timer&duration=60',
        expectation: 'show',
        expectedVisible: true,
      },
      {
        mode: 'wall-clock',
        query: '/?mode=wall-clock&target=2099-01-01T00:00:00',
        expectation: 'hide',
        expectedVisible: false,
      },
      {
        mode: 'absolute',
        query: '/?mode=absolute&target=2099-01-01T00:00:00Z',
        expectation: 'hide',
        expectedVisible: false,
      },
    ] as const;

    for (const { mode, query, expectedVisible, expectation } of modeVisibilityCases) {
      test(`should ${expectation} timer controls in ${mode} mode`, async ({ page }) => {
        await page.goto(query);
        await waitForCountdown(page);

        const timerControls = page.locator('[data-testid="timer-controls"]');
        const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
        const resetButton = page.locator('[data-testid="timer-reset"]');

        if (expectedVisible) {
          await expect(timerControls).toBeVisible();
          await expect(playPauseButton).toBeVisible();
          await expect(resetButton).toBeVisible();
        } else {
          await expect(timerControls).toHaveCount(0);
        }
      });
    }
  });

  test.describe('Keyboard navigation', () => {
    test('should have correct tab order (play/pause → reset)', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      // Find the timer controls
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      const resetButton = page.locator('[data-testid="timer-reset"]');
      
      // Focus play/pause button
      await playPauseButton.focus();
      await expect(playPauseButton).toBeFocused();
      
      // Tab to reset button
      await page.keyboard.press('Tab');
      await expect(resetButton).toBeFocused();
    });

    const activationKeys = ['Enter', 'Space'] as const;

    for (const key of activationKeys) {
      test(`should activate play/pause with ${key} key`, async ({ page }) => {
        await page.goto('/?mode=timer&duration=60');
        await waitForCountdown(page);

        const playPauseButton = page.locator('[data-testid="timer-play-pause"]');

        await expect(playPauseButton).toHaveAttribute('aria-pressed', 'false');

        await playPauseButton.focus();
        await page.keyboard.press(key);

        await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
      });
    }
  });

  test.describe('Accessibility', () => {
    test('should have aria-pressed on play/pause button', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      
      // Should have aria-pressed attribute
      await expect(playPauseButton).toHaveAttribute('aria-pressed');
    });

    test('should update aria-label on toggle', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      
      // Initial label should be "Pause timer"
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
      
      // Click to pause
      await playPauseButton.click();
      
      // Label should now be "Resume timer"
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');
    });

    test('should have aria-label on reset button', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const resetButton = page.locator('[data-testid="timer-reset"]');
      
      await expect(resetButton).toHaveAttribute('aria-label', 'Reset timer to original duration');
    });

    test('should have aria-live region for announcements', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const liveRegion = page.locator('[data-testid="timer-controls"] [aria-live]');
      
      await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
      await expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
    });

    test('should hide icons from screen readers', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const icons = page.locator('[data-testid="timer-controls"] svg');
      
      const iconCount = await icons.count();
      expect(iconCount).toBeGreaterThan(0);
      
      // All icons should have aria-hidden="true"
      for (let i = 0; i < iconCount; i++) {
        await expect(icons.nth(i)).toHaveAttribute('aria-hidden', 'true');
      }
    });
  });

  test.describe('Play/pause functionality', () => {
    test('should toggle button state on click', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      
      // Initially playing (not paused)
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'false');
      
      // Click to pause
      await playPauseButton.click();
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
      
      // Click to resume
      await playPauseButton.click();
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'false');
    });

    test('should actually pause the countdown (time stops changing)', async ({ page }) => {
      // Use longer duration so we can observe seconds changing
      await page.goto('/?mode=timer&duration=300');
      await waitForCountdown(page);
      
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      
      // Helper to extract seconds from the page (theme-specific, but contribution-graph has digit elements)
      const getSecondsValue = async () => {
        // Wait a moment for any pending updates
        await page.waitForTimeout(100);
        // Get the aria-label which contains the time in a readable format
        const label = await page.locator('[data-testid="theme-container"]').getAttribute('aria-label');
        return label;
      };
      
      // Get initial state
      const initialLabel = await getSecondsValue();
      
      // Pause the timer
      await playPauseButton.click();
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
      
      // Wait 3 seconds - timer should NOT change
      await page.waitForTimeout(3000);
      
      // Get state after waiting while paused
      const labelAfterPause = await getSecondsValue();
      
      // Labels should be identical (timer didn't tick)
      expect(labelAfterPause).toBe(initialLabel);
    });
  });

  test.describe('Reset functionality', () => {
    test('should preserve paused state on reset', async ({ page }) => {
      await page.goto('/?mode=timer&duration=60');
      await waitForCountdown(page);
      
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      const resetButton = page.locator('[data-testid="timer-reset"]');
      
      // Pause the timer
      await playPauseButton.click();
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
      
      // Reset
      await resetButton.click();
      
      // Should still be paused
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
    });

    test('should reset countdown to original duration with immediate visual feedback', async ({ page }) => {
      // Use 5 minute duration 
      await page.goto('/?mode=timer&duration=300');
      await waitForCountdown(page);
      
      const resetButton = page.locator('[data-testid="timer-reset"]');
      const playPauseButton = page.locator('[data-testid="timer-play-pause"]');
      const container = page.locator('[data-testid="theme-container"]');
      
      // Wait 5 seconds to let timer tick
      await page.waitForTimeout(5000);
      
      // Pause first so we have a stable baseline
      await playPauseButton.click();
      await expect(playPauseButton).toHaveAttribute('aria-pressed', 'true');
      
      const labelBeforeReset = await container.getAttribute('aria-label');
      
      // Reset the timer (while paused)
      await resetButton.click();
      
      // Wait for reset to take effect
      await page.waitForTimeout(500);
      
      // Label should have changed (reset to higher value)
      const labelAfterReset = await container.getAttribute('aria-label');
      expect(labelAfterReset).not.toBe(labelBeforeReset);
      
      // The reset label should contain "5 minutes" or "4 minutes" 
      // (fresh reset should be close to original duration)
      expect(labelAfterReset).toMatch(/5 minutes|4 minutes/);
    });
  });

  test.describe('Reset during/after celebration', () => {
    test('should clear celebration UI when reset during celebration', async ({ page }) => {
      await page.goto('/?mode=timer&duration=2&theme=contribution-graph');
      await waitForCountdown(page);

      await page.locator('[data-celebrating="true"]').waitFor({ timeout: 5000 });

      const container = page.getByTestId('theme-container');

      await page.getByTestId('timer-reset').click();

      await expect(container).not.toHaveAttribute('data-celebrating', 'true');

      const label = await container.getAttribute('aria-label');
      expect(label ?? '').toMatch(/less than 1 minute|seconds/i);
    });

    test('should reset from celebrated state and resume counting', async ({ page }) => {
      await page.goto('/?mode=timer&duration=2&theme=contribution-graph');
      await waitForCountdown(page);

      await page.locator('[data-celebrating="true"]').waitFor({ timeout: 5000 });
      await page.waitForTimeout(1200);

      const container = page.getByTestId('theme-container');
      const labelBeforeReset = await container.getAttribute('aria-label');

      await page.getByTestId('timer-reset').click();

      await expect(container).not.toHaveAttribute('data-celebrating', 'true');

      const labelAfterReset = await container.getAttribute('aria-label');
      expect(labelAfterReset).not.toBe(labelBeforeReset);

      await page.locator('[data-celebrating="true"]').waitFor({ timeout: 5000 });
    });

    test('should restore theme animations after reset', async ({ page }) => {
      await page.goto('/?mode=timer&duration=2&theme=fireworks');
      await waitForCountdown(page);

      const celebrationMessage = page.locator('.celebration-message');
      await expect(celebrationMessage).toBeVisible({ timeout: 5000 });

      await page.getByTestId('timer-reset').click();

      await expect(celebrationMessage).toBeHidden({ timeout: 3000 });
      await expect(page.locator('.countdown-display')).toBeVisible();

      const label = await page.getByTestId('theme-container').getAttribute('aria-label');
      expect(label ?? '').toMatch(/less than 1 minute|seconds/i);
    });

    // SKIP: Canvas-based renderer doesn't have DOM squares to count
  // This test was designed for DOM-based rendering with individual square elements
  test.skip('should stop background animation runaway after reset from celebration', async ({ page }) => {
      // This test ensures that resetting from celebration stops runaway activity loops
      // that could consume resources and cause high CPU usage
      await page.goto('/?mode=timer&duration=2&theme=contribution-graph');
      await waitForCountdown(page);

      await page.locator('[data-celebrating="true"]').waitFor({ timeout: 5000 });

      await page.getByTestId('timer-reset').click();
      await page.waitForTimeout(1000);

      // After reset, activity should be calm (not ramping up as if celebration was active)
      const totalSquares = await page.locator('.contribution-graph-square').count();
      const activeSquares = await page.locator('.contribution-graph-square:not(.intensity-0)').count();

      // Less than 50% should be active - this would be much higher if runaway occurred
      // Guard against division by zero if no squares found
      expect(totalSquares).toBeGreaterThan(0);
      expect(activeSquares / totalSquares).toBeLessThan(0.5);
    });
  });
});
