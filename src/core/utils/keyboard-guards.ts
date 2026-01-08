/**
 * Keyboard guards - utilities to detect when keyboard shortcuts should be ignored.
 *
 * These utilities help prevent keyboard shortcuts from interfering with user input
 * in text fields or when modal dialogs are open.
 */

/** Text input types where keyboard shortcuts should be ignored when focused. */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'password',
  'email',
  'number',
  'search',
  'tel',
  'url',
]);

/**
 * Check if the active element is a text input, textarea, contenteditable, or interactive button.
 *
 * @returns true if keyboard shortcuts should be ignored due to focused interactive element
 *
 * @example
 * ```ts
 * document.addEventListener('keydown', (event) => {
 *   if (shouldIgnoreShortcut()) return; // Don't handle shortcuts when typing
 *   handleKeyboardShortcut(event);
 * });
 * ```
 */
export function shouldIgnoreShortcut(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;

  // Check for textarea
  if (activeElement.tagName === 'TEXTAREA') {
    return true;
  }

  // Check for text-accepting input types
  if (activeElement.tagName === 'INPUT') {
    const inputElement = activeElement as HTMLInputElement;
    const inputType = inputElement.type.toLowerCase();
    // Input with no type attribute defaults to 'text'
    return TEXT_INPUT_TYPES.has(inputType) || inputType === '';
  }

  // Check for contenteditable (on element or ancestor)
  if (activeElement.closest('[contenteditable="true"]')) {
    return true;
  }

  // Check for focused button or link - Space should activate them, not trigger shortcuts
  if (activeElement.tagName === 'BUTTON' || activeElement.tagName === 'A') {
    return true;
  }

  return false;
}

/**
 * Check if any modal dialog is currently open in the document.
 *
 * Modals are detected via the standard ARIA `aria-modal="true"` attribute,
 * which allows detection of any modal implementation without coupling to
 * specific component implementations.
 *
 * Excludes PWA install prompt which doesn't block keyboard navigation.
 *
 * @returns true if a modal is open
 *
 * @example
 * ```ts
 * document.addEventListener('keydown', (event) => {
 *   if (isModalOpen()) return; // Don't handle shortcuts when modal is open
 *   handleKeyboardShortcut(event);
 * });
 * ```
 */
export function isModalOpen(): boolean {
  const modals = document.querySelectorAll('[aria-modal="true"]');
  
  // No modals at all
  if (modals.length === 0) return false;
  
  // Check if any modal is NOT the PWA install prompt
  // PWA install prompt has class 'install-prompt-dialog' and shouldn't block shortcuts
  for (const modal of modals) {
    if (!modal.classList.contains('install-prompt-dialog')) {
      return true; // Found a modal that's not PWA prompt
    }
  }
  
  return false; // Only PWA install prompt(s) found, don't block shortcuts
}
