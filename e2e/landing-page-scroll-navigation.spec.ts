import { expect, test, type Page } from '@playwright/test';

const waitForLanding = async (page: Page) => {
  await expect(page.getByTestId('landing-page')).toBeVisible();
  // Wait for background to render (async theme loading)
  // Canvas-based themes use canvas, DOM-based themes use children
  await page.waitForFunction(() => {
    const bg = document.querySelector('[data-testid="landing-theme-background"]');
    if (!bg) return false;
    return bg.querySelector('canvas') !== null || bg.children.length > 0;
  }, { timeout: 5000 });
};

const startTimerCountdown = async (page: Page, seconds = 5) => {
  await page.getByTestId('landing-mode-timer').check();
  await page.getByTestId('landing-duration-seconds').fill(String(seconds));
  await page.getByTestId('landing-start-button').click();
  await expect(page.getByTestId('landing-page')).toBeHidden();
  await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
};

const startWallClockCountdown = async (page: Page) => {
  // Wall-clock mode is default, just start
  await page.getByTestId('landing-start-button').click();
  await expect(page.getByTestId('landing-page')).toBeHidden();
  await page.waitForSelector('[data-testid="countdown-display"]', { state: 'attached' });
};

test.describe('Landing Page Scroll After Navigation', () => {
  test('should be scrollable when returning from countdown via back button', async ({ page }) => {
    // Use mobile viewport where landing page definitely needs scrolling
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForLanding(page);

    // Debug: log initial overflow state
    const initialOverflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflow,
      body: getComputedStyle(document.body).overflow,
      landingPage: getComputedStyle(document.querySelector('[data-testid="landing-page"]')!).overflowY,
    }));
    console.log('Initial overflow:', initialOverflow);

    // Verify initial scrollability - scroll to footer
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();

    // Start a timer countdown
    await startTimerCountdown(page);

    // Go back to landing page via browser back button
    await page.goBack();
    await waitForLanding(page);

    // Check that document body is scrollable
    const documentOverflow = await page.evaluate(() => {
      return {
        html: getComputedStyle(document.documentElement).overflow,
        body: getComputedStyle(document.body).overflow,
        htmlInline: document.documentElement.style.overflow,
        bodyInline: document.body.style.overflow,
        landingPage: getComputedStyle(document.querySelector('[data-testid="landing-page"]')!).overflowY,
      };
    });
    console.log('After navigation overflow:', documentOverflow);

    // Inline styles should be cleared
    expect(documentOverflow.htmlInline).toBe('');
    expect(documentOverflow.bodyInline).toBe('');

    // Computed styles should allow scrolling (visible or auto, not hidden)
    expect(documentOverflow.html).not.toBe('hidden');
    expect(documentOverflow.body).not.toBe('hidden');

    // Actually try to scroll to the footer
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
  });

  test('should be scrollable when returning from countdown via UI back button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForLanding(page);

    // Start a timer countdown
    await startTimerCountdown(page);

    // Click the back/configure button to return to landing page
    const backButton = page.getByRole('button', { name: /back|configure|settings/i });
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // May be in mobile hamburger menu
      const hamburger = page.getByTestId('hamburger-button');
      if (await hamburger.isVisible()) {
        await hamburger.click();
        await page.getByRole('button', { name: /back|configure|settings/i }).click();
      } else {
        // Use browser back as fallback
        await page.goBack();
      }
    }
    
    await waitForLanding(page);

    // Try to scroll to the start button at the bottom of the form
    const startButton = page.getByTestId('landing-start-button');
    await startButton.scrollIntoViewIfNeeded();
    await expect(startButton).toBeInViewport();

    // Also scroll to footer
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
  });

  test('should clear countdown-view class when returning to landing page', async ({ page }) => {
    await page.goto('/');
    await waitForLanding(page);

    await startTimerCountdown(page);

    // Verify countdown-view class is present
    const hasCountdownViewClass = await page.evaluate(() => {
      return document.getElementById('app')?.classList.contains('countdown-view') ?? false;
    });
    expect(hasCountdownViewClass).toBe(true);

    // Go back
    await page.goBack();
    await waitForLanding(page);

    // Verify countdown-view class is removed
    const hasCountdownViewClassAfter = await page.evaluate(() => {
      return document.getElementById('app')?.classList.contains('countdown-view') ?? false;
    });
    expect(hasCountdownViewClassAfter).toBe(false);
  });

  test('should be scrollable when returning from wall-clock countdown via back button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForLanding(page);

    // Start wall-clock countdown (default mode)
    await startWallClockCountdown(page);

    // Go back to landing page via browser back button
    await page.goBack();
    await waitForLanding(page);

    // Check scrollability
    const documentOverflow = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).overflow,
      body: getComputedStyle(document.body).overflow,
      htmlInline: document.documentElement.style.overflow,
      bodyInline: document.body.style.overflow,
      landingPage: getComputedStyle(document.querySelector('[data-testid="landing-page"]')!).overflowY,
    }));

    // Inline styles should be cleared
    expect(documentOverflow.htmlInline).toBe('');
    expect(documentOverflow.bodyInline).toBe('');
    expect(documentOverflow.landingPage).toBe('auto');

    // Actually try to scroll to the footer
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
  });

  test('should maintain scroll position after multiple navigations', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await waitForLanding(page);

    // Navigate: landing -> countdown -> landing -> countdown -> landing
    for (let i = 0; i < 2; i++) {
      await startTimerCountdown(page);
      await page.goBack();
      await waitForLanding(page);
    }

    // After multiple navigations, scrolling should still work
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();

    // And scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    const card = page.getByTestId('landing-card');
    await expect(card).toBeInViewport();
  });
});
