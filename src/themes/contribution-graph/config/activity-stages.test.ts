import { afterEach, describe, expect, it } from 'vitest';
import {
  AMBIENT_BASE_DURATION_MS,
  BATCH_OVERLAP_FRACTION,
  clearActivityStageCache,
  getActivityPhase,
  getActivityStageSnapshot,
  getBatchLifetimeMs,
  getOverlapTickIntervalMs,
  getPhaseConfig,
  getPhaseConfigByName,
  getPhaseDurationMs,
  MAX_STAGGER_FRACTION,
} from './activity-stages';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

afterEach(() => {
  clearActivityStageCache();
});

describe('getActivityPhase', () => {
  it.each([
    { msRemaining: DAY_MS * 2, expected: 'calm' },
    { msRemaining: DAY_MS - 1, expected: 'calm' },
    { msRemaining: HOUR_MS, expected: 'building' },
    { msRemaining: 2 * MINUTE_MS, expected: 'building' },
    { msRemaining: 30_000, expected: 'intense' },
    { msRemaining: 0, expected: 'final' },
    { msRemaining: -1, expected: 'final' },
  ])('should return $expected when msRemaining=$msRemaining', ({ msRemaining, expected }) => {
    expect(getActivityPhase(msRemaining)).toBe(expected);
  });
});

describe('getPhaseDurationMs', () => {
  it.each([
    { phase: 'calm', multiplier: 1.8 },
    { phase: 'building', multiplier: 1.3 },
    { phase: 'intense', multiplier: 1.0 },
    { phase: 'final', multiplier: 0.7 },
    { phase: 'unknown' as never, multiplier: 1 },
  ])('should return base duration scaled for phase $phase', ({ phase, multiplier }) => {
    expect(getPhaseDurationMs(phase)).toBeCloseTo(AMBIENT_BASE_DURATION_MS * multiplier);
  });
});

describe('getPhaseConfig', () => {
  it.each([
    // PERF: Tick intervals aligned to ~50% of weighted avg CSS animation duration
    // Coverage reduced + additive overlap (20%) for GPU optimal performance
    { msRemaining: DAY_MS + 1, expected: { coveragePerMille: 4.0, turnoverRatio: 0.05, tickIntervalMs: 2500 } },
    { msRemaining: HOUR_MS, expected: { coveragePerMille: 5.0, turnoverRatio: 0.15, tickIntervalMs: 1800 } },
    { msRemaining: 59_000, expected: { coveragePerMille: 6.5, turnoverRatio: 0.2, tickIntervalMs: 1400 } },
    // Final phase: 1000ms tick aligns with countdown tick for reduced overhead
    { msRemaining: 0, expected: { coveragePerMille: 8.0, turnoverRatio: 0.22, tickIntervalMs: 1000 } },
  ])('should return config for msRemaining=$msRemaining', ({ msRemaining, expected }) => {
    expect(getPhaseConfig(msRemaining)).toEqual(expected);
  });
});

describe('getPhaseConfigByName', () => {
  it('should return matching phase values when phase is known', () => {
    // Building phase: tick aligned to ~50% of 3.59s avg animation = 1800ms
    expect(getPhaseConfigByName('building')).toMatchObject({ tickIntervalMs: 1800 });
  });

  it('should throw when phase is unknown', () => {
    expect(() => getPhaseConfigByName('missing' as never)).toThrow('Unknown activity phase');
  });
});

describe('getActivityStageSnapshot', () => {
  it('should include progress and stage index for values between thresholds', () => {
    const snapshot = getActivityStageSnapshot(30_000);

    expect(snapshot.name).toBe('intense');
    expect(snapshot.stageIndex).toBe(2);
    expect(snapshot.progress).toBeCloseTo(0.5);
  });

  it('should refresh memoization cache when cleared', () => {
    const first = getActivityStageSnapshot(120_000);
    const second = getActivityStageSnapshot(120_000);
    expect(second).toBe(first);

    clearActivityStageCache();
    const third = getActivityStageSnapshot(120_000);
    expect(third).not.toBe(second);
  });
});

describe('getBatchLifetimeMs', () => {
  it('should include stagger spread in batch lifetime', () => {
    // Animation duration × (1 + 0.32 stagger)
    const animDuration = getPhaseDurationMs('intense');
    const batchLifetime = getBatchLifetimeMs('intense');
    
    expect(batchLifetime).toBe(animDuration * (1 + MAX_STAGGER_FRACTION));
  });

  it('should scale with phase multiplier', () => {
    // calm (1.8×) should be longer than final (0.7×)
    const calmLifetime = getBatchLifetimeMs('calm');
    const finalLifetime = getBatchLifetimeMs('final');
    
    expect(calmLifetime).toBeGreaterThan(finalLifetime);
    expect(calmLifetime / finalLifetime).toBeCloseTo(1.8 / 0.7, 1);
  });
});

describe('getOverlapTickIntervalMs', () => {
  it('should be 80% of batch lifetime for smooth overlap', () => {
    const batchLifetime = getBatchLifetimeMs('building');
    const tickInterval = getOverlapTickIntervalMs('building');
    
    expect(tickInterval).toBe(Math.round(batchLifetime * BATCH_OVERLAP_FRACTION));
  });

  it('should create ~20% overlap between batches', () => {
    const batchLifetime = getBatchLifetimeMs('final');
    const tickInterval = getOverlapTickIntervalMs('final');
    
    // Overlap = batch_lifetime - tick_interval
    const overlap = batchLifetime - tickInterval;
    const overlapFraction = overlap / batchLifetime;
    
    expect(overlapFraction).toBeCloseTo(1 - BATCH_OVERLAP_FRACTION, 2);
  });
});