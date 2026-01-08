/**
 * Tests for keyboard guards - input focus and modal detection utilities.
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isModalOpen, shouldIgnoreShortcut } from './keyboard-guards';

describe('keyboard-guards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('shouldIgnoreShortcut', () => {
    describe('input element focus', () => {
      it.each([
        ['text', 'input[type=text]'],
        ['password', 'input[type=password]'],
        ['email', 'input[type=email]'],
        ['number', 'input[type=number]'],
        ['search', 'input[type=search]'],
        ['tel', 'input[type=tel]'],
        ['url', 'input[type=url]'],
      ])('returns true when %s input is focused', (type) => {
        const input = document.createElement('input');
        input.type = type;
        document.body.appendChild(input);
        input.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });

      it('returns true when input with no type (defaults to text) is focused', () => {
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });

      it('returns false when non-text input types are focused', () => {
        // Button-like inputs should allow shortcuts
        const button = document.createElement('input');
        button.type = 'button';
        document.body.appendChild(button);
        button.focus();

        expect(shouldIgnoreShortcut()).toBe(false);
      });
    });

    describe('textarea focus', () => {
      it('returns true when textarea is focused', () => {
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });
    });

    describe('contenteditable focus', () => {
      it('returns true when contenteditable element is focused', () => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        document.body.appendChild(div);
        div.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });

      it('returns true when child of contenteditable element is focused', () => {
        const div = document.createElement('div');
        div.setAttribute('contenteditable', 'true');
        const span = document.createElement('span');
        span.setAttribute('tabindex', '0');
        div.appendChild(span);
        document.body.appendChild(div);
        span.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });
    });

    describe('interactive element focus', () => {
      it('returns true when button is focused', () => {
        const button = document.createElement('button');
        document.body.appendChild(button);
        button.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });

      it('returns true when link is focused', () => {
        const link = document.createElement('a');
        link.href = '#';
        document.body.appendChild(link);
        link.focus();

        expect(shouldIgnoreShortcut()).toBe(true);
      });

      it('returns false when div with tabindex is focused', () => {
        const div = document.createElement('div');
        div.setAttribute('tabindex', '0');
        document.body.appendChild(div);
        div.focus();

        expect(shouldIgnoreShortcut()).toBe(false);
      });

      it('returns false when nothing is focused (body)', () => {
        // Focus body explicitly
        document.body.focus();

        expect(shouldIgnoreShortcut()).toBe(false);
      });

      it('returns false when activeElement is null', () => {
        // This shouldn't happen in normal DOM, but handle gracefully
        expect(shouldIgnoreShortcut()).toBe(false);
      });
    });
  });

  describe('isModalOpen', () => {
    it('returns true when element with aria-modal="true" exists', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);

      expect(isModalOpen()).toBe(true);
    });

    it('returns true when dialog element with aria-modal="true" exists', () => {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-modal', 'true');
      document.body.appendChild(dialog);

      expect(isModalOpen()).toBe(true);
    });

    it('returns false when no aria-modal elements exist', () => {
      const div = document.createElement('div');
      document.body.appendChild(div);

      expect(isModalOpen()).toBe(false);
    });

    it('returns false when aria-modal="false"', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'false');
      document.body.appendChild(modal);

      expect(isModalOpen()).toBe(false);
    });

    it('returns false on empty DOM', () => {
      expect(isModalOpen()).toBe(false);
    });

    it('returns false when only PWA install prompt is present', () => {
      const pwaPrompt = document.createElement('div');
      pwaPrompt.setAttribute('aria-modal', 'true');
      pwaPrompt.classList.add('install-prompt-dialog');
      document.body.appendChild(pwaPrompt);

      expect(isModalOpen()).toBe(false);
    });

    it('returns true when both PWA install prompt and real modal are present', () => {
      const pwaPrompt = document.createElement('div');
      pwaPrompt.setAttribute('aria-modal', 'true');
      pwaPrompt.classList.add('install-prompt-dialog');
      document.body.appendChild(pwaPrompt);

      const realModal = document.createElement('div');
      realModal.setAttribute('aria-modal', 'true');
      realModal.classList.add('theme-picker-modal');
      document.body.appendChild(realModal);

      expect(isModalOpen()).toBe(true);
    });
  });

  describe('combined scenarios', () => {
    it('shouldIgnoreShortcut returns true when button is focused (even inside modal)', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      const button = document.createElement('button');
      modal.appendChild(button);
      document.body.appendChild(modal);
      button.focus();

      // shouldIgnoreShortcut checks focus on interactive elements
      // Button focus means Space should activate the button, not trigger shortcuts
      // The modal check is done separately via isModalOpen
      expect(shouldIgnoreShortcut()).toBe(true);
      expect(isModalOpen()).toBe(true);
    });

    it('handles both modal open AND input focused', () => {
      const modal = document.createElement('div');
      modal.setAttribute('aria-modal', 'true');
      const input = document.createElement('input');
      input.type = 'text';
      modal.appendChild(input);
      document.body.appendChild(modal);
      input.focus();

      expect(shouldIgnoreShortcut()).toBe(true);
      expect(isModalOpen()).toBe(true);
    });
  });
});
