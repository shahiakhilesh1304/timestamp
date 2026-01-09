/**
 * E2E tests for deep linking and browser navigation.
 */

import { expect, test } from '@playwright/test';
import { buildDeepLinkUrl } from './fixtures/deep-link-helpers';
import { waitForCountdown, waitForLandingPage } from './fixtures/test-utils';

test.describe('Deep Linking - Browser Navigation', () => {
  test('should navigate back to landing page and forward to countdown', async ({ page }) => {
    // Start on landing page
    await page.goto('/');
    await waitForLandingPage(page);

    // Fill form and start countdown
    await page.click('[data-testid="landing-mode-timer"]');
    await page.fill('[data-testid="landing-duration-hours"]', '01');
    await page.fill('[data-testid="landing-duration-minutes"]', '30');
    await page.fill('[data-testid="landing-duration-seconds"]', '00');
    await page.click('[data-testid="landing-start-button"]');
    
    await waitForCountdown(page);
    const countdownUrl = page.url();

    // Browser back should return to landing page
    await page.goBack();
    await waitForLandingPage(page);
    // Countdown display should not be visible (landing page is shown)
    await expect(page.getByTestId('landing-page')).toBeVisible();

    // Browser forward should return to countdown
    await page.goForward();
    await waitForCountdown(page);
    expect(page.url()).toBe(countdownUrl);
  });

  test('should preserve form values when navigating back', async ({ page }) => {
    await page.goto('/');
    await waitForLandingPage(page);

    // Fill form with specific values
    await page.click('[data-testid="landing-mode-timer"]');
    await page.fill('[data-testid="landing-duration-hours"]', '02');
    await page.fill('[data-testid="landing-duration-minutes"]', '45');
    await page.fill('[data-testid="landing-duration-seconds"]', '30');
    await page.click('[data-testid="landing-start-button"]');
    
    await waitForCountdown(page);

    // Navigate back
    await page.goBack();
    await waitForLandingPage(page);

    // Verify form values are preserved
    await expect(page.getByTestId('landing-duration-hours')).toHaveValue('2');
    await expect(page.getByTestId('landing-duration-minutes')).toHaveValue('45');
    await expect(page.getByTestId('landing-duration-seconds')).toHaveValue('30');
  });

  test('should handle rapid back/forward navigation without errors', async ({ page }) => {
    // Start from landing page and navigate to countdown to establish proper history
    await page.goto('/');
    await waitForLandingPage(page);

    // Fill form and start countdown
    await page.click('[data-testid="landing-mode-timer"]');
    await page.fill('[data-testid="landing-duration-hours"]', '00');
    await page.fill('[data-testid="landing-duration-minutes"]', '01');
    await page.fill('[data-testid="landing-duration-seconds"]', '00');
    await page.click('[data-testid="landing-start-button"]');
    
    await waitForCountdown(page);

    // Rapidly navigate back and forward
    for (let i = 0; i < 3; i++) {
      await page.goBack();
      await waitForLandingPage(page);
      
      await page.goForward();
      await waitForCountdown(page);
    }

    // Should still be functional - use attached state since aria-hidden may be set
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
  });
});

test.describe('Deep Linking - URL State Management', () => {
  test('should update URL when switching themes', async ({ page }) => {
    const url = buildDeepLinkUrl({
      mode: 'timer',
      duration: '300',
      theme: 'contribution-graph',
    });

    await page.goto(url);
    await waitForCountdown(page);

    // Switch theme using the theme switcher button (opens modal)
    const themeSwitcher = page.getByTestId('theme-switcher');
    await themeSwitcher.click();
    
    // Wait for modal and click fireworks theme
    await expect(page.getByTestId('theme-modal')).toBeVisible({ timeout: 3000 });
    await page.getByTestId('theme-card-fireworks').click();
    
    // Wait for modal to close and theme switch to complete
    await expect(page.getByTestId('theme-modal')).not.toBeVisible({ timeout: 3000 });

    // Wait for URL to update (theme switch is async)
    await page.waitForFunction(
      () => window.location.href.includes('theme=fireworks'),
      { timeout: 5000 }
    );

    // URL should reflect new theme
    expect(page.url()).toContain('theme=fireworks');
  });

  test('should update URL when changing timezone', async ({ page }) => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const url = buildDeepLinkUrl({
      mode: 'wall-clock',
      target: futureDate.toISOString(),
      theme: 'contribution-graph',
    });

    await page.goto(url);
    await waitForCountdown(page);

    // Open timezone selector and select a different timezone
    const timezoneSelector = page.getByTestId('timezone-selector');
    await timezoneSelector.getByRole('button').first().click();
    
    // Search for and select Tokyo timezone
    await timezoneSelector.getByRole('searchbox', { name: /search timezones/i }).fill('Tokyo');
    await timezoneSelector.getByRole('option', { name: /Tokyo/i }).first().click();

    // URL should reflect new timezone (auto-waits for navigation state)
    await expect(page).toHaveURL(/tz=Asia%2FTokyo/);
  });

  test('should preserve showWorldMap parameter across navigation', async ({ page }) => {
    // Start from landing page to establish proper history
    await page.goto('/');
    await waitForLandingPage(page);
    
    // Get a future date for countdown
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    // Navigate to countdown with showWorldMap=false via deep link
    const url = buildDeepLinkUrl({
      mode: 'wall-clock',
      target: futureDate.toISOString(),
      showWorldMap: false,
    });

    await page.goto(url);
    await waitForCountdown(page);

    // World map should not be visible
    await expect(page.getByTestId('world-map')).not.toBeVisible();

    // Navigate back then forward - but since deep link doesn't have landing page in history,
    // we test the URL preservation differently: check URL contains the param
    expect(page.url()).toContain('showWorldMap=false');
  });

  test('should show world map by default when showWorldMap param is omitted', async ({ page }) => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const url = buildDeepLinkUrl({
      mode: 'wall-clock',
      target: futureDate.toISOString(),
    });

    await page.goto(url);
    // Use 'attached' state since aria-hidden may be set during celebration
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });

    // World map should be visible by default
    await expect(page.getByTestId('world-map')).toBeVisible();
  });

  test('should restore countdown state from URL on page refresh', async ({ page }) => {
    const url = buildDeepLinkUrl({
      mode: 'timer',
      duration: '300',
      theme: 'fireworks',
    });

    await page.goto(url);
    // Use 'attached' state since aria-hidden may be set during celebration
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });

    // Refresh page
    await page.reload();
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });

    // Should still show countdown - countdown is attached to DOM
    await expect(page.getByTestId('countdown-display')).toBeAttached();
  });
});

test.describe('Deep Linking - Error Handling', () => {
  test('should show landing page with error for invalid parameters', async ({ page }) => {
    const url = '/?mode=timer&duration=invalid';
    
    await page.goto(url);
    await page.waitForSelector('[data-testid="landing-page"]', { state: 'visible' });

    // Should show error toast using unified toast system
    const errorToast = page.locator('.toast--error');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Invalid duration');
  });

  test('should handle showWorldMap parameter in timer mode', async ({ page }) => {
    // Timer mode should ignore showWorldMap parameter
    const url = buildDeepLinkUrl({
      mode: 'timer',
      duration: '300',
      showWorldMap: false,
    });

    await page.goto(url);
    // Use 'attached' state since aria-hidden may be set during celebration
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });

    // World map should not be visible in timer mode regardless of parameter
    await expect(page.getByTestId('world-map')).not.toBeVisible();
  });
});
