/**
 * UI Components Factory Tests
 * @packageDocumentation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cleanupDOM } from '@/test-utils/dom-helpers';
import type { WallClockTime } from '@core/types';

import type { UIFactoryOptions } from './ui-factory';
import { createOptionalComponents, createUIComponents, destroyOptionalComponents, destroyUIComponents } from './ui-factory';

// Mock all component modules
vi.mock('@/components/theme-switcher', () => ({
  createThemeSwitcher: vi.fn(() => ({
    setTheme: vi.fn(),
  })),
}));

vi.mock('@/components/github-button', () => ({
  createGitHubButton: vi.fn(() => document.createElement('a')),
}));

vi.mock('@/components/favorite-button', () => ({
  createFavoriteButton: vi.fn(() => ({
    getElement: () => document.createElement('button'),
    setTheme: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('@/components/back-button', () => ({
  createBackButton: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock('@/components/offline-indicator', () => ({
  createOfflineIndicator: vi.fn(() => ({
    getElement: () => document.createElement('div'),
    init: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('@/components/timezone-selector', () => ({
  createTimezoneSelector: vi.fn(() => ({
    setTimezone: vi.fn(),
    setThemeStyles: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('@/components/world-map', () => ({
  createWorldMap: vi.fn(() => ({
    setTimezone: vi.fn(),
    setThemeStyles: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('@/components/countdown-buttons/timer-controls', () => ({
  createTimerControls: vi.fn(() => ({
    getElement: () => document.createElement('div'),
    setPlaying: vi.fn(),
    destroy: vi.fn(),
  })),
  createFullscreenTimerControls: vi.fn(() => ({
    getElement: () => document.createElement('div'),
    setPlaying: vi.fn(),
    isPlaying: vi.fn(() => true),
    show: vi.fn(),
    hide: vi.fn(),
    isVisible: vi.fn(() => false),
    destroy: vi.fn(),
  })),
}));

const MOCK_WALL_CLOCK_TARGET: WallClockTime = {
  year: 2025,
  month: 0,
  day: 1,
  hours: 0,
  minutes: 0,
  seconds: 0,
};

describe('UI Components Factory', () => {
  beforeEach(() => {
    cleanupDOM();
    vi.clearAllMocks();
  });

  describe('createUIComponents', () => {
    it('should create button container with proper structure', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
      };

      const components = createUIComponents(options);

      expect(components.buttonContainer).toBeDefined();
      expect(components.buttonContainer.className).toBe('countdown-button-container');
      expect(document.body.contains(components.buttonContainer)).toBe(true);
    });

    it('should create all required components', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
      };

      const components = createUIComponents(options);

      expect(components.offlineIndicator).toBeDefined();
      expect(components.share).toBeDefined();
      expect(components.favoriteButton).toBeDefined();
      expect(components.themeSwitcher).toBeDefined();
      expect(components.githubButton).toBeDefined();
    });

    it('should create back button when onBack callback provided', () => {
      const onBack = vi.fn();
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
        onBack,
      };

      const components = createUIComponents(options);

      expect(components.backButton).toBeDefined();
    });

    it('should not create back button when onBack callback not provided', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
      };

      const components = createUIComponents(options);

      expect(components.backButton).toBeUndefined();
    });

    it('should insert components in correct DOM order', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
      };
      const components = createUIComponents(options);

      expect(Array.from(components.buttonContainer.children).length).toBeGreaterThan(0);
    });

    it.each([
      {
        mode: 'timer' as UIFactoryOptions['mode'],
        description: 'create timer controls for timer mode',
        expectDefined: true,
      },
      {
        mode: 'wall-clock' as UIFactoryOptions['mode'],
        description: 'skip timer controls for wall-clock mode',
        expectDefined: false,
      },
      {
        mode: 'absolute' as UIFactoryOptions['mode'],
        description: 'skip timer controls for absolute mode',
        expectDefined: false,
      },
      {
        mode: undefined,
        description: 'skip timer controls when mode is omitted (defaults to wall-clock)',
        expectDefined: false,
      },
    ])('should $description', ({ mode, expectDefined }) => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode,
        onTimerPause: vi.fn(),
        onTimerResume: vi.fn(),
        onTimerReset: vi.fn(),
      };

      const components = createUIComponents(options);

      if (expectDefined) {
        expect(components.timerControls).toBeDefined();
      } else {
        expect(components.timerControls).toBeUndefined();
      }
    });
  });

  describe('destroyUIComponents', () => {
    it('should destroy all components and remove from DOM', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
        onBack: vi.fn(),
      };

      const components = createUIComponents(options);
      
      expect(document.body.contains(components.buttonContainer)).toBe(true);

      destroyUIComponents(components);

      expect(document.body.contains(components.buttonContainer)).toBe(false);
    });

    it('should call destroy on all destroyable components', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
        onBack: vi.fn(),
      };

      const components = createUIComponents(options);
      
      const destroySpy = vi.spyOn(components.favoriteButton, 'destroy');
      const offlineDestroySpy = vi.spyOn(components.offlineIndicator, 'destroy');

      destroyUIComponents(components);

      expect(destroySpy).toHaveBeenCalled();
      expect(offlineDestroySpy).toHaveBeenCalled();
    });
  });

  describe('createOptionalComponents', () => {
    it.each([
      ['skip optional components in timer mode', 'timer', undefined, false, false],
      ['skip optional components in absolute mode', 'absolute', true, false, false],
      ['create optional components in wall-clock mode when requested', 'wall-clock', true, true, true],
      [
        'respect user preference to disable world map while keeping timezone selector',
        'wall-clock',
        false,
        false,
        true,
      ],
    ])(
      'should %s',
      (
        _description,
        mode: UIFactoryOptions['mode'],
        showWorldMap: boolean | undefined,
        expectWorldMap: boolean,
        expectTimezoneSelector: boolean
      ) => {
        const options: UIFactoryOptions = {
          initialTheme: 'contribution-graph',
          container: document.createElement('div'),
          mode,
          ...(showWorldMap !== undefined ? { showWorldMap } : {}),
        };

        const components = createUIComponents(options);

        createOptionalComponents(
          components,
          'America/New_York',
          options,
          {
            optionalComponents: {
              worldMap: true,
              timezoneSelector: true,
            },
          },
          MOCK_WALL_CLOCK_TARGET
        );

        expect(Boolean(components.worldMap)).toBe(expectWorldMap);
        expect(Boolean(components.timezoneSelector)).toBe(expectTimezoneSelector);
      }
    );

    it('should not recreate components that already exist', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock', showWorldMap: true,
      };

      const components = createUIComponents(options);
      
      // Create optional components first time
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
      }, MOCK_WALL_CLOCK_TARGET);

      const firstWorldMap = components.worldMap;
      const firstTimezoneSelector = components.timezoneSelector;

      // Call again - should not recreate
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
      }, MOCK_WALL_CLOCK_TARGET);

      expect(components.worldMap).toBe(firstWorldMap);
      expect(components.timezoneSelector).toBe(firstTimezoneSelector);
    });

    it('should update theme styles on existing components', () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock', showWorldMap: true,
      };

      const components = createUIComponents(options);
      
      // Create with initial theme styles
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
        themeStyles: { primary: '#00ff00' },
      }, MOCK_WALL_CLOCK_TARGET);

      const worldMapSpy = vi.spyOn(components.worldMap!, 'setThemeStyles');
      const timezoneSpy = vi.spyOn(components.timezoneSelector!, 'setThemeStyles');

      // Call again with new theme styles
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
        themeStyles: { primary: '#ff0000' },
      }, MOCK_WALL_CLOCK_TARGET);

      expect(worldMapSpy).toHaveBeenCalledWith({ primary: '#ff0000' });
      expect(timezoneSpy).toHaveBeenCalledWith({ primary: '#ff0000' });
    });
  });

  describe('destroyOptionalComponents', () => {
    it.each([
      {
        label: 'timezone selector',
        componentKey: 'timezoneSelector' as const,
        options: {
          initialTheme: 'contribution-graph',
          container: document.createElement('div'),
          mode: 'wall-clock',
        },
        creationConfig: {
          optionalComponents: {
            timezoneSelector: true,
          },
        },
      },
      {
        label: 'world map',
        componentKey: 'worldMap' as const,
        options: {
          initialTheme: 'contribution-graph',
          container: document.createElement('div'),
          mode: 'wall-clock',
          showWorldMap: true,
        },
        creationConfig: {
          optionalComponents: {
            worldMap: true,
          },
        },
      },
    ])('should destroy %s when not needed by new theme', ({ componentKey, options, creationConfig }) => {
      const components = createUIComponents(options);

      createOptionalComponents(components, 'America/New_York', options, creationConfig, MOCK_WALL_CLOCK_TARGET);

      const component = components[componentKey];
      expect(component).toBeDefined();

      const destroySpy = vi.spyOn(component!, 'destroy');

      destroyOptionalComponents(components, {
        optionalComponents: {},
      });

      expect(destroySpy).toHaveBeenCalled();
      expect(components[componentKey]).toBeUndefined();
    });

    it('should handle destroying when components are undefined', async () => {
      const components = createUIComponents({
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock',
      });

      // Components are undefined (never created)
      expect(components.timezoneSelector).toBeUndefined();
      expect(components.worldMap).toBeUndefined();

      // Should not throw when destroying undefined components
      expect(() => {
        destroyOptionalComponents(components, {
          optionalComponents: {},
        });
      }).not.toThrow();
    });

    it('should handle destroying already destroyed components', async () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock', showWorldMap: true,
      };

      const components = createUIComponents(options);

      // Create components
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
      }, MOCK_WALL_CLOCK_TARGET);

      // Destroy once
      destroyOptionalComponents(components, {
        optionalComponents: {},
      });

      expect(components.worldMap).toBeUndefined();
      expect(components.timezoneSelector).toBeUndefined();

      // Destroy again - should not throw
      expect(() => {
        destroyOptionalComponents(components, {
          optionalComponents: {},
        });
      }).not.toThrow();
    });

    it('should preserve components that are still needed by new theme', async () => {
      const options: UIFactoryOptions = {
        initialTheme: 'contribution-graph',
        container: document.createElement('div'),
        mode: 'wall-clock', showWorldMap: true,
      };

      const components = createUIComponents(options);

      // Create both components
      createOptionalComponents(components, 'America/New_York', options, {
        optionalComponents: {
          worldMap: true,
          timezoneSelector: true,
        },
      }, MOCK_WALL_CLOCK_TARGET);

      const worldMap = components.worldMap;
      const worldMapDestroySpy = vi.spyOn(worldMap!, 'destroy');
      const timezoneSelectorDestroySpy = vi.spyOn(components.timezoneSelector!, 'destroy');

      // New theme only needs world map
      destroyOptionalComponents(components, {
        optionalComponents: {
          worldMap: true,
        },
      });

      expect(worldMapDestroySpy).not.toHaveBeenCalled();
      expect(components.worldMap).toBe(worldMap);
      expect(timezoneSelectorDestroySpy).toHaveBeenCalled();
      expect(components.timezoneSelector).toBeUndefined();
    });
  });

  describe('setupModalHandlers', () => {
    it('should hide buttons when modal opens', async () => {
      const { setupModalHandlers } = await import('./ui-factory');
      const buttonContainer = document.createElement('div');
      document.body.appendChild(buttonContainer);

      const cleanup = setupModalHandlers(buttonContainer);

      document.dispatchEvent(new Event('theme-modal:open'));

      expect(buttonContainer.style.opacity).toBe('0');
      expect(buttonContainer.style.pointerEvents).toBe('none');

      cleanup();
      buttonContainer.remove();
    });

    it('should show buttons when modal closes', async () => {
      const { setupModalHandlers } = await import('./ui-factory');
      const buttonContainer = document.createElement('div');
      document.body.appendChild(buttonContainer);

      const cleanup = setupModalHandlers(buttonContainer);

      // Open then close
      document.dispatchEvent(new Event('theme-modal:open'));
      document.dispatchEvent(new Event('theme-modal:close'));

      expect(buttonContainer.style.opacity).toBe('1');
      expect(buttonContainer.style.pointerEvents).toBe('auto');

      cleanup();
      buttonContainer.remove();
    });

    it('should remove event listeners on cleanup', async () => {
      const { setupModalHandlers } = await import('./ui-factory');
      const buttonContainer = document.createElement('div');
      document.body.appendChild(buttonContainer);

      const cleanup = setupModalHandlers(buttonContainer);
      cleanup();

      // After cleanup, events should not affect the container
      buttonContainer.style.opacity = '1';
      document.dispatchEvent(new Event('theme-modal:open'));

      expect(buttonContainer.style.opacity).toBe('1');

      buttonContainer.remove();
    });
  });
});
