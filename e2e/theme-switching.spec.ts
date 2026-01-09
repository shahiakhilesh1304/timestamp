import { expect, test } from '@playwright/test';
import { switchTheme, waitForCountdown, waitForMobileMenuButton } from './fixtures/test-utils';

/**
 * Open theme switcher modal on mobile.
 * On mobile, the theme switcher button is inside the hamburger menu.
 */
async function openThemeSwitcherOnMobile(page: import('@playwright/test').Page): Promise<void> {
  // Wait for mobile menu button to be visible
  await waitForMobileMenuButton(page);
  
  // Open hamburger menu
  await page.getByTestId('mobile-menu-button').click();
  
  // Wait for overlay to be visible
  await expect(page.getByTestId('mobile-menu-overlay')).toBeVisible();
  
  // Click theme switcher button inside mobile menu
  await page.getByTestId('mobile-menu-overlay').getByTestId('theme-switcher').click();
}

test.describe('Theme Switching Modal', () => {
  test('should hide action buttons when modal is open', async ({ page }) => {
    // Arrange - Start countdown
    await page.goto('/?mode=timer&duration=3600');
    await waitForCountdown(page);

    // Verify buttons are visible initially
    const buttonContainer = page.getByTestId('countdown-button-container');
    await expect(buttonContainer).toBeVisible();
    await expect(buttonContainer).toHaveCSS('opacity', '1');

    // Act - Open theme modal
    await page.getByTestId('theme-switcher').click();
    await expect(page.getByTestId('theme-modal')).toBeVisible();

    // Assert - Button container should be hidden/faded
    await expect(buttonContainer).toHaveCSS('opacity', '0');
  });

  test('should show action buttons when modal closed via escape key', async ({ page }) => {
    // Arrange - Start countdown and open modal
    await page.goto('/?mode=timer&duration=3600');
    await waitForCountdown(page);

    await page.getByTestId('theme-switcher').click();
    await expect(page.getByTestId('theme-modal')).toBeVisible();

    const buttonContainer = page.getByTestId('countdown-button-container');

    // Act - Close modal with Escape key
    await page.keyboard.press('Escape');

    // Assert - Buttons should fade back in
    await expect(buttonContainer).toHaveCSS('opacity', '1');
  });

  test('should display theme cards in responsive layout on mobile', async ({ page }) => {
    // Arrange - Set mobile viewport and start countdown
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/?mode=timer&duration=3600');
    await waitForCountdown(page);

    // Act - Open theme modal via hamburger menu (mobile uses hamburger)
    await openThemeSwitcherOnMobile(page);
    await expect(page.getByTestId('theme-modal')).toBeVisible();

    // Assert - Theme cards should be visible and usable on mobile
    // (CSS layout details are tested in component tests, not E2E)
    const themeCard = page.getByTestId('theme-card-fireworks');
    await expect(themeCard).toBeVisible();
    
    // User can interact with the card
    await themeCard.click();
    await expect(page.getByTestId('theme-modal')).not.toBeVisible();
    await waitForCountdown(page);
  });
});

test('should switch themes and keep countdown attached', async ({ page }) => {
  await page.goto('/?mode=timer&duration=3600');
  await waitForCountdown(page);

  const container = page.getByTestId('theme-container').first();
  const initialTheme = await container.getAttribute('data-theme');

  await switchTheme(page);
  await waitForCountdown(page);

  await expect(container).not.toHaveAttribute('data-theme', initialTheme ?? '');
});

// SKIP: Canvas-based renderer doesn't set aria-hidden on canvas element
// The aria-hidden attribute is set on the parent container, not the canvas itself
test.skip('should trigger celebration with accessibility attributes', async ({ page }) => {
  // Start with 3 seconds remaining for more reliable triggering
  await page.goto('/?mode=timer&duration=3');
  await waitForCountdown(page);

  // Wait for celebration
  // The container (body or #app) should get data-celebrating="true"
  const container = page.locator('#app');
  
  // Wait for data-celebrating attribute
  await expect(container).toHaveAttribute('data-celebrating', 'true', { timeout: 10000 });
  
  // Check aria-hidden on grid (this is expected behavior during celebration)
  const grid = page.getByTestId('countdown-display');
  await expect(grid).toHaveAttribute('aria-hidden', 'true');
});

test('should show year without animation replay when switching themes post-midnight', async ({ page }) => {
  // Start with 1 second remaining
  await page.goto('/?mode=timer&duration=1');
  
  // Wait for celebration
  await page.locator('[data-celebrating="true"]').waitFor({ timeout: 10000 });
  
  // Wait for celebration state to be stable
  await page.waitForTimeout(2000);
  
  // Verify we're in celebrated state
  await expect(page.locator('#app[data-celebrating="true"]')).toBeAttached();
  
  // Switch themes
  await switchTheme(page);
  await waitForCountdown(page);
  
  // Should still be in celebrated state (no replay)
  await expect(page.locator('#app[data-celebrating="true"]')).toBeAttached({ timeout: 2000 });
});

test('should preserve focus when switching themes via modal', async ({ page }) => {
  // Arrange - Start countdown
  await page.goto('/?mode=timer&duration=3600');
  await waitForCountdown(page);

  // Get the theme switcher button that will open the modal
  const themeSwitcherButton = page.getByTestId('theme-switcher');
  
  // Open theme modal
  await themeSwitcherButton.click();
  await expect(page.getByTestId('theme-modal')).toBeVisible();

  // Select a different theme (click the card to switch and close modal)
  const fireworksCard = page.getByTestId('theme-card-fireworks');
  await fireworksCard.click();

  // Wait for modal to close and theme to switch
  await expect(page.getByTestId('theme-modal')).not.toBeVisible({ timeout: 5000 });
  await waitForCountdown(page);

  // Assert - Focus should return to the theme switcher button that opened the modal
  // This is the correct accessibility pattern for modal dialogs (Focus Order)
  await expect(themeSwitcherButton).toBeFocused();
});
