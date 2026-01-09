import { expect, test, type Page } from '@playwright/test';

const waitForLanding = async (page: Page) => {
  await expect(page.getByTestId('landing-page')).toBeVisible();
  // Wait for background to render (async theme loading)
  // Landing page uses same squares as countdown theme
  await page.waitForSelector('.contribution-graph-square, .star', { timeout: 5000 });
};

test.describe('Landing Page', () => {
  test('should load landing page by default', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);
    await expect(page.getByTestId('landing-mode-wall-clock')).toBeChecked();
  });

  test('should configure timer mode and start countdown', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    await page.getByTestId('landing-mode-timer').check();
    // Use 10 seconds instead of 2 to prevent celebration before visibility check
    await page.getByTestId('landing-duration-seconds').fill('10');
    await page.getByTestId('landing-start-button').click();

    await expect(page.getByTestId('landing-page')).toBeHidden();
    // Use waitForSelector with attached state since aria-hidden may be set during celebration
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
  });

  test('should start countdown immediately when using deep link skip', async ({ page }) => {
    // Use 10 seconds instead of 2 to prevent celebration before visibility check
    await page.goto('/?mode=timer&duration=10&skip=true');
    await expect(page.getByTestId('landing-page')).toBeHidden();
    // Use waitForSelector with attached state since aria-hidden may be set during celebration
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
  });

  test('should fall back to landing page with error when deep link is invalid', async ({ page }) => {
    await page.goto('/?mode=timer&duration=invalid&skip=true');
    await expect(page.getByTestId('landing-page')).toBeVisible();
    // Error toast uses the unified toast system
    await expect(page.locator('.toast--error')).toBeVisible();
  });

  test('should display header inside landing card for proper text contrast', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Header should be inside the card, not floating outside
    const header = page.getByTestId('landing-card').getByTestId('landing-header');
    await expect(header).toBeVisible();

    // Title should be readable
    const title = page.getByRole('heading', { name: 'Timestamp' });
    await expect(title).toBeVisible();
  });

  test('should clean up previous background when switching themes', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

      const background = page.getByTestId('landing-theme-background');
      await expect(background).toHaveAttribute('data-theme-id', 'contribution-graph');
    const contributionSquares = await page.locator('.contribution-graph-square').count();
    expect(contributionSquares).toBeGreaterThan(0);

    // Wait for theme card to be visible and scroll into view if needed
    const fireworksCard = page.getByTestId('theme-card-fireworks');
    await expect(fireworksCard).toBeVisible({ timeout: 5000 });
    await fireworksCard.scrollIntoViewIfNeeded();
    await fireworksCard.click();

    // Wait for theme background to update (async theme loading)
      await expect(background).toHaveAttribute('data-theme-id', 'fireworks');
    
    // Wait for stars to render
    await page.waitForSelector('.landing-star', { timeout: 5000, state: 'attached' });

    // GitHub squares should be cleaned up
    const contributionSquaresAfter = await page.locator('.contribution-graph-square').count();
    expect(contributionSquaresAfter).toBe(0);

    // Fireworks stars should be visible
    const stars = await page.locator('.landing-star').count();
    expect(stars).toBe(30);
  });

  test('should show error when timer mode has no duration values', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Switch to timer mode
    await page.getByTestId('landing-mode-timer').check();

    // Don't fill any duration fields - leave them empty
    // Click start button
    await page.getByTestId('landing-start-button').click();

    // Should show error toast (unified toast system with toast-{id} format)
    const errorToast = page.locator('[data-testid="toast-landing-error-toast"]');
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText('Duration required');

    // Should show inline error
    const durationError = page.locator('#landing-duration-error');
    await expect(durationError).toBeVisible();
    await expect(durationError).toContainText('at least one value');

    // Should not have started countdown
    await expect(page.getByTestId('landing-page')).toBeVisible();
  });

  test('should accept timer with only one field filled', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Switch to timer mode
    await page.getByTestId('landing-mode-timer').check();

    // Fill only seconds field
    await page.getByTestId('landing-duration-seconds').fill('10');

    // Click start button
    await page.getByTestId('landing-start-button').click();

    // Should start countdown
    await expect(page.getByTestId('landing-page')).toBeHidden();
    await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
  });
});

test.describe('Theme Author Links', () => {
  /**
   * E2E Focus: Test the user flow of clicking author links.
   * Unit tests (theme-selector.test.ts) cover aria/href/target details.
   */
  test('should not select theme when clicking author link', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // First, switch to fireworks theme so contribution-graph is not selected
    // Click on card name to avoid author link
    const fireworksCardName = page.locator('.theme-selector-card-name', { hasText: 'Fireworks' });
    await fireworksCardName.click();
    
    // Wait for fireworks background to render (async theme loading)
      const background = page.getByTestId('landing-theme-background');
      await expect(background).toHaveAttribute('data-theme-id', 'fireworks');
    await page.waitForSelector('.landing-star', { timeout: 5000, state: 'attached' });

    // Verify fireworks is selected (fireworks background should be visible)
      await expect(background).toHaveAttribute('data-theme-id', 'fireworks');

    // Click the author link for contribution-graph
    const authorLink = page.getByTestId('theme-author-contribution-graph');

    // We need to intercept the navigation to prevent actually leaving the page
    await page.evaluate(() => {
      document.querySelector('[data-testid="theme-author-contribution-graph"]')?.addEventListener(
        'click',
        (e) => e.preventDefault(),
        { once: true }
      );
    });

    await authorLink.click();

    // Theme should NOT have switched - fireworks background should still be visible
      await expect(background).toHaveAttribute('data-theme-id', 'fireworks');
    // Contribution graph background should NOT be visible
      await expect(background).not.toHaveAttribute('data-theme-id', 'contribution-graph');
  });

  test('should be keyboard accessible via shortcut key', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    const authorLink = page.getByTestId('theme-author-contribution-graph');
    // Grid pattern: focus the gridcell (first cell of the row)
    const gridcell = page.locator('[data-theme-id="contribution-graph"] > [role="gridcell"]:first-child');

    // Per roving tabindex pattern, nested interactive elements should
    // have tabindex="-1" and be accessible via keyboard shortcuts
    await expect(authorLink).toHaveAttribute('tabindex', '-1');

    // Focus the gridcell first (the main focusable element in the row)
    await gridcell.focus();

    // Press 'a' to activate the author link (per keyboard-nav.ts shortcut)
    // This should click the link - we can verify by checking page opened
    const [newPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.keyboard.press('a')
    ]);

    // The author profile page should open in a new tab
    await expect(newPage).toHaveURL(/github\.com\/chrisreddington/);
    await newPage.close();
  });
});

test.describe('Landing Page - Help & FAQ Tab', () => {
  test('should switch to Help tab and show help content', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Find and click the Help tab
    const helpTab = page.getByRole('tab', { name: 'Help & FAQ' });
    await expect(helpTab).toBeVisible();
    await helpTab.click();

    // Help content should be visible
    const helpContent = page.getByTestId('help-content');
    await expect(helpContent).toBeVisible();

    // Create form should be hidden
    const formContent = page.locator('.landing-form-content');
    await expect(formContent).not.toBeVisible();
  });

  test('should switch back to Create tab', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Switch to Help tab first
    await page.getByRole('tab', { name: 'Help & FAQ' }).click();
    await expect(page.getByTestId('help-content')).toBeVisible();

    // Switch back to Create tab
    const createTab = page.getByRole('tab', { name: 'Create Countdown' });
    await createTab.click();

    // Form should be visible again
    await expect(page.locator('.landing-form-content')).toBeVisible();
    await expect(page.getByTestId('help-content')).not.toBeVisible();
  });

  test('should display all help sections', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    await page.getByRole('tab', { name: 'Help & FAQ' }).click();

    // Check all section headings are present
    await expect(page.getByRole('heading', { name: 'About Timestamp' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Countdown Modes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Features' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
  });

  test('should display keyboard shortcuts table', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    await page.getByRole('tab', { name: 'Help & FAQ' }).click();

    // Shortcuts tables should be present (multiple tables for different groups)
    const tables = page.locator('.help-shortcuts-table');
    await expect(tables.first()).toBeVisible();
    await expect(tables.first().locator('kbd').first()).toBeVisible();

    // Check for group titles (use heading role for specificity)
    await expect(page.getByRole('heading', { name: 'All Modes', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Timer Mode Only', level: 4 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Theme Selector', level: 4 })).toBeVisible();

    // Check for shortcuts from each group
    // Note: Both F keys now use uppercase in help content (case-insensitive in actual shortcuts)
    await expect(page.locator('kbd', { hasText: 'Space' })).toBeVisible(); // Timer only
    await expect(page.locator('kbd', { hasText: 'Enter' })).toBeVisible(); // Timer only
    await expect(page.locator('kbd', { hasText: 'Escape' })).toBeVisible(); // All modes

    // Check action descriptions (use role=cell to avoid FAQ content matches)
    const shortcutsSection = page.locator('[aria-labelledby="help-shortcuts-title"]');
    await expect(shortcutsSection.getByRole('cell', { name: 'Toggle fullscreen' })).toBeVisible();
    await expect(shortcutsSection.getByRole('cell', { name: 'Play/Pause toggle' })).toBeVisible();
  });

  test('should display FAQ questions and answers', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    await page.getByRole('tab', { name: 'Help & FAQ' }).click();

    // FAQ list should be present
    const faqList = page.locator('.help-faq-list');
    await expect(faqList).toBeVisible();

    // Check a specific FAQ question
    await expect(page.getByText("Why don't keyboard shortcuts work on mobile?")).toBeVisible();
  });

  test('should navigate tabs with keyboard', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Focus the first tab
    const createTab = page.getByRole('tab', { name: 'Create Countdown' });
    await createTab.focus();
    await expect(createTab).toBeFocused();

    // Arrow right to move to Help tab
    await page.keyboard.press('ArrowRight');
    const helpTab = page.getByRole('tab', { name: 'Help & FAQ' });
    await expect(helpTab).toBeFocused();

    // Press Enter to activate
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('help-content')).toBeVisible();
  });

  test('should have proper ARIA attributes on tabs', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    const createTab = page.getByRole('tab', { name: 'Create Countdown' });
    const helpTab = page.getByRole('tab', { name: 'Help & FAQ' });

    // Create tab should be selected by default
    await expect(createTab).toHaveAttribute('aria-selected', 'true');
    await expect(helpTab).toHaveAttribute('aria-selected', 'false');

    // Switch to Help tab
    await helpTab.click();

    // ARIA states should update
    await expect(createTab).toHaveAttribute('aria-selected', 'false');
    await expect(helpTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should preserve form state when switching tabs', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    // Fill in some form data
    await page.getByTestId('landing-mode-timer').check();
    await page.getByTestId('landing-duration-minutes').fill('5');

    // Switch to Help tab and back
    await page.getByRole('tab', { name: 'Help & FAQ' }).click();
    await expect(page.getByTestId('help-content')).toBeVisible();

    await page.getByRole('tab', { name: 'Create Countdown' }).click();

    // Form data should be preserved
    await expect(page.getByTestId('landing-mode-timer')).toBeChecked();
    await expect(page.getByTestId('landing-duration-minutes')).toHaveValue('5');
  });
});
