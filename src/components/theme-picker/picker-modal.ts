/**
 * Theme Switcher Modal - wraps theme selector in dialog with focus trap and Escape handling.
 */

import '../../styles/components/theme-switcher-modal.scss';

import type { ThemeId } from '@core/types';
import { createFocusTrap, type FocusTrapController } from '@core/utils/accessibility/focus-trap';
import { cloneTemplate, getIconSvg } from '@core/utils/dom';

import { createThemeSelector, type ThemeSelectorController } from './index';

const THEME_MODAL_TITLE_ID = 'theme-modal-title';
const THEME_MODAL_OPEN_EVENT = 'theme-modal:open';
const THEME_MODAL_CLOSE_EVENT = 'theme-modal:close';
const SCREEN_READER_OPEN_ANNOUNCEMENT = 'Theme selector dialog opened';
const ANNOUNCER_LIFETIME_MS = 1000;
const stopPropagationHandler = (event: Event): void => event.stopPropagation();

/**
 * Options for creating a theme switcher modal.
 */
export interface ThemeSwitcherModalOptions {
  /** Currently selected theme ID */
  currentTheme: ThemeId;
  /** Callback when theme is selected */
  onSelect: (themeId: ThemeId) => void;
  /** Callback when modal is closed */
  onClose: () => void;
}

/**
 * Controller for managing the modal.
 */
export interface ModalController {
  /** Open the modal and trap focus */
  open(): void;
  /** Close the modal and restore focus */
  close(): void;
  /** Destroy the modal and clean up */
  destroy(): void;
}

/**
 * Create theme picker modal with focus trap and keyboard handling.
 * @param options - Current theme, selection callback, and close callback
 * @returns Controller for modal lifecycle
 */
export function createThemePickerModal(
  options: ThemeSwitcherModalOptions
): ModalController {
  let modalElement: HTMLElement | null = null;
  let overlayElement: HTMLElement | null = null;
  let themeSelector: ThemeSelectorController | null = null;
  let focusTrap: FocusTrapController | null = null;
  let isOpen = false;
  let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Build the modal overlay and dialog from template.
   * @returns Overlay element with modal and theme selector
   */
  function buildModal(): HTMLElement {
    overlayElement = cloneTemplate<HTMLElement>('theme-modal-template');
    modalElement = overlayElement.querySelector('.theme-modal') as HTMLElement;
    const closeButton = modalElement.querySelector('.theme-modal-close') as HTMLButtonElement;
    const body = modalElement.querySelector('.theme-modal-body') as HTMLElement;

    // Wire up ARIA labelledby
    modalElement.setAttribute('aria-labelledby', THEME_MODAL_TITLE_ID);

    // Inject close button icon
    closeButton.innerHTML = getIconSvg('x', 16);

    // Event handlers for overlay and modal
    overlayElement.addEventListener('click', (e) => {
      // Close on overlay background click (not on modal content)
      if (e.target === overlayElement) {
        close();
      }
    });
    modalElement.addEventListener('click', stopPropagationHandler);
    closeButton.addEventListener('mousedown', stopPropagationHandler);
    closeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });

    // Create and attach theme selector
    themeSelector = createThemeSelector({
      currentTheme: options.currentTheme,
      onSelect: (themeId) => {
        options.onSelect(themeId);
      },
      showLivePreview: true,
    });
    body.appendChild(themeSelector.getElement());

    return overlayElement;
  }

  /**
   * Unlock Safari autoplay by priming video elements during user gesture.
   * Safari requires video.play() to be called during a user gesture context.
   * We do a quick play/pause on each video to "unlock" them for hover autoplay.
   */
  function unlockSafariAutoplay(): void {
    const videos = document.querySelectorAll<HTMLVideoElement>('.theme-selector-card-preview-video');
    for (const video of videos) {
      // Ensure video is configured for autoplay
      video.muted = true;
      video.playsInline = true;
      
      // Set src if not already set (from dataset)
      if (!video.src && video.dataset.src) {
        video.src = video.dataset.src;
      }
      
      // Brief play attempt to unlock - immediately pause
      // Safari remembers this unlock even after pause
      const playPromise = video.play();
      
      // Handle case where play() returns undefined (test environment)
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            video.pause();
            video.currentTime = 0;
          })
          .catch(() => {
            // Autoplay blocked, user will need to click
          });
      }
    }
  }

  function open(): void {
    if (isOpen) return;

    const modal = buildModal();
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    document.dispatchEvent(new CustomEvent(THEME_MODAL_OPEN_EVENT));
    announceToScreenReaders(SCREEN_READER_OPEN_ANNOUNCEMENT);
    
    // Unlock Safari autoplay - must happen AFTER modal is in DOM
    // and within user gesture context (we're still in the click handler)
    unlockSafariAutoplay();

    const searchInput = modalElement?.querySelector('[data-testid="theme-search-input"]') as HTMLInputElement | null;
    
    focusTrap = createFocusTrap({
      container: modalElement!,
      initialFocus: searchInput ?? undefined,
      escapeDeactivates: true,
      clickOutsideDeactivates: false, // We handle overlay clicks manually
      onEscape: close,
      onClickOutside: (e) => {
        // Only close if clicking the overlay background, not the modal itself
        if (e?.target === overlayElement) {
          close();
        }
      },
    });
    focusTrap.activate();

    // Add global Escape key handler
    escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', escapeHandler);

    isOpen = true;
  }

  function close(): void {
    if (!isOpen) return;

    document.body.style.overflow = '';

    // Remove global Escape key handler
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }

    if (focusTrap) {
      focusTrap.deactivate();
      focusTrap = null;
    }

    if (overlayElement && overlayElement.parentElement) {
      overlayElement.remove();
    }

    if (themeSelector) {
      themeSelector.destroy();
      themeSelector = null;
    }

    modalElement = null;
    overlayElement = null;
    isOpen = false;

    document.dispatchEvent(new CustomEvent(THEME_MODAL_CLOSE_EVENT));
    options.onClose();
  }

  /**
   * Announce message to screen readers via temporary aria-live region.
   * @param message - Message to announce
   */
  function announceToScreenReaders(message: string): void {
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'status');
    announcer.setAttribute('aria-live', 'polite');
    announcer.className = 'sr-only';
    announcer.textContent = message;
    document.body.appendChild(announcer);

    setTimeout(() => {
      announcer.remove();
    }, ANNOUNCER_LIFETIME_MS);
  }

  function destroy(): void {
    if (isOpen) {
      close();
    }

    if (themeSelector) {
      themeSelector.destroy();
      themeSelector = null;
    }
  }

  return {
    open,
    close,
    destroy,
  };
}
