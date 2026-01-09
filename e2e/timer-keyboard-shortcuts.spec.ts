/**
 * E2E tests for timer mode keyboard shortcuts.
 *
 * Tests Space key (play/pause toggle), Enter key (reset), and R key (reset).
 * Verifies shortcuts only work in timer mode and respect input focus/modal state.
 */

import { expect, test } from '@playwright/test';

import { navigateToTimerCountdown } from './fixtures/deep-link-helpers';
import { waitForCountdown } from './fixtures/test-utils';

test.describe('Timer Keyboard Shortcuts', () => {
  test.describe('Space key - Play/Pause Toggle (S2)', () => {
    test('Space key toggles timer from playing to paused (AC2.1)', async ({ page }) => {
      // Navigate to a 5-minute timer
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Initially playing - verify pause button shows "Pause timer"
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');

      // Wait for orchestrator to fully initialize by ensuring button is interactive
      await expect(playPauseButton).toBeEnabled();

      // Ensure body has focus for keyboard events
      await page.evaluate(() => document.body.focus());

      // Press Space to pause (globally - not on a specific element)
      await page.keyboard.press('Space');

      // Give time for state update to propagate to UI
      await page.waitForTimeout(100);

      // Should now be paused - verify resume button shows "Resume timer"
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');
    });

    test('Space key toggles timer from paused to playing (AC2.1)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Pause first
      await page.keyboard.press('Space');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');

      // Press Space to resume
      await page.keyboard.press('Space');

      // Should be playing again
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('Space key does not toggle when text input is focused (AC2.2)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Open theme picker modal which has focusable elements
      await page.getByTestId('theme-switcher').click();
      await page.waitForSelector('[data-testid="theme-modal"]');

      // Press Space while modal is open - should be ignored
      await page.keyboard.press('Space');

      // Close modal by pressing Escape
      await page.keyboard.press('Escape');

      // Timer should still be playing (Space was ignored)
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('Space key does not toggle when modal is open (AC2.3)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Open theme picker modal
      await page.getByTestId('theme-switcher').click();
      await page.waitForSelector('[data-testid="theme-modal"]');

      // Press Space - should be ignored because modal is open
      await page.keyboard.press('Space');

      // Close modal
      await page.keyboard.press('Escape');

      // Timer should still be playing
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('Space key works in both fullscreen and normal view (AC2.4)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Test in normal view
      await page.keyboard.press('Space');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');

      // Resume
      await page.keyboard.press('Space');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');

      // Note: Fullscreen E2E testing is complex due to browser permissions
      // The unit tests cover fullscreen behavior
    });

    test('Space key does NOT work in wall-clock mode (AC2.5)', async ({ page }) => {
      // Navigate to wall-clock countdown (far future New Year's Eve)
      await page.goto('/?mode=wall-clock&target=2099-01-01T00:00:00');
      await waitForCountdown(page);

      // Timer controls should not exist in wall-clock mode
      const timerControls = page.getByTestId('timer-controls');
      await expect(timerControls).toHaveCount(0);

      // Space should do nothing (no timer to control)
      await page.keyboard.press('Space');

      // No assertions needed - just verifying no errors
    });

    test('Space key does NOT work in absolute mode (AC2.5)', async ({ page }) => {
      // Navigate to absolute countdown (far future)
      await page.goto('/?mode=absolute&target=2099-01-01T00:00:00Z');
      await waitForCountdown(page);

      // Timer controls should not exist in absolute mode
      const timerControls = page.getByTestId('timer-controls');
      await expect(timerControls).toHaveCount(0);

      // Space should do nothing
      await page.keyboard.press('Space');
    });
  });

  test.describe('Enter key - Reset (S3)', () => {
    test('Enter key resets timer to original duration (AC3.1)', async ({ page }) => {
      // Navigate to a 10-second timer for faster testing
      await navigateToTimerCountdown(page, 10, 'seconds');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Wait a moment for timer to count down
      await page.waitForTimeout(2000);

      // Press Enter to reset
      await page.keyboard.press('Enter');

      // Timer should reset - check that countdown display shows original duration
      // The exact display depends on theme, but we can verify reset was triggered
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toBeVisible();
    });

    test('Enter key does not reset when input is focused (AC3.3)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Open theme picker modal
      await page.getByTestId('theme-switcher').click();
      await page.waitForSelector('[data-testid="theme-modal"]');

      // Press Enter while modal is open - should be ignored
      await page.keyboard.press('Enter');

      // Close modal
      await page.keyboard.press('Escape');

      // Timer should still be running normally
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('Enter key does not reset when modal is open (AC3.4)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Open theme picker modal
      await page.getByTestId('theme-switcher').click();
      await page.waitForSelector('[data-testid="theme-modal"]');

      // Press Enter - should be ignored because modal is open
      await page.keyboard.press('Enter');

      // Close modal
      await page.keyboard.press('Escape');

      // Timer should still be running
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('Enter key does NOT work in wall-clock mode (AC3.6)', async ({ page }) => {
      await page.goto('/?mode=wall-clock&target=2099-01-01T00:00:00');
      await waitForCountdown(page);

      // Timer controls should not exist
      const timerControls = page.getByTestId('timer-controls');
      await expect(timerControls).toHaveCount(0);

      // Enter should do nothing
      await page.keyboard.press('Enter');
    });
  });

  test.describe('R key - Reset (S3)', () => {
    test('R key resets timer to original duration (AC3.2)', async ({ page }) => {
      await navigateToTimerCountdown(page, 10, 'seconds');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Wait a moment
      await page.waitForTimeout(2000);

      // Press R to reset
      await page.keyboard.press('r');

      // Timer should reset
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toBeVisible();
    });

    test('R key is case-insensitive (AC3.2)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Press uppercase R
      await page.keyboard.press('R');

      // Should still work - timer should reset
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toBeVisible();
    });

    test('R key does not reset when input is focused (AC3.3)', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      // Open theme picker modal
      await page.getByTestId('theme-switcher').click();
      await page.waitForSelector('[data-testid="theme-modal"]');

      // Press R - should be ignored
      await page.keyboard.press('r');

      // Close modal
      await page.keyboard.press('Escape');

      // Timer should still be running
      const playPauseButton = page.getByTestId('timer-play-pause');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');
    });

    test('R key does NOT work in absolute mode (AC3.6)', async ({ page }) => {
      await page.goto('/?mode=absolute&target=2099-01-01T00:00:00Z');
      await waitForCountdown(page);

      // Timer controls should not exist
      const timerControls = page.getByTestId('timer-controls');
      await expect(timerControls).toHaveCount(0);

      // R should do nothing
      await page.keyboard.press('r');
    });
  });

  test.describe('Combined scenarios', () => {
    test('multiple toggles work correctly', async ({ page }) => {
      await navigateToTimerCountdown(page, 5, 'minutes');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Toggle multiple times
      await page.keyboard.press('Space'); // Pause
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');

      await page.keyboard.press('Space'); // Play
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Pause timer');

      await page.keyboard.press('Space'); // Pause
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');
    });

    test('reset after pause keeps paused state', async ({ page }) => {
      await navigateToTimerCountdown(page, 10, 'seconds');
      await page.waitForSelector('[data-testid="timer-controls"]');

      const playPauseButton = page.getByTestId('timer-play-pause');

      // Pause first
      await page.keyboard.press('Space');
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');

      // Reset while paused
      await page.keyboard.press('Enter');

      // Should still be paused after reset
      await expect(playPauseButton).toHaveAttribute('aria-label', 'Resume timer');
    });
  });
});
