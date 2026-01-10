/**
 * Performance Test Fixtures
 *
 * Provides reusable utilities for theme-agnostic performance profiling.
 * All themes use the standard `data-testid="countdown-display"` selector.
 *
 * @module e2e/fixtures/perf-fixtures
 */

import { Page } from '@playwright/test';
import fs from 'fs/promises';
import path from 'path';

import { ThemeId } from './theme-fixtures';

/** Default output directory for performance profiles. */
export const PROFILE_OUTPUT_DIR = 'test-results/perf-profiles';

/** Default countdown display selector (standardized across all themes). */
export const COUNTDOWN_DISPLAY_SELECTOR = '[data-testid="countdown-display"]';

/** CDP Profile Node type. */
interface ProfileNode {
  hitCount?: number;
  callFrame?: {
    functionName: string;
    url: string;
    lineNumber: number;
  };
}

/** CDP Profile type. */
interface Profile {
  nodes: ProfileNode[];
  samples?: number[];
}

/** Hot function summary extracted from CPU profile. */
export interface HotFunction {
  name: string;
  file: string;
  line: number | undefined;
  hitCount: number;
}

/** Memory snapshot taken during profiling. */
export interface MemorySnapshot {
  phase: string;
  timestamp: number;
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  } | null;
}

/** Memory growth analysis result. */
export interface MemoryGrowthAnalysis {
  absoluteGrowthMB: number;
  percentageGrowth: number;
  baseline: { usedMB: number; totalMB: number };
  final: { usedMB: number; totalMB: number };
}

/** Layout shift entry. */
export interface LayoutShift {
  value: number;
  hadRecentInput?: boolean;
  startTime: number;
}

/** Long task entry. */
export interface LongTask {
  duration: number;
  startTime: number;
  name?: string;
}

/** Configuration for performance tests. */
export interface PerfTestConfig {
  themeId: ThemeId;
  /** Duration in seconds for animation observation (default: 60). */
  animationDuration?: number;
  /** Number of theme switch cycles for memory leak detection (default: 5). */
  themeSwitchCycles?: number;
  /** Duration in seconds for countdown completion test (default: 60). */
  countdownDuration?: number;
}

/**
 * Ensures the profile output directory exists.
 */
export async function ensureProfileOutputDir(): Promise<void> {
  await fs.mkdir(PROFILE_OUTPUT_DIR, { recursive: true });
}

/**
 * Generates a future target date for countdown testing.
 *
 * @param secondsFromNow - How far in the future (default: 1 day)
 */
export function getTargetDate(secondsFromNow?: number): string {
  const targetDate = new Date();
  if (secondsFromNow !== undefined) {
    targetDate.setSeconds(targetDate.getSeconds() + secondsFromNow);
  } else {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  return targetDate.toISOString().slice(0, -1); // Remove Z for wall-clock mode
}

/**
 * Builds URL for a countdown theme test.
 */
export function buildThemeUrl(themeId: ThemeId, targetDate: string): string {
  return `/?theme=${themeId}&mode=wall-clock&target=${targetDate}`;
}

/**
 * Extracts hot functions from CPU profile.
 *
 * @param profile - CDP profile result
 * @param limit - Number of top functions to return (default: 30)
 */
export function extractHotFunctions(profile: Profile, limit = 30): HotFunction[] {
  return profile.nodes
    .filter((n: ProfileNode) => n.hitCount && n.hitCount > 0)
    .map((n: ProfileNode) => ({
      name: n.callFrame?.functionName || '(anonymous)',
      file: n.callFrame?.url || 'unknown',
      line: n.callFrame?.lineNumber,
      hitCount: n.hitCount!,
    }))
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, limit);
}

/**
 * Saves JSON data to the profile output directory.
 *
 * @param filename - Base filename (timestamp will be appended)
 * @param data - Data to save
 * @returns Full path to saved file
 */
export async function saveProfileData(
  filename: string,
  data: unknown
): Promise<string> {
  const filepath = path.join(PROFILE_OUTPUT_DIR, `${filename}-${Date.now()}.json`);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

/**
 * Takes a memory snapshot using the Performance Memory API.
 *
 * @param page - Playwright page
 * @param phase - Label for this snapshot phase
 */
export async function takeMemorySnapshot(
  page: Page,
  phase: string
): Promise<MemorySnapshot> {
  const memory = await page.evaluate(() => {
    if ('memory' in performance) {
      return {
        usedJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory.totalJSHeapSize,
      };
    }
    return null;
  });

  return {
    phase,
    timestamp: Date.now(),
    memory,
  };
}

/**
 * Calculates memory growth between two snapshots.
 */
export function calculateMemoryGrowth(
  baseline: MemorySnapshot,
  final: MemorySnapshot
): MemoryGrowthAnalysis | null {
  if (!baseline.memory || !final.memory) return null;

  return {
    absoluteGrowthMB:
      (final.memory.usedJSHeapSize - baseline.memory.usedJSHeapSize) / (1024 * 1024),
    percentageGrowth:
      ((final.memory.usedJSHeapSize - baseline.memory.usedJSHeapSize) /
        baseline.memory.usedJSHeapSize) *
      100,
    baseline: {
      usedMB: baseline.memory.usedJSHeapSize / (1024 * 1024),
      totalMB: baseline.memory.totalJSHeapSize / (1024 * 1024),
    },
    final: {
      usedMB: final.memory.usedJSHeapSize / (1024 * 1024),
      totalMB: final.memory.totalJSHeapSize / (1024 * 1024),
    },
  };
}

/**
 * Sets up PerformanceObserver for tracking paint events.
 */
export async function setupPaintObserver(page: Page): Promise<void> {
  await page.exposeFunction('trackPaint', () => {
    // This is handled by the test
  });

  await page.addInitScript(() => {
    new PerformanceObserver((list) => {
      list.getEntries().forEach(() => {
        if (typeof (window as unknown as { trackPaint: () => void }).trackPaint === 'function') {
          (window as unknown as { trackPaint: () => void }).trackPaint();
        }
      });
    }).observe({ type: 'paint', buffered: false });
  });
}

/**
 * Sets up PerformanceObserver for tracking layout shifts.
 */
export async function setupLayoutShiftObserver(page: Page): Promise<void> {
  await page.exposeFunction('trackLayoutShift', (_shift: LayoutShift) => {
    // This is handled by the test
  });

  await page.addInitScript(() => {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry: PerformanceEntry) => {
        const layoutEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
        if (typeof (window as unknown as { trackLayoutShift: (shift: unknown) => void }).trackLayoutShift === 'function') {
          (window as unknown as { trackLayoutShift: (shift: unknown) => void }).trackLayoutShift({
            value: layoutEntry.value,
            hadRecentInput: layoutEntry.hadRecentInput,
            startTime: entry.startTime,
          });
        }
      });
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/**
 * Sets up PerformanceObserver for tracking long tasks.
 */
export async function setupLongTaskObserver(page: Page): Promise<void> {
  await page.exposeFunction('reportLongTask', (_task: LongTask) => {
    // This is handled by the test
  });

  await page.addInitScript(() => {
    new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (typeof (window as unknown as { reportLongTask: (task: unknown) => void }).reportLongTask === 'function') {
          (window as unknown as { reportLongTask: (task: unknown) => void }).reportLongTask({
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
        }
      });
    }).observe({ type: 'longtask', buffered: true });
  });
}

/**
 * Logs hot functions to console.
 *
 * @param hotFunctions - Array of hot functions
 * @param limit - Number to display (default: 10)
 */
export function logHotFunctions(hotFunctions: HotFunction[], limit = 10): void {
  console.log('\n=== Top Hot Functions ===');
  hotFunctions.slice(0, limit).forEach((fn, i) => {
    console.log(`${i + 1}. ${fn.name} (${fn.file}:${fn.line}) - ${fn.hitCount} hits`);
  });
}

/**
 * Logs memory growth analysis to console.
 */
export function logMemoryGrowth(analysis: MemoryGrowthAnalysis): void {
  console.log('\n=== Memory Growth Analysis ===');
  console.log(`Baseline: ${analysis.baseline.usedMB.toFixed(2)} MB`);
  console.log(`Final: ${analysis.final.usedMB.toFixed(2)} MB`);
  console.log(
    `Growth: ${analysis.absoluteGrowthMB.toFixed(2)} MB (${analysis.percentageGrowth.toFixed(1)}%)`
  );

  if (analysis.absoluteGrowthMB > 10) {
    console.warn('⚠️  WARNING: Significant memory growth detected (>10 MB)');
  }
  if (analysis.percentageGrowth > 50) {
    console.warn('⚠️  WARNING: Heap size increased by >50%');
  }
}

/**
 * Switches to a theme via the theme modal.
 *
 * @param page - Playwright page
 * @param themeId - Target theme ID
 */
export async function switchToTheme(page: Page, themeId: ThemeId): Promise<void> {
  await page.getByTestId('theme-switcher').click();
  await page.waitForSelector('[data-testid="theme-modal"]', {
    state: 'visible',
    timeout: 10000,
  });
  await page.waitForTimeout(300); // Wait for modal animation

  const themeCard = page.getByTestId(`theme-card-${themeId}`);
  await themeCard.waitFor({ state: 'visible', timeout: 5000 });
  await themeCard.click({ timeout: 10000 });

  await page.waitForSelector('[data-testid="theme-modal"]', {
    state: 'hidden',
    timeout: 10000,
  });
  await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });
  await page.waitForTimeout(500); // Let theme fully render
}

/**
 * Gets all available themes except the specified one (for switch testing).
 */
export function getAlternateTheme(currentTheme: ThemeId): ThemeId {
  // Use fireworks as the default alternate, or contribution-graph if current is fireworks
  return currentTheme === 'fireworks' ? 'contribution-graph' : 'fireworks';
}
