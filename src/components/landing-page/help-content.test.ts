/**
 * Help Content Tests
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import {
    buildHelpContent,
    FAQ_ITEMS,
    KEYBOARD_SHORTCUTS,
} from './help-content';

describe('Help Content Constants', () => {
  describe('FAQ_ITEMS', () => {
    it('should have at least 5 FAQ items', () => {
      expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5);
    });

    it('should have question and answer for each item', () => {
      for (const item of FAQ_ITEMS) {
        expect(item.question).toBeTruthy();
        expect(item.answer).toBeTruthy();
        expect(item.question.endsWith('?')).toBe(true);
      }
    });
  });

  describe('KEYBOARD_SHORTCUTS', () => {
    it('should have Space, Enter, R, F, A, and Escape shortcuts', () => {
      const keys = KEYBOARD_SHORTCUTS.map((s) => s.key);
      expect(keys).toContain('Space');
      expect(keys).toContain('Enter');
      expect(keys).toContain('R');
      expect(keys).toContain('F');
      expect(keys).toContain('A');
      expect(keys).toContain('Escape');
    });

    it('should have key, action, and group for each shortcut', () => {
      for (const shortcut of KEYBOARD_SHORTCUTS) {
        expect(shortcut.key).toBeTruthy();
        expect(shortcut.action).toBeTruthy();
        expect(shortcut.group).toBeTruthy();
        expect(['all-modes', 'timer-only', 'theme-selector']).toContain(shortcut.group);
      }
    });

    it('should have correct groupings', () => {
      const allModesKeys = KEYBOARD_SHORTCUTS.filter(s => s.group === 'all-modes').map(s => s.key);
      const timerOnlyKeys = KEYBOARD_SHORTCUTS.filter(s => s.group === 'timer-only').map(s => s.key);
      const themeSelectorKeys = KEYBOARD_SHORTCUTS.filter(s => s.group === 'theme-selector').map(s => s.key);

      expect(allModesKeys).toContain('F');
      expect(allModesKeys).toContain('Escape');
      expect(timerOnlyKeys).toContain('Space');
      expect(timerOnlyKeys).toContain('Enter');
      expect(timerOnlyKeys).toContain('R');
      expect(themeSelectorKeys).toContain('F');
      expect(themeSelectorKeys).toContain('A');
    });
  });
});

describe('buildHelpContent', () => {
  it('should create help content container', () => {
    const content = buildHelpContent();

    expect(content.className).toBe('help-content');
    expect(content.getAttribute('data-testid')).toBe('help-content');
  });

  it('should contain About section', () => {
    const content = buildHelpContent();
    const aboutSection = content.querySelector('[aria-labelledby="help-about-title"]');

    expect(aboutSection).not.toBeNull();
    expect(aboutSection?.querySelector('#help-about-title')?.textContent).toBe('About Timestamp');
  });

  it('should contain Countdown Modes section', () => {
    const content = buildHelpContent();
    const modesSection = content.querySelector('[aria-labelledby="help-modes-title"]');

    expect(modesSection).not.toBeNull();
    expect(modesSection?.querySelector('#help-modes-title')?.textContent).toBe('Countdown Modes');

    // Should have all three modes
    const modeItems = modesSection?.querySelectorAll('.help-mode-item');
    expect(modeItems?.length).toBe(3);
  });

  it('should contain Keyboard Shortcuts section with grouped tables', () => {
    const content = buildHelpContent();
    const shortcutsSection = content.querySelector('[aria-labelledby="help-shortcuts-title"]');

    expect(shortcutsSection).not.toBeNull();
    expect(shortcutsSection?.querySelector('#help-shortcuts-title')?.textContent).toBe('Keyboard Shortcuts');

    // Should have group titles
    const groupTitles = shortcutsSection?.querySelectorAll('.help-shortcuts-group-title');
    expect(groupTitles?.length).toBeGreaterThan(0);

    // Should have tables (one per group)
    const tables = shortcutsSection?.querySelectorAll('.help-shortcuts-table');
    expect(tables?.length).toBeGreaterThan(0);

    // Each table should have proper structure
    for (const table of Array.from(tables || [])) {
      expect(table.querySelector('thead')).not.toBeNull();
      expect(table.querySelector('tbody')).not.toBeNull();
    }

    // Check for kbd elements across all tables
    const kbdElements = shortcutsSection?.querySelectorAll('kbd');
    expect(kbdElements?.length).toBe(KEYBOARD_SHORTCUTS.length);
  });

  it('should contain Features section', () => {
    const content = buildHelpContent();
    const featuresSection = content.querySelector('[aria-labelledby="help-features-title"]');

    expect(featuresSection).not.toBeNull();
    expect(featuresSection?.querySelector('#help-features-title')?.textContent).toBe('Features');

    // Should have feature list
    const featuresList = featuresSection?.querySelector('.help-features-list');
    expect(featuresList).not.toBeNull();

    const featureItems = featuresList?.querySelectorAll('.help-feature-item');
    expect(featureItems?.length).toBeGreaterThanOrEqual(4);
  });

  it('should contain FAQ section with all items', () => {
    const content = buildHelpContent();
    const faqSection = content.querySelector('[aria-labelledby="help-faq-title"]');

    expect(faqSection).not.toBeNull();
    expect(faqSection?.querySelector('#help-faq-title')?.textContent).toBe('Frequently Asked Questions');

    // Should use definition list
    const faqList = faqSection?.querySelector('.help-faq-list');
    expect(faqList?.tagName).toBe('DL');

    // Should have all FAQ items
    const questions = faqList?.querySelectorAll('dt.help-faq-question');
    const answers = faqList?.querySelectorAll('dd.help-faq-answer');

    expect(questions?.length).toBe(FAQ_ITEMS.length);
    expect(answers?.length).toBe(FAQ_ITEMS.length);
  });

  it('should have proper accessibility structure', () => {
    const content = buildHelpContent();
    const sections = content.querySelectorAll('section');

    // Each section should have aria-labelledby
    for (const section of sections) {
      expect(section.hasAttribute('aria-labelledby')).toBe(true);
      const labelId = section.getAttribute('aria-labelledby');
      expect(section.querySelector(`#${labelId}`)).not.toBeNull();
    }
  });

  it('should have proper heading hierarchy', () => {
    const content = buildHelpContent();

    // All section titles should be h3
    const h3Elements = content.querySelectorAll('h3.help-section-title');
    expect(h3Elements.length).toBeGreaterThanOrEqual(5);

    // No h1 or h2 (those are in the parent context)
    const h1Elements = content.querySelectorAll('h1');
    const h2Elements = content.querySelectorAll('h2');
    expect(h1Elements.length).toBe(0);
    expect(h2Elements.length).toBe(0);
  });

  it('should mark icons as aria-hidden', () => {
    const content = buildHelpContent();

    // Mode icons
    const modeIcons = content.querySelectorAll('.help-mode-icon');
    for (const icon of modeIcons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }

    // Feature icons
    const featureIcons = content.querySelectorAll('.help-feature-icon');
    for (const icon of featureIcons) {
      expect(icon.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
