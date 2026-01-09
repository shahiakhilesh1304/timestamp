/**
 * Activity stage configuration using the core stage scheduler.
 *
 * Defines intensity stages that control ambient activity behavior
 * as the countdown progresses toward zero.
 */

import {
    createStageScheduler,
    type StageDefinition,
    type StageScheduler,
} from '@core/scheduling/stage-scheduler';

// =============================================================================
// TYPES
// =============================================================================

/** Activity phase names. */
export type ActivityPhase = 'calm' | 'building' | 'intense' | 'final';

/** Configuration values for each activity phase. */
export interface ActivityPhaseValues {
  /** Target ambient coverage in per-mille (‰). Example: 8 =\> 0.8%. */
  readonly coveragePerMille: number;
  /** % of active squares to replace per tick (0-1). */
  readonly turnoverRatio: number;
  /** Time between activity ticks in milliseconds. */
  readonly tickIntervalMs: number;
}

// =============================================================================
// PHASE TIMING (Shared by JS and CSS)
// =============================================================================

/** Base ambient animation duration in milliseconds (matches CSS 3.2s). */
export const AMBIENT_BASE_DURATION_MS = 3200;

/** Phase multipliers must stay in sync with CSS phase variables. */
export const PHASE_DURATION_MULTIPLIERS: Record<ActivityPhase, number> = {
  calm: 1.8,
  building: 1.3,
  intense: 1.0,
  final: 0.7,
};

/** Compute animation duration for phase (base duration × phase multiplier). */
export function getPhaseDurationMs(phase: ActivityPhase): number {
  return AMBIENT_BASE_DURATION_MS * (PHASE_DURATION_MULTIPLIERS[phase] ?? 1);
}

// =============================================================================
// STAGE DEFINITIONS
// =============================================================================

/**
 * Activity stages ordered from earliest to latest.
 *
 * Uses absolute time thresholds ('60s', '3600s') so the final minute
 * is always intense regardless of total countdown duration.
 * This creates a consistent user experience whether counting down
 * 5 minutes or 5 days.
 *
 * ## Tick Interval Optimization
 *
 * Tick intervals are aligned to ~50% of the weighted average CSS animation
 * duration for each phase. This ensures:
 * 1. New squares start ~halfway through existing animations (smooth visual flow)
 * 2. Minimal JS overhead (~60% fewer ticks vs naive implementation)
 * 3. CSS handles all animation timing - JS just kicks off batches
 *
 * ### Calculation Method
 *
 * **Step 1: CSS Base Durations** (from styles.scss)
 * ```
 * intensity-1: 3.2s (base)
 * intensity-2: 2.6s
 * intensity-3: 2.0s
 * intensity-4: 1.6s
 * ```
 *
 * **Step 2: Intensity Probability Distribution** (from INTENSITY_WEIGHTS)
 * ```
 * P(intensity-1) = 0.50 (10/20 weights)
 * P(intensity-2) = 0.30 (6/20 weights)
 * P(intensity-3) = 0.15 (3/20 weights)
 * P(intensity-4) = 0.05 (1/20 weights)
 * ```
 *
 * **Step 3: Phase Multipliers** (from PHASE_DURATION_MULTIPLIERS)
 * ```
 * calm:     1.8×
 * building: 1.3×
 * intense:  1.0×
 * final:    0.7×
 * ```
 *
 * **Step 4: Weighted Average Animation Duration**
 * ```
 * weighted_base = Σ(P(i) × base_duration(i))
 *               = 0.50×3.2 + 0.30×2.6 + 0.15×2.0 + 0.05×1.6
 *               = 1.6 + 0.78 + 0.3 + 0.08
 *               = 2.76s
 *
 * phase_duration = weighted_base × phase_multiplier
 * ```
 *
 * **Step 5: Optimal Tick Interval**
 * ```
 * optimal_tick ≈ phase_duration × 0.5
 * ```
 * (50% ensures new batch starts mid-animation for smooth overlap)
 *
 * ### Results Table
 *
 * | Phase    | Multiplier | Duration (2.76s × mult) | Tick (÷2, rounded) |
 * |----------|------------|-------------------------|-------------------|
 * | calm     | 1.8×       | 4.97s                   | 2500ms            |
 * | building | 1.3×       | 3.59s                   | 1800ms            |
 * | intense  | 1.0×       | 2.76s                   | 1400ms            |
 * | final    | 0.7×       | 1.93s                   | 1000ms*           |
 *
 * *Final phase rounded to 1000ms to align with countdown tick interval.
 *
 * @remarks
 * The scheduler will interpolate progress within each stage automatically.
 * Stages are processed in order; first matching threshold wins.
 */
const ACTIVITY_STAGES: readonly StageDefinition<ActivityPhaseValues>[] = [
  {
    name: 'calm',
    at: '86400s',  // > 1 day remaining
    // Duration: 2.76s × 1.8 = 4.97s → tick at ~50% = 2500ms
    values: { coveragePerMille: 2, turnoverRatio: 0.05, tickIntervalMs: 2500 },
  },
  {
    name: 'building',
    at: '3600s',   // > 1 hour remaining
    // Duration: 2.76s × 1.3 = 3.59s → tick at ~50% = 1800ms
    values: { coveragePerMille: 2, turnoverRatio: 0.15, tickIntervalMs: 1800 },
  },
  {
    name: 'intense',
    at: '60s',     // > 1 minute remaining
    // Duration: 2.76s × 1.0 = 2.76s → tick at ~50% = 1400ms
    values: { coveragePerMille: 4, turnoverRatio: 0.2, tickIntervalMs: 1400 },
  },
  {
    name: 'final',
    at: '0s',      // Final minute
    // Duration: 2.76s × 0.7 = 1.93s → tick at ~50% ≈ 1000ms (aligned to countdown tick)
    values: { coveragePerMille: 6, turnoverRatio: 0.22, tickIntervalMs: 1000 },
  },
];

// =============================================================================
// SCHEDULER INSTANCE
// =============================================================================

/**
 * Reference duration for threshold calculations.
 * Since we use absolute thresholds (seconds), this just needs to be
 * large enough to contain all threshold values.
 */
const REFERENCE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 1 week

/** Memoized activity stage scheduler. */
const activityScheduler: StageScheduler<ActivityPhaseValues> =
  createStageScheduler(ACTIVITY_STAGES);

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Get the current activity phase based on time remaining.
 *
 * Uses absolute time thresholds so the experience is consistent
 * regardless of total countdown duration.
 *
 * @param msRemaining - Milliseconds remaining in countdown
 * @returns Current activity phase name
 */
export function getActivityPhase(msRemaining: number): ActivityPhase {
  const snapshot = activityScheduler.getStage(msRemaining, REFERENCE_DURATION_MS);
  return snapshot.name as ActivityPhase;
}

/**
 * Get the configuration for the current activity phase.
 *
 * @param msRemaining - Milliseconds remaining in countdown
 * @returns Phase configuration values
 */
export function getPhaseConfig(msRemaining: number): ActivityPhaseValues {
  const snapshot = activityScheduler.getStage(msRemaining, REFERENCE_DURATION_MS);
  return snapshot.values;
}

/**
 * Get configuration for a named phase.
 *
 * @param phase - Phase name
 * @returns Phase configuration values
 * @throws Error if phase is unknown
 */
export function getPhaseConfigByName(phase: ActivityPhase): ActivityPhaseValues {
  const stage = ACTIVITY_STAGES.find(s => s.name === phase);
  if (!stage) {
    throw new Error(`Unknown activity phase: ${phase}`);
  }
  return stage.values;
}

/**
 * Get the full stage snapshot including progress within current stage.
 *
 * @param msRemaining - Milliseconds remaining in countdown
 * @returns Full stage snapshot with progress information
 */
export function getActivityStageSnapshot(msRemaining: number) {
  return activityScheduler.getStage(msRemaining, REFERENCE_DURATION_MS);
}

/** Clear stage scheduler cache (rarely needed with fixed reference duration). */
export function clearActivityStageCache(): void {
  activityScheduler.clearCache();
}

