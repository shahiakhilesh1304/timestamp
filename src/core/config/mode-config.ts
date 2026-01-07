/**
 * Mode Configuration - Single source of truth for mode metadata and behavior.
 */

import type { CountdownMode } from '@core/types';

/** Core mode behavior configuration (non-derived properties). @internal */
interface ModeBehaviorConfig {
  /** Timezone relevant during landing page configuration (timer: false, others: true). */
  readonly timezoneRelevantDuringConfiguration: boolean;
  /** Timezone relevant during countdown display (only wall-clock: true). */
  readonly timezoneRelevantDuringCountdown: boolean;
}

/** Complete mode configuration including UI metadata and derived properties. */
export interface ModeConfig extends ModeBehaviorConfig {
  /** Display name for UI (e.g., "Local Time", "Same Moment"). */
  readonly displayName: string;
  /** Technical subtitle for mode card (e.g., "Wall clock"). */
  readonly subtitle: string;
  /** Emoji icon for visual identification. */
  readonly icon: string;
  /** Short description for landing page radio option. */
  readonly description: string;
  /** Accessible label for screen readers. */
  readonly ariaLabel: string;
  /** DERIVED: World map available (= timezoneRelevantDuringCountdown). */
  readonly worldMapAvailable: boolean;
  /** Button text for starting countdown. */
  readonly startButtonText: string;
  /** Test ID prefix for E2E tests. */
  readonly testIdPrefix: string;
  /** Duration-based mode (timer). */
  readonly isDurationBased: boolean;
  /** Wall-clock mode (timezone-relative targets). */
  readonly isWallClock: boolean;
  /** Absolute mode (fixed UTC instant). */
  readonly isAbsolute: boolean;
  /** DERIVED: Has date input (= !isDurationBased). */
  readonly hasDateInput: boolean;
}

/** Mode configuration registry (raw data without derived properties). @internal */
const MODE_CONFIG_RAW: Record<CountdownMode, Omit<ModeConfig, 'worldMapAvailable' | 'hasDateInput'>> = {
  'wall-clock': {
    displayName: 'Local Time',
    subtitle: 'Wall clock',
    icon: '🏠',
    description: 'Per timezone, e.g. New Year\'s Eve',
    ariaLabel: 'Local Time mode: Each timezone celebrates separately',
    timezoneRelevantDuringConfiguration: true,
    timezoneRelevantDuringCountdown: true,
    startButtonText: 'Start Countdown',
    testIdPrefix: 'landing-mode-wall-clock',
    isDurationBased: false,
    isWallClock: true,
    isAbsolute: false,
  },
  'absolute': {
    displayName: 'Same Moment',
    subtitle: 'Absolute time',
    icon: '🌐',
    description: 'One instant, e.g. product launch',
    ariaLabel: 'Same Moment mode: Everyone counts down together',
    timezoneRelevantDuringConfiguration: true,
    timezoneRelevantDuringCountdown: false,
    startButtonText: 'Start Countdown',
    testIdPrefix: 'landing-mode-absolute',
    isDurationBased: false,
    isWallClock: false,
    isAbsolute: true,
  },
  'timer': {
    displayName: 'Timer',
    subtitle: 'Your countdown',
    icon: '⏱️',
    description: 'Fixed duration countdown',
    ariaLabel: 'Timer mode: Count down a fixed duration',
    timezoneRelevantDuringConfiguration: false,
    timezoneRelevantDuringCountdown: false,
    startButtonText: 'Start Timer',
    testIdPrefix: 'landing-mode-timer',
    isDurationBased: true,
    isWallClock: false,
    isAbsolute: false,
  },
} as const;

/** Mode configuration registry with derived properties. SINGLE SOURCE OF TRUTH. */
export const MODE_CONFIG: Record<CountdownMode, ModeConfig> = Object.fromEntries(
  (Object.entries(MODE_CONFIG_RAW) as [CountdownMode, Omit<ModeConfig, 'worldMapAvailable' | 'hasDateInput'>][]).map(
    ([mode, config]) => [
      mode,
      {
        ...config,
        worldMapAvailable: config.timezoneRelevantDuringCountdown,
        hasDateInput: !config.isDurationBased,
      },
    ]
  )
) as Record<CountdownMode, ModeConfig>;

/** Get configuration for a countdown mode. @public */
export function getModeConfig(mode: CountdownMode): ModeConfig {
  return MODE_CONFIG[mode];
}

// ============================================================================
// Semantic Helpers
// ============================================================================

/**
 * Check if countdown page should show timezone switcher for this mode.
 * Also used to determine if URL should include `tz=` parameter.
 * @public
 */
export function shouldShowTimezoneSwitcherOnCountdown(mode: CountdownMode): boolean {
  return MODE_CONFIG[mode].timezoneRelevantDuringCountdown;
}

/** Alias for shouldShowTimezoneSwitcherOnCountdown - used in URL building context. @public */
export const shouldIncludeTimezoneInUrl = shouldShowTimezoneSwitcherOnCountdown;

/** Check if world map is available for mode with optional user override. @public */
export function worldMapAvailableForMode(mode: CountdownMode, userConfig?: boolean): boolean {
  return MODE_CONFIG[mode].worldMapAvailable && userConfig !== false;
}

/** Modes in display order (landing page). @public */
export const MODE_ORDER: readonly CountdownMode[] = ['wall-clock', 'absolute', 'timer'] as const;

/**
 * Type guard to validate a value is a known CountdownMode.
 * Prevents prototype pollution by ensuring only literal mode strings are accepted.
 * @public
 */
export function isValidMode(value: unknown): value is CountdownMode {
  return MODE_ORDER.includes(value as CountdownMode);
}

/** Get all mode configs in display order for UI iteration. @public */
export function getAllModeConfigs(): ReadonlyArray<{ mode: CountdownMode; config: ModeConfig }> {
  return MODE_ORDER.map(mode => ({ mode, config: MODE_CONFIG[mode] }));
}
