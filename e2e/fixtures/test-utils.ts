import { expect, Locator, Page } from '@playwright/test';

/**
 * Dismiss the install prompt if visible.
 * The install prompt can overlay other UI elements and block interactions,
 * especially on mobile Safari. This helper dismisses it if present.
 */
async function dismissInstallPromptIfVisible(page: Page): Promise<void> {
  const overlay = page.locator('.install-prompt-overlay');
  // Check if visible - use isVisible() which checks actual visibility
  const isOverlayVisible = await overlay.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && el.offsetParent !== null;
  }).catch(() => false);
  
  if (isOverlayVisible) {
    // Click dismiss button or overlay to close
    const dismissButton = page.locator('.install-prompt-secondary');
    if (await dismissButton.isVisible()) {
      await dismissButton.click();
    } else {
      // Click outside to dismiss
      await overlay.click({ position: { x: 10, y: 10 } });
    }
    // Wait for overlay to be hidden
    await expect(overlay).toHaveCSS('display', 'none', { timeout: 3000 }).catch(() => {
      // Overlay might be removed from DOM entirely
    });
  }
}

/**
 * Wait for countdown display to be attached to the DOM.
 * Uses `toBeAttached()` instead of `toBeVisible()` because the countdown grid
 * may have `aria-hidden="true"` set during celebration phases, which makes
 * `toBeVisible()` fail on some browsers (especially Firefox).
 */
export async function waitForCountdown(page: Page): Promise<void> {
  // First wait for element to exist in DOM
  await expect(page.getByTestId('countdown-display').first()).toBeAttached({ timeout: 10000 });
  // Then wait for countdown display to be ready
  // - Canvas-based themes: the countdown-display IS a canvas element
  // - DOM-based themes: countdown-display is a container with children
  await page.waitForFunction(() => {
    const display = document.querySelector('[data-testid="countdown-display"]');
    if (!display) return false;
    // If it's a canvas element, it's ready immediately (canvas-based renderer)
    if (display.tagName === 'CANVAS') return true;
    // Otherwise check for children (DOM-based renderer)
    return display.children.length > 0;
  }, { timeout: 10000 });
  // Dismiss install prompt if it's blocking interactions
  await dismissInstallPromptIfVisible(page);

  // Close theme modal if it remained open from a previous interaction
  const themeModal = page.getByTestId('theme-modal');
  if (await themeModal.isVisible().catch(() => false)) {
    const closeButton = page.getByTestId('theme-modal-close');
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }
    await expect(themeModal).not.toBeVisible({ timeout: 3000 }).catch(() => {});
  }
}

export async function waitForLandingPage(page: Page): Promise<void> {
  await expect(page.getByTestId('landing-page')).toBeVisible({ timeout: 10000 });
  // Wait for default theme background to render (async theme loading)
  // Landing page renders theme background in landing-theme-background element
  // Canvas-based themes use canvas, DOM-based themes have other children
  await page.waitForFunction(() => {
    const bg = document.querySelector('[data-testid="landing-theme-background"]');
    if (!bg) return false;
    // Check for canvas element (canvas-based themes) or other DOM elements
    return bg.querySelector('canvas') !== null || bg.children.length > 0;
  }, { timeout: 5000 });
  // Dismiss install prompt if it's blocking interactions
  await dismissInstallPromptIfVisible(page);
}

export async function switchTheme(page: Page): Promise<void> {
  // On mobile viewports, theme switcher is inside the hamburger menu
  const isMobile = await page.evaluate(() => window.innerWidth <= 600);
  
  if (isMobile) {
    // Check if menu is already open (from a previous switch)
    const overlay = page.getByTestId('mobile-menu-overlay');
    const isMenuOpen = await overlay.isVisible().catch(() => false);
    
    if (!isMenuOpen) {
      // Open hamburger menu first to access theme switcher
      const menuButton = page.getByTestId('mobile-menu-button');
      await menuButton.click();
      await expect(overlay).toBeVisible();
    }
  }
  
  // Click theme switcher button to open modal
  await page.getByTestId('theme-switcher').click();
  
  // Wait for modal to open
  await expect(page.getByTestId('theme-modal')).toBeVisible({ timeout: 3000 });
  
  // Click the fireworks theme card to switch (cycles contribution-graph -> fireworks)
  // If fireworks is already selected, click contribution-graph
  const fireworksCard = page.getByTestId('theme-card-fireworks');
  const isFireworksSelected = await fireworksCard.getAttribute('aria-selected');
  
  if (isFireworksSelected === 'true') {
    const contributionGraphCard = page.getByTestId('theme-card-contribution-graph');
    // Wait for card to be stable before clicking
    await contributionGraphCard.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(100); // Extra stability wait
    await contributionGraphCard.click();
  } else {
    // Wait for card to be stable before clicking
    await fireworksCard.waitFor({ state: 'visible', timeout: 5000 });
    await page.waitForTimeout(100); // Extra stability wait
    await fireworksCard.click();
  }
  
  // Wait for modal to close - increase timeout and add extra wait for theme to load
  await expect(page.getByTestId('theme-modal')).not.toBeVisible({ timeout: 5000 });
  // Wait for countdown to stabilize after theme switch
  // - Canvas-based themes: the countdown-display IS a canvas element
  // - DOM-based themes: countdown-display is a container with children
  await page.waitForFunction(() => {
    const display = document.querySelector('[data-testid="countdown-display"]');
    if (!display) return false;
    // If it's a canvas element, it's ready immediately (canvas-based renderer)
    if (display.tagName === 'CANVAS') return true;
    // Otherwise check for children (DOM-based renderer)
    return display.children.length > 0;
  }, { timeout: 5000 });
}

export async function setTimezone(page: Page, timezone: string): Promise<void> {
  // On mobile viewports, timezone selector is in the hamburger menu
  const isMobile = await page.evaluate(() => window.innerWidth <= 600);
  
  if (isMobile) {
    // Open hamburger menu first
    const menuButton = page.getByTestId('mobile-menu-button');
    await menuButton.click();
    await expect(page.getByTestId('mobile-menu-overlay')).toBeVisible();
  }
  
  const selector = page.getByTestId('timezone-selector');
  await selector.getByRole('button').first().click();
  await selector.getByRole('searchbox', { name: /search timezones/i }).fill(timezone);
  await selector.getByRole('option', { name: new RegExp(timezone, 'i') }).first().click();
  
  if (isMobile) {
    // Close hamburger menu after selecting timezone
    await page.getByTestId('mobile-menu-close').click();
    await expect(page.getByTestId('mobile-menu-overlay')).not.toBeVisible();
  }
}

/**
 * Open the hamburger menu on mobile viewports to access chrome elements.
 * Returns true if the menu was opened (mobile), false otherwise (desktop).
 */
export async function openMobileMenuIfNeeded(page: Page): Promise<boolean> {
  const isMobile = await page.evaluate(() => window.innerWidth <= 600);
  
  if (isMobile) {
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('mobile-menu-overlay')).toBeVisible();
    return true;
  }
  return false;
}

/**
 * Close the hamburger menu if it was opened via openMobileMenuIfNeeded.
 */
export async function closeMobileMenuIfNeeded(page: Page, wasOpened: boolean): Promise<void> {
  if (wasOpened) {
    await page.getByTestId('mobile-menu-close').click();
    await expect(page.getByTestId('mobile-menu-overlay')).not.toBeVisible();
  }
}

/**
 * Wait for the mobile menu button to be visible.
 * The button is always created by JS but shown/hidden via CSS media query.
 * This helper waits for the element to exist and be visible (not display: none).
 */
export async function waitForMobileMenuButton(page: Page): Promise<void> {
  // Wait for element to exist
  await expect(page.getByTestId('mobile-menu-button')).toBeAttached({ timeout: 10000 });
  
  // Wait for CSS to apply and make it visible
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="mobile-menu-button"]') as HTMLElement;
    if (!button) return false;
    const style = window.getComputedStyle(button);
    return style.display !== 'none';
  }, { timeout: 10000 });
}

export async function waitForCelebrationPhase(
  page: Page,
  phase: 'wall-building' | 'wall-complete' | 'year-revealing' | 'year-revealed'
): Promise<void> {
  // First, ensure the countdown display exists
  const grid = page.getByTestId('countdown-display').first();
  await expect(grid).toBeAttached({ timeout: 10000 });

  // Wire a lightweight observer to capture phase changes without relying on timers
  await page.evaluate(() => {
    const win = window as unknown as {
      __celebrationPhaseHistory?: string[];
      __celebrationObserver?: MutationObserver;
      __celebrationObservedElement?: Element | null;
    };

    const history = win.__celebrationPhaseHistory ?? [];
    win.__celebrationPhaseHistory = history;

    const gridEl = document.querySelector('[data-testid="countdown-display"]');
    if (!gridEl) return;

    if (win.__celebrationObservedElement !== gridEl) {
      win.__celebrationObserver?.disconnect();

      const record = (value: string | null): void => {
        if (!value) return;
        if (history[history.length - 1] !== value) {
          history.push(value);
        }
      };

      // Capture current phase immediately
      record(gridEl.getAttribute('data-celebration-phase'));

      const observer = new MutationObserver(() => {
        record(gridEl.getAttribute('data-celebration-phase'));
      });

      observer.observe(gridEl, { attributes: true, attributeFilter: ['data-celebration-phase'] });
      win.__celebrationObserver = observer;
      win.__celebrationObservedElement = gridEl;
    }
  });

  // Use expect.poll for resilient, auto-retried checks (avoids timeouts tied to CPU load)
  await expect
    .poll(
      async () => {
        const seenPhase = await page.evaluate((expected) => {
          const win = window as unknown as { __celebrationPhaseHistory?: string[] };
          return !!win.__celebrationPhaseHistory && win.__celebrationPhaseHistory.includes(expected);
        }, phase);
        return seenPhase;
      },
      { timeout: 10000 }
    )
    .toBe(true);
}

/**
 * Assert theme grid layout at a specific viewport.
 * Reduces duplication in responsive layout tests.
 *
 * @param options - Test configuration
 * @param options.page - Playwright page
 * @param options.viewport - Viewport dimensions { width, height }
 * @param options.expectStacked - True for single column (stacked), false for multi-column (side by side)
 */
export async function assertThemeLayout(options: {
  page: Page;
  viewport: { width: number; height: number };
  expectStacked: boolean;
}): Promise<void> {
  const { page, viewport, expectStacked } = options;

  // Set viewport
  await page.setViewportSize(viewport);

  // Get theme cards
  const themeCards = page.locator('.theme-selector-card');
  await expect(themeCards.first()).toBeVisible();

  const cards = await themeCards.all();
  expect(cards.length).toBeGreaterThanOrEqual(2);

  // Get bounding boxes for first two cards
  const card1Rect = await cards[0].boundingBox();
  const card2Rect = await cards[1].boundingBox();

  expect(card1Rect).not.toBeNull();
  expect(card2Rect).not.toBeNull();

  if (expectStacked) {
    // Cards should be stacked vertically (single column)
    // Card 2 should be below card 1 (not side by side)
    expect(card2Rect!.y).toBeGreaterThan(card1Rect!.y + card1Rect!.height - 5);
  } else {
    // Cards should be on same row (side by side)
    // Cards should have similar Y position
    expect(Math.abs(card1Rect!.y - card2Rect!.y)).toBeLessThan(10);
  }
}

// =============================================================================
// Fullscreen helpers
// =============================================================================

export const VIEWPORTS = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

export async function launchCountdown(
  page: Page,
  query = '/?mode=timer&duration=3600'
): Promise<void> {
  await page.goto(query);
  await waitForCountdown(page);
}

export async function launchCountdownWithDuration(page: Page, duration: string): Promise<void> {
  await launchCountdown(page, `/?mode=timer&duration=${duration}`);
}

export async function waitForFullscreenState(page: Page, isFullscreen: boolean): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element | null;
        mozFullScreenElement?: Element | null;
        msFullscreenElement?: Element | null;
      };
      const fullscreenElement =
        doc.fullscreenElement ??
        doc.webkitFullscreenElement ??
        doc.mozFullScreenElement ??
        doc.msFullscreenElement ??
        null;
      return (fullscreenElement !== null) === expected;
    },
    isFullscreen,
    { timeout: 5000 }
  );
}

export async function enterFullscreen(page: Page): Promise<void> {
  await page.getByTestId('fullscreen-button').click();
  await waitForFullscreenState(page, true);
}

export async function exitFullscreen(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      mozCancelFullScreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
    }
  });
  await waitForFullscreenState(page, false);
}

export async function moveMouseToRevealExit(page: Page): Promise<void> {
  await page.mouse.move(0, 0);
  await page.mouse.move(100, 100);
  await expect(page.getByTestId('exit-fullscreen-button')).toBeVisible({ timeout: 2000 });
}

export async function assertChromeVisibility(page: Page, visible: boolean): Promise<void> {
  const expectations = [
    page.getByTestId('world-map'),
    page.getByTestId('timezone-selector'),
    page.getByTestId('share-button'),
    page.getByTestId('theme-switcher'),
  ];

  for (const locator of expectations) {
    const count = await locator.count();
    if (count === 0) {
      continue;
    }

    if (visible) {
      await expect(locator).toBeVisible();
    } else {
      await expect(locator).not.toBeVisible();
    }
  }
}

export async function assertFullscreenExited(page: Page): Promise<void> {
  await waitForFullscreenState(page, false);
  await assertChromeVisibility(page, true);
  const hasFullscreenAttr = await page.locator('#app').evaluate((el) =>
    el.hasAttribute('data-fullscreen') || el.classList.contains('fullscreen-mode')
  );
  expect(hasFullscreenAttr).toBe(false);
}

// =============================================================================
// Generic helpers for mobile/responsive specs
// =============================================================================

export async function gotoWithViewport(
  page: Page,
  viewport: { width: number; height: number },
  url: string
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(url);
}

export async function openHamburgerOverlay(
  page: Page
): Promise<{ button: Locator; overlay: Locator }> {
  const button = page.getByTestId('mobile-menu-button');
  await expect(button).toBeVisible();
  await button.click();
  const overlay = page.getByTestId('mobile-menu-overlay');
  await expect(overlay).toBeVisible();
  return { button, overlay };
}

export async function closeHamburgerOverlay(page: Page): Promise<void> {
  const overlay = page.getByTestId('mobile-menu-overlay');
  const closeButton = page.getByTestId('mobile-menu-close');
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await expect(overlay).not.toBeVisible();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  expect(hasOverflow).toBe(false);
}

export async function mockClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const globalWindow = window as Window & { __mockClipboardLastText?: string };
    globalWindow.__mockClipboardLastText = '';
    const fakeClipboard = {
      writeText(text: string) {
        globalWindow.__mockClipboardLastText = text;
        return Promise.resolve();
      },
      readText() {
        return Promise.resolve(globalWindow.__mockClipboardLastText ?? '');
      },
    };
    Object.defineProperty(navigator, 'clipboard', {
      get: () => fakeClipboard,
      configurable: true,
    });
  });
}

export async function getLastCopiedText(page: Page): Promise<string> {
  return page.evaluate(() => (window as Window & { __mockClipboardLastText?: string }).__mockClipboardLastText ?? '');
}

export async function expectAlignedRows(
  boxes: Array<{ y: number; height: number } | null>,
  tolerance = 10
): Promise<void> {
  const filtered = boxes.filter((box): box is { y: number; height: number } => Boolean(box));
  expect(filtered.length).toBeGreaterThan(1);
  const ys = filtered.map((box) => box.y);
  const maxDiff = Math.max(...ys) - Math.min(...ys);
  expect(maxDiff).toBeLessThan(tolerance);
}

export interface DropdownNavigationOptions {
  page: Page;
  dropdownList: Locator;
  searchInput: Locator;
  navigationKeys: string[];
  expectedFocusedOption?: Locator;
}

export async function assertDropdownNavigationStaysVisible(options: DropdownNavigationOptions): Promise<void> {
  const { page, dropdownList, searchInput, navigationKeys, expectedFocusedOption } = options;
  await expect(dropdownList).toBeVisible();
  await searchInput.focus();

  for (const key of navigationKeys) {
    await page.keyboard.press(key);
  }

  const focusedOption = expectedFocusedOption ?? dropdownList.locator('.dropdown-option:focus');
  await expect(focusedOption).toBeFocused();

  const dropdownBox = await dropdownList.boundingBox();
  const focusedBox = await focusedOption.boundingBox();

  expect(focusedBox).not.toBeNull();
  expect(dropdownBox).not.toBeNull();

  if (focusedBox && dropdownBox) {
    expect(focusedBox.y).toBeGreaterThanOrEqual(dropdownBox.y);
    expect(focusedBox.y + focusedBox.height).toBeLessThanOrEqual(dropdownBox.y + dropdownBox.height);
  }
}
