/**
 * UI Components Factory - creation and destruction of orchestrator UI.
 */

import { shouldShowTimezoneSwitcherOnCountdown, worldMapAvailableForMode } from '@core/config/mode-config';
import type { CountdownMode, ThemeConfig, ThemeId, WallClockTime } from '@core/types';

import { createColorModeToggle, destroyColorModeToggle } from '@/components/color-mode-toggle';
import {
    type BackButtonController,
    createBackButton,
    createFavoriteButton,
    createGitHubButton,
    createShareControl,
    createTimerControls,
    type FavoriteButtonController,
    type ShareController,
    type ShareTargets,
    type TimerControlsController,
} from '@/components/countdown-buttons';
import {
    createFullscreenButton,
    initFullscreenManager,
    requestFullscreen,
} from '@/components/countdown-buttons/fullscreen-button';
import { createOfflineIndicator, type OfflineIndicatorController } from '@/components/pwa';
import { createThemePicker, type ThemePickerController } from '@/components/theme-picker';
import { createTimezoneSelector, type TimezoneSelectorController } from '@/components/timezone-selector';
import { createWorldMap, type WorldMapController } from '@/components/world-map';

const MOBILE_FULLSCREEN_BREAKPOINT_PX = 600;
const MODAL_FADE_DURATION_MS = 200;
const MODAL_FADE_TRANSITION = `opacity ${MODAL_FADE_DURATION_MS}ms ease`;

/** Orchestrator UI components. */
export interface UIComponents {
  buttonContainer: HTMLDivElement;
  colorModeToggle: HTMLElement;
  offlineIndicator: OfflineIndicatorController;
  share: ShareController;
  favoriteButton: FavoriteButtonController;
  fullscreenButton: HTMLButtonElement | null;
  fullscreenCleanup: (() => void) | null;
  themeSwitcher: ThemePickerController;
  githubButton: HTMLAnchorElement;
  backButton?: BackButtonController;
  timerControls?: TimerControlsController;
  timezoneSelector?: TimezoneSelectorController;
  worldMap?: WorldMapController;
}

/** UI factory configuration. */
export interface UIFactoryOptions {
  initialTheme: ThemeId;
  container: HTMLElement;
  mode?: CountdownMode;
  getShareTargets?: () => ShareTargets;
  onBack?: () => void;
  onThemeSwitch?: (themeId: ThemeId) => Promise<void>;
  onTimezoneSelect?: (timezone: string) => void;
  onCitySelect?: (timezone: string) => void;
  showWorldMap?: boolean;
  onTimerPlayPauseToggle?: (isPlaying: boolean) => void;
  onTimerReset?: () => void;
}

/**
 * Creates all orchestrator UI components.
 * 
 * Instantiates and wires up all UI elements including buttons, controls, theme picker,
 * and mode-specific components like timer controls or share menus.
 * 
 * @param options - Configuration for UI component creation
 * @returns Complete set of UI component controllers
 * 
 * @example
 * ```typescript
 * const ui = createUIComponents({
 *   initialTheme: 'contribution-graph',
 *   container,
 *   mode: 'wall-clock',
 *   onBack: () => navigateHome(),
 *   onThemeSwitch: (id) => switchTheme(id)
 * });
 * ```
 */
export function createUIComponents(options: UIFactoryOptions): UIComponents {
  const components = {} as UIComponents;
  const mode = options.mode ?? 'wall-clock';

  // Back button first if onBack callback provided (for tab order)
  if (options.onBack) {
    components.backButton = createBackButton(document.body, {
      onBack: options.onBack,
    });
  }

  components.buttonContainer = document.createElement('div');
  components.buttonContainer.className = 'countdown-button-container';
  components.buttonContainer.dataset.testid = 'countdown-button-container';
  document.body.appendChild(components.buttonContainer);

  components.offlineIndicator = createOfflineIndicator();
  components.buttonContainer.appendChild(components.offlineIndicator.getElement());
  components.offlineIndicator.init();

  if (mode === 'timer') {
    components.timerControls = createTimerControls({
      initialPlaying: true,
      onPlayPauseToggle: options.onTimerPlayPauseToggle,
      onReset: options.onTimerReset,
    });
    components.buttonContainer.appendChild(components.timerControls.getElement());
  }

  // Wall-clock: menu with timezone options. Timer/absolute: simple button.
  const fallbackTargets: ShareTargets = {
    withSelectedTimezone: window.location.href,
    withLocalTimezone: window.location.href,
    withoutTimezone: window.location.href,
  };
  
  components.share = createShareControl({
    mode,
    getShareTargets: options.getShareTargets ?? (() => fallbackTargets),
  });
  components.buttonContainer.appendChild(components.share.getElement());

  components.favoriteButton = createFavoriteButton({
    themeId: options.initialTheme,
  });
  components.buttonContainer.appendChild(components.favoriteButton.getElement());

  components.colorModeToggle = createColorModeToggle();
  components.buttonContainer.appendChild(components.colorModeToggle);

  components.themeSwitcher = createThemePicker(components.buttonContainer, {
    initialTheme: options.initialTheme,
    onSwitch: options.onThemeSwitch || (() => Promise.resolve()),
  });

  components.githubButton = createGitHubButton();
  components.buttonContainer.appendChild(components.githubButton);

  const isMobile = window.innerWidth <= MOBILE_FULLSCREEN_BREAKPOINT_PX;
  components.fullscreenButton = createFullscreenButton({
    isMobile,
    isFullscreen: false,
    onToggle: requestFullscreen,
  });
  if (components.fullscreenButton) {
    components.buttonContainer.appendChild(components.fullscreenButton);
  }

  components.fullscreenCleanup = initFullscreenManager({
    container: options.container,
    mode: options.mode,
    onTimerPlayPauseToggle: options.onTimerPlayPauseToggle,
    onTimerReset: options.onTimerReset,
    initialTimerPlaying: true,
  });

  return components;
}

/**
 * Destroys all UI components and cleans up event listeners.
 * 
 * Calls destroy methods on all component controllers, removes DOM elements,
 * and performs cleanup to prevent memory leaks.
 * 
 * @param components - UI components container to destroy
 * 
 * @example
 * ```typescript
 * destroyUIComponents(uiComponents);
 * ```
 */
export function destroyUIComponents(components: UIComponents): void {
  components.offlineIndicator?.destroy();
  components.share?.destroy();
  components.timerControls?.destroy();

  components.favoriteButton?.destroy();
  if (components.colorModeToggle) {
    destroyColorModeToggle(components.colorModeToggle);
  }
  if (components.fullscreenCleanup) {
    components.fullscreenCleanup();
  }
  components.buttonContainer?.remove();
  components.backButton?.destroy();
  components.timezoneSelector?.destroy();
  components.worldMap?.destroy();
}

/**
 * Creates optional components based on theme configuration.
 * 
 * Conditionally creates world map and timezone selector based on theme config,
 * countdown mode, and user preferences. Only creates components if theme supports them.
 * 
 * @param components - UI components container to populate
 * @param selectedTimezone - Current selected timezone
 * @param options - UI factory options
 * @param themeConfig - Theme configuration with optional component flags
 * @param wallClockTarget - Wall clock target time (optional, required for wall-clock mode)
 * 
 * @example
 * ```typescript
 * createOptionalComponents(
 *   uiComponents,
 *   'America/New_York',
 *   factoryOptions,
 *   themeConfig,
 *   wallClockTarget
 * );
 * ```
 */
export function createOptionalComponents(
  components: UIComponents,
  selectedTimezone: string,
  options: UIFactoryOptions,
  themeConfig: ThemeConfig,
  wallClockTarget?: WallClockTime
): void {
  const optionalComponents = themeConfig.optionalComponents;
  const mode = options.mode ?? 'wall-clock';

  // Timer/absolute: skip location-based components. Wall-clock: show if enabled.
  const shouldShowTimezoneSelector = shouldShowTimezoneSwitcherOnCountdown(mode);
  const shouldShowWorldMapComponent = worldMapAvailableForMode(mode, options.showWorldMap);

  if (!shouldShowTimezoneSelector && !shouldShowWorldMapComponent) {
    return;
  }

  if (optionalComponents?.worldMap && shouldShowWorldMapComponent && wallClockTarget && !components.worldMap) {
    components.worldMap = createWorldMap(document.body, {
      initialTimezone: selectedTimezone,
      wallClockTarget,
      onCitySelect: (city) => {
        if (options.onCitySelect) {
          options.onCitySelect(city.timezone);
        }
      },
      themeStyles: themeConfig.themeStyles,
    });
  }

  if (optionalComponents?.timezoneSelector && shouldShowTimezoneSelector && !components.timezoneSelector) {
    components.timezoneSelector = createTimezoneSelector(document.body, {
      initialTimezone: selectedTimezone,
      wallClockTarget,
      onSelect: (timezone) => {
        if (options.onTimezoneSelect) {
          options.onTimezoneSelect(timezone);
        }
      },
      themeStyles: themeConfig.themeStyles,
    });
  }

  if (components.timezoneSelector && themeConfig.themeStyles) {
    components.timezoneSelector.setThemeStyles(themeConfig.themeStyles);
  }
  if (components.worldMap && themeConfig.themeStyles) {
    components.worldMap.setThemeStyles(themeConfig.themeStyles);
  }
}

/**
 * Destroys optional components not needed by new theme.
 * 
 * Removes and cleans up world map and timezone selector if the new theme
 * configuration doesn't require them. Called during theme switches.
 * 
 * @param components - UI components container
 * @param newConfig - New theme configuration
 * 
 * @example
 * ```typescript
 * destroyOptionalComponents(uiComponents, newThemeConfig);
 * ```
 */
export function destroyOptionalComponents(
  components: UIComponents,
  newConfig: ThemeConfig
): void {
  const optionalComponents = newConfig.optionalComponents;

  if (!optionalComponents?.timezoneSelector && components.timezoneSelector) {
    components.timezoneSelector.destroy();
    components.timezoneSelector = undefined;
  }

  if (!optionalComponents?.worldMap && components.worldMap) {
    components.worldMap.destroy();
    components.worldMap = undefined;
  }
}

/**
 * Updates optional components for theme switch - destroys old, creates new.
 * Encapsulates create/destroy lifecycle internally.
 * 
 * @param components - UI components container
 * @param selectedTimezone - Current selected timezone
 * @param options - UI factory options
 * @param themeConfig - New theme configuration
 * @param wallClockTarget - Wall clock target time (optional)
 */
export function updateOptionalComponents(
  components: UIComponents,
  selectedTimezone: string,
  options: UIFactoryOptions,
  themeConfig: ThemeConfig,
  wallClockTarget?: WallClockTime
): void {
  destroyOptionalComponents(components, themeConfig);
  createOptionalComponents(components, selectedTimezone, options, themeConfig, wallClockTarget);
}

/**
 * Updates fullscreen button visibility and lifecycle for viewport changes.
 * 
 * Hides fullscreen button on mobile (≤600px), creates it on desktop if missing.
 * Manages fullscreen manager lifecycle across viewport transitions.
 * 
 * @param components - UI components container
 * @param isMobile - Whether current viewport is mobile size
 * @param options - Optional factory options for timer mode callbacks
 * 
 * @example
 * ```typescript
 * window.addEventListener('resize', () => {
 *   updateFullscreenButtonForViewport(uiComponents, window.innerWidth <= 600, factoryOptions);
 * });
 * ```
 */
export function updateFullscreenButtonForViewport(
  components: UIComponents,
  isMobile: boolean,
  options?: Pick<UIFactoryOptions, 'mode' | 'onTimerPlayPauseToggle' | 'onTimerReset'>
): void {
  if (isMobile) {
    if (components.fullscreenButton) {
      components.fullscreenButton.style.display = 'none';
    }
    return;
  }

  if (!components.fullscreenButton) {
    const fullscreenButton = createFullscreenButton({
      isMobile: false,
      isFullscreen: false,
      onToggle: requestFullscreen,
    });

    if (fullscreenButton) {
      components.buttonContainer.appendChild(fullscreenButton);
      components.fullscreenButton = fullscreenButton;

      if (components.fullscreenCleanup) {
        components.fullscreenCleanup();
      }
      const container = document.getElementById('app');
      components.fullscreenCleanup = initFullscreenManager({
        container,
        mode: options?.mode,
        onTimerPlayPauseToggle: options?.onTimerPlayPauseToggle,
        onTimerReset: options?.onTimerReset,
        initialTimerPlaying: true,
      });
    }
  } else {
    components.fullscreenButton.style.display = '';
  }
}

/**
 * Sets up modal event handlers for button container fade-out during theme modal.
 * 
 * Fades out button container when theme modal opens, restores on close.
 * Returns cleanup function to remove event listeners.
 * 
 * @param buttonContainer - Button container element to fade
 * @returns Cleanup function to remove event listeners
 * 
 * @example
 * ```typescript
 * const cleanup = setupModalHandlers(buttonContainer);
 * // Later: cleanup();
 * ```
 */
export function setupModalHandlers(buttonContainer: HTMLDivElement): () => void {
  const modalOpenHandler = () => {
    buttonContainer.style.opacity = '0';
    buttonContainer.style.pointerEvents = 'none';
    buttonContainer.style.transition = MODAL_FADE_TRANSITION;
  };

  const modalCloseHandler = () => {
    buttonContainer.style.opacity = '1';
    buttonContainer.style.pointerEvents = 'auto';
  };

  document.addEventListener('theme-modal:open', modalOpenHandler);
  document.addEventListener('theme-modal:close', modalCloseHandler);

  return () => {
    document.removeEventListener('theme-modal:open', modalOpenHandler);
    document.removeEventListener('theme-modal:close', modalCloseHandler);
  };
}
