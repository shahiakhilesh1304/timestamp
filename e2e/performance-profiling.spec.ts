/**
 * Theme Performance Profiling (CDP Deep Analysis)
 *
 * Deep performance analysis for any theme using CDP for CPU profiling,
 * memory leak detection, and render counting. These tests produce JSON output
 * that can be analyzed programmatically or shared with AI assistants.
 *
 * **Running modes:**
 * - All themes (audit): `npm run test:e2e:perf:all`
 * - Specific theme: `PERF_THEME=contribution-graph npm run test:e2e:perf`
 *
 * @remarks
 * Tests are tagged with @perf and excluded from the default E2E run.
 * They require significantly longer timeouts (2-6 minutes per test).
 */

import { expect, test } from '@playwright/test';

import {
    buildThemeUrl,
    calculateMemoryGrowth,
    COUNTDOWN_DISPLAY_SELECTOR,
    ensureProfileOutputDir,
    extractHotFunctions,
    getAlternateTheme,
    getTargetDate,
    LayoutShift,
    logHotFunctions,
    logMemoryGrowth,
    LongTask,
    MemorySnapshot,
    saveProfileData,
    switchToTheme,
    takeMemorySnapshot,
} from './fixtures/perf-fixtures';
import { getThemeIdsForTest, ThemeId } from './fixtures/theme-fixtures';

// Get theme to test from environment variable or default to all themes
const THEME_ENV = process.env.PERF_THEME;
const THEMES_TO_TEST: ThemeId[] = THEME_ENV
  ? [THEME_ENV as ThemeId]
  : getThemeIdsForTest();

// Set longer timeout for all tests in this suite (2-6 minutes needed)
test.setTimeout(360000); // 6 minutes

test.beforeAll(async () => {
  await ensureProfileOutputDir();
});

// Generate tests for each theme
for (const themeId of THEMES_TO_TEST) {
  test.describe(`${themeId} CPU Profiling @perf`, () => {
    test(`profile CPU usage during ${themeId} countdown animation`, async ({ page }) => {
      // Start CDP session for profiling
      const client = await page.context().newCDPSession(page);
      await client.send('Profiler.enable');
      await client.send('Performance.enable');

      // Navigate to theme
      const isoTarget = getTargetDate();
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Start CPU profiling
      console.log(`Starting CPU profiling for ${themeId} (60 seconds)...`);
      await client.send('Profiler.start');

      // Let the theme animate for 60 seconds
      await page.waitForTimeout(60000);

      // Stop profiling and collect data
      console.log('Stopping CPU profiling...');
      const { profile } = await client.send('Profiler.stop');

      // Save full profile
      const profilePath = await saveProfileData(`cpu-profile-${themeId}`, profile);
      console.log(`Full CPU profile saved to: ${profilePath}`);

      // Analyze hot functions
      const hotFunctions = extractHotFunctions(profile);

      // Save hot functions summary
      const summaryPath = await saveProfileData(`cpu-summary-${themeId}`, {
        theme: themeId,
        timestamp: new Date().toISOString(),
        totalSamples: profile.samples?.length || 0,
        totalNodes: profile.nodes?.length || 0,
        hotFunctions,
      });
      console.log(`CPU summary saved to: ${summaryPath}`);

      // Log top 10 hot functions
      logHotFunctions(hotFunctions, 10);

      // Basic assertions
      expect(profile.nodes).toBeDefined();
      expect(profile.samples?.length).toBeGreaterThan(0);
    });

    test(`profile CPU during theme switch to ${themeId}`, async ({ page }) => {
      const client = await page.context().newCDPSession(page);
      await client.send('Profiler.enable');

      // Navigate to a different theme first
      const alternateTheme = getAlternateTheme(themeId);
      const isoTarget = getTargetDate();

      await page.goto(buildThemeUrl(alternateTheme, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Start profiling
      await client.send('Profiler.start');

      // Switch to target theme
      console.log(`Switching from ${alternateTheme} to ${themeId}...`);
      await switchToTheme(page, themeId);

      // Wait for animations to settle
      await page.waitForTimeout(2000);

      // Stop profiling
      const { profile } = await client.send('Profiler.stop');

      // Save and analyze
      const switchProfilePath = await saveProfileData(
        `theme-switch-profile-${alternateTheme}-to-${themeId}`,
        profile
      );
      console.log(`Theme switch profile saved to: ${switchProfilePath}`);

      expect(profile.nodes?.length).toBeGreaterThan(0);
    });
  });

  test.describe(`${themeId} Memory Leak Detection @perf`, () => {
    test(`detect memory leaks during rapid ${themeId} theme switches`, async ({ page }) => {
      const client = await page.context().newCDPSession(page);
      await client.send('HeapProfiler.enable');

      // Navigate to theme
      const isoTarget = getTargetDate();
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Take baseline heap snapshot
      console.log('Taking baseline heap snapshot...');
      await client.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(500);

      const baselineSnapshot = await takeMemorySnapshot(page, 'baseline');
      const alternateTheme = getAlternateTheme(themeId);

      // Perform theme switches (5 iterations)
      console.log(`Performing 5 theme switch cycles (${themeId} ↔ ${alternateTheme})...`);
      for (let i = 0; i < 5; i++) {
        // Switch to alternate theme
        await switchToTheme(page, alternateTheme);

        // Switch back to target theme
        await switchToTheme(page, themeId);

        console.log(`  Completed ${i + 1}/5 cycles...`);
      }

      // Force garbage collection and take final snapshot
      console.log('Taking final heap snapshot...');
      await client.send('HeapProfiler.collectGarbage');
      await page.waitForTimeout(500);

      const finalSnapshot = await takeMemorySnapshot(page, 'final');

      // Calculate memory growth
      const memoryGrowth = calculateMemoryGrowth(baselineSnapshot, finalSnapshot);

      // Save memory analysis
      const memoryPath = await saveProfileData(`memory-leak-analysis-${themeId}`, {
        theme: themeId,
        timestamp: new Date().toISOString(),
        iterations: 5,
        memoryGrowth,
      });
      console.log(`Memory analysis saved to: ${memoryPath}`);

      // Log results
      if (memoryGrowth) {
        logMemoryGrowth(memoryGrowth);

        // Assertions with reasonable thresholds
        expect(memoryGrowth.absoluteGrowthMB).toBeLessThan(20); // Less than 20MB growth
        expect(memoryGrowth.percentageGrowth).toBeLessThan(100); // Less than 100% growth
      } else {
        console.log('Memory API not available (Chromium-only feature)');
      }
    });

    test(`detect memory leaks during prolonged ${themeId} animation`, async ({ page }) => {
      const client = await page.context().newCDPSession(page);
      await client.send('HeapProfiler.enable');

      // Navigate and wait for stable state
      const isoTarget = getTargetDate();
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Baseline
      console.log('Taking baseline snapshot...');
      await client.send('HeapProfiler.collectGarbage');
      const baselineSnapshot = await takeMemorySnapshot(page, 'baseline');

      // Let it animate for 60 seconds
      console.log(`Letting ${themeId} animate for 60 seconds...`);
      await page.waitForTimeout(60000);

      // Final snapshot
      console.log('Taking final snapshot...');
      await client.send('HeapProfiler.collectGarbage');
      const finalSnapshot = await takeMemorySnapshot(page, 'final');

      const memoryGrowth = calculateMemoryGrowth(baselineSnapshot, finalSnapshot);

      if (memoryGrowth) {
        console.log(
          `Memory growth during 60s animation: ${memoryGrowth.absoluteGrowthMB.toFixed(2)} MB`
        );

        // Should not grow significantly during steady-state animation
        expect(memoryGrowth.absoluteGrowthMB).toBeLessThan(10); // Less than 10MB growth over 60s
      }
    });
  });

  test.describe(`${themeId} Render Counting @perf`, () => {
    test(`count paint operations during ${themeId} countdown`, async ({ page }) => {
      let paintCount = 0;
      const layoutShifts: LayoutShift[] = [];

      // Override the exposed functions to track metrics
      await page.exposeFunction('trackPaint', () => {
        paintCount++;
      });

      await page.exposeFunction('trackLayoutShift', (shift: LayoutShift) => {
        layoutShifts.push(shift);
      });

      // Inject performance observers
      await page.addInitScript(() => {
        new PerformanceObserver((list) => {
          list.getEntries().forEach(() => {
            if (typeof (window as unknown as { trackPaint: () => void }).trackPaint === 'function') {
              (window as unknown as { trackPaint: () => void }).trackPaint();
            }
          });
        }).observe({ type: 'paint', buffered: false });

        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: PerformanceEntry) => {
            const layoutEntry = entry as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
            };
            if (
              typeof (window as unknown as { trackLayoutShift: (shift: unknown) => void })
                .trackLayoutShift === 'function'
            ) {
              (window as unknown as { trackLayoutShift: (shift: unknown) => void }).trackLayoutShift(
                {
                  value: layoutEntry.value,
                  hadRecentInput: layoutEntry.hadRecentInput,
                  startTime: entry.startTime,
                }
              );
            }
          });
        }).observe({ type: 'layout-shift', buffered: true });
      });

      // Navigate to theme
      const isoTarget = getTargetDate();
      console.log(`Loading ${themeId} theme...`);
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Observe for 60 seconds
      console.log('Observing renders for 60 seconds...');
      await page.waitForTimeout(60000);

      // Calculate metrics
      const expectedMaxPaints = 3600; // 60 FPS * 60 seconds = 3600 frames
      const paintRate = paintCount / 60; // Paints per second
      const totalCLS = layoutShifts.reduce((sum, s) => sum + s.value, 0);

      // Save render analysis
      const renderPath = await saveProfileData(`render-analysis-${themeId}`, {
        theme: themeId,
        timestamp: new Date().toISOString(),
        duration: 60,
        paintCount,
        paintRate,
        layoutShiftCount: layoutShifts.length,
        layoutShifts: layoutShifts.slice(0, 20), // First 20 shifts
        totalLayoutShiftValue: totalCLS,
      });
      console.log(`Render analysis saved to: ${renderPath}`);

      // Log results
      console.log('\n=== Render Analysis ===');
      console.log(`Paint events: ${paintCount}`);
      console.log(`Paint rate: ${paintRate.toFixed(1)} paints/sec`);
      console.log(`Layout shifts: ${layoutShifts.length}`);
      console.log(`Total CLS: ${totalCLS.toFixed(4)}`);
      console.log(`Expected max paints (60fps): ${expectedMaxPaints}`);

      if (paintCount > expectedMaxPaints * 1.5) {
        console.warn(
          `⚠️  WARNING: Excessive paint operations (${paintCount} vs expected max ${expectedMaxPaints})`
        );
      }

      // Assertions
      expect(paintCount).toBeGreaterThan(0);
      expect(paintCount).toBeLessThan(expectedMaxPaints * 2);
      expect(totalCLS).toBeLessThan(0.1); // Good CLS score
    });

    test(`detect excessive re-renders on ${themeId} interaction`, async ({ page }) => {
      let mutationCount = 0;

      await page.exposeFunction('trackMutation', () => {
        mutationCount++;
      });

      // Track DOM mutations
      await page.addInitScript(() => {
        const observer = new MutationObserver((_mutations) => {
          if (
            typeof (window as unknown as { trackMutation: () => void }).trackMutation === 'function'
          ) {
            (window as unknown as { trackMutation: () => void }).trackMutation();
          }
        });

        // Wait for countdown display to appear
        const checkForCountdown = setInterval(() => {
          const countdown = document.querySelector('[data-testid="countdown-display"]');
          if (countdown) {
            clearInterval(checkForCountdown);
            observer.observe(countdown, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true,
            });
          }
        }, 100);
      });

      // Navigate
      const isoTarget = getTargetDate();
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Reset counter after initial render
      mutationCount = 0;
      await page.waitForTimeout(1000);

      // Interact: hover over grid
      console.log('Hovering over countdown elements...');
      const countdownEl = page.locator(COUNTDOWN_DISPLAY_SELECTOR);
      const box = await countdownEl.boundingBox();

      if (box) {
        for (let i = 0; i < 20; i++) {
          const x = box.x + Math.random() * box.width;
          const y = box.y + Math.random() * box.height;
          await page.mouse.move(x, y);
          await page.waitForTimeout(50);
        }
      }

      console.log(`DOM mutations during interaction: ${mutationCount}`);

      // Should not have excessive mutations from hover
      expect(mutationCount).toBeLessThan(500); // Generous threshold
    });
  });

  test.describe(`${themeId} Countdown Completion @perf`, () => {
    test(`profile 1-minute ${themeId} countdown completion cycle`, async ({ page }) => {
      const metrics = {
        paintEvents: 0,
        layoutShifts: [] as LayoutShift[],
        longTasks: [] as LongTask[],
        memorySnapshots: [] as MemorySnapshot[],
      };

      // Setup CDP for memory monitoring
      const client = await page.context().newCDPSession(page);
      await client.send('Performance.enable');

      // Track performance metrics
      await page.exposeFunction('trackPaint', () => {
        metrics.paintEvents++;
      });

      await page.exposeFunction('trackLayoutShift', (shift: LayoutShift) => {
        metrics.layoutShifts.push(shift);
      });

      await page.exposeFunction('trackLongTask', (task: LongTask) => {
        metrics.longTasks.push(task);
      });

      await page.addInitScript(() => {
        new PerformanceObserver((list) => {
          list.getEntries().forEach(() => {
            if (typeof (window as unknown as { trackPaint: () => void }).trackPaint === 'function') {
              (window as unknown as { trackPaint: () => void }).trackPaint();
            }
          });
        }).observe({ type: 'paint', buffered: false });

        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry: PerformanceEntry) => {
            const layoutEntry = entry as PerformanceEntry & { value: number };
            if (
              typeof (window as unknown as { trackLayoutShift: (shift: unknown) => void })
                .trackLayoutShift === 'function'
            ) {
              (window as unknown as { trackLayoutShift: (shift: unknown) => void }).trackLayoutShift(
                {
                  value: layoutEntry.value,
                  startTime: entry.startTime,
                }
              );
            }
          });
        }).observe({ type: 'layout-shift', buffered: true });

        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (
              typeof (window as unknown as { trackLongTask: (task: unknown) => void })
                .trackLongTask === 'function'
            ) {
              (window as unknown as { trackLongTask: (task: unknown) => void }).trackLongTask({
                duration: entry.duration,
                startTime: entry.startTime,
              });
            }
          });
        }).observe({ type: 'longtask', buffered: true });
      });

      // Navigate to 1-minute countdown
      const isoTarget = getTargetDate(60);
      console.log(`Starting 1-minute ${themeId} countdown...`);
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });

      // Take memory snapshots at intervals
      const addSnapshot = async (phase: string) => {
        const snapshot = await takeMemorySnapshot(page, phase);
        metrics.memorySnapshots.push(snapshot);
      };

      // Phase 1: Pre-countdown (0-20s)
      console.log('Phase 1: Pre-countdown (0-20s)...');
      await addSnapshot('pre-countdown-start');
      await page.waitForTimeout(20000);
      await addSnapshot('pre-countdown-end');

      // Phase 2: Mid-countdown (20-40s)
      console.log('Phase 2: Mid-countdown (20-40s)...');
      await page.waitForTimeout(20000);
      await addSnapshot('mid-countdown');

      // Phase 3: Final countdown (40-60s)
      console.log('Phase 3: Final countdown (40-60s)...');
      await page.waitForTimeout(20000);
      await addSnapshot('final-seconds');

      // Phase 4: Countdown completion & celebration (60-75s)
      console.log('Phase 4: Countdown reaches zero & celebration (60-75s)...');
      await page.waitForTimeout(15000);
      await addSnapshot('celebration');

      // Phase 5: Post-celebration (75-90s)
      console.log('Phase 5: Post-celebration cooldown (75-90s)...');
      await page.waitForTimeout(15000);
      await addSnapshot('post-celebration');

      // Analyze memory growth across phases
      const baseline = metrics.memorySnapshots[0];
      const memoryGrowth = metrics.memorySnapshots.slice(1).map((snapshot) => {
        if (!snapshot.memory || !baseline.memory) return null;

        return {
          phase: snapshot.phase,
          growthMB: (snapshot.memory.usedJSHeapSize - baseline.memory.usedJSHeapSize) / (1024 * 1024),
          totalMB: snapshot.memory.usedJSHeapSize / (1024 * 1024),
        };
      }).filter(Boolean);

      // Save comprehensive report
      const reportPath = await saveProfileData(`countdown-completion-${themeId}`, {
        theme: themeId,
        timestamp: new Date().toISOString(),
        duration: 90,
        countdownDuration: 60,
        phases: [
          { name: 'Pre-countdown', duration: '0-20s' },
          { name: 'Mid-countdown', duration: '20-40s' },
          { name: 'Final countdown', duration: '40-60s' },
          { name: 'Celebration', duration: '60-75s' },
          { name: 'Post-celebration', duration: '75-90s' },
        ],
        metrics: {
          totalPaints: metrics.paintEvents,
          layoutShiftCount: metrics.layoutShifts.length,
          totalLayoutShiftValue: metrics.layoutShifts.reduce((sum, s) => sum + s.value, 0),
          longTaskCount: metrics.longTasks.length,
          totalBlockedTime: metrics.longTasks.reduce((sum, t) => sum + t.duration, 0),
        },
        memoryGrowth,
        memorySnapshots: metrics.memorySnapshots,
      });

      console.log(`\n=== ${themeId} Countdown Completion Analysis ===`);
      console.log(`Total duration: 90 seconds`);
      console.log(`Paint events: ${metrics.paintEvents}`);
      console.log(`Layout shifts: ${metrics.layoutShifts.length}`);
      console.log(`Long tasks: ${metrics.longTasks.length}`);

      if (memoryGrowth.length > 0) {
        console.log(`\nMemory Growth by Phase:`);
        memoryGrowth.forEach((m) => {
          if (m) {
            console.log(`  ${m.phase}: +${m.growthMB.toFixed(2)} MB (total: ${m.totalMB.toFixed(2)} MB)`);
          }
        });

        const maxGrowth = Math.max(...memoryGrowth.map((m) => m?.growthMB ?? 0));
        console.log(`\nMax memory growth: ${maxGrowth.toFixed(2)} MB`);

        // Assertions
        expect(maxGrowth).toBeLessThan(15); // Allow slightly higher for celebration phase
      }

      console.log(`\nReport saved: ${reportPath}`);
    });
  });

  test.describe(`${themeId} Long Task Detection @perf`, () => {
    test(`detect long tasks blocking main thread in ${themeId}`, async ({ page }) => {
      const longTasks: LongTask[] = [];

      await page.exposeFunction('reportLongTask', (task: LongTask) => {
        longTasks.push(task);
      });

      await page.addInitScript(() => {
        new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (
              typeof (window as unknown as { reportLongTask: (task: unknown) => void })
                .reportLongTask === 'function'
            ) {
              (window as unknown as { reportLongTask: (task: unknown) => void }).reportLongTask({
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
              });
            }
          });
        }).observe({ type: 'longtask', buffered: true });
      });

      // Navigate
      const isoTarget = getTargetDate();
      console.log(`Loading ${themeId} and observing for long tasks (60 seconds)...`);
      await page.goto(buildThemeUrl(themeId, isoTarget));
      await page.waitForSelector(COUNTDOWN_DISPLAY_SELECTOR, { timeout: 10000 });
      await page.waitForTimeout(60000);

      // Save long task analysis
      const totalBlocked = longTasks.reduce((sum, t) => sum + t.duration, 0);
      const longTaskPath = await saveProfileData(`long-tasks-${themeId}`, {
        theme: themeId,
        timestamp: new Date().toISOString(),
        longTaskCount: longTasks.length,
        longTasks: longTasks.map((t) => ({
          duration: t.duration.toFixed(1),
          startTime: t.startTime.toFixed(1),
        })),
        totalBlockedTime: totalBlocked,
      });
      console.log(`Long task analysis saved to: ${longTaskPath}`);

      console.log('\n=== Long Task Analysis ===');
      console.log(`Long tasks detected: ${longTasks.length}`);
      if (longTasks.length > 0) {
        console.log(`Total blocked time: ${totalBlocked.toFixed(1)}ms`);
        console.log(`Average task duration: ${(totalBlocked / longTasks.length).toFixed(1)}ms`);

        const longest = longTasks.reduce((max, t) => (t.duration > max.duration ? t : max));
        console.log(`Longest task: ${longest.duration.toFixed(1)}ms`);

        if (longTasks.length > 10) {
          console.warn(`⚠️  WARNING: Many long tasks detected (${longTasks.length})`);
        }
      }

      // Should have minimal long tasks during steady-state animation
      expect(longTasks.length).toBeLessThan(15); // Allow slightly more for complex themes
    });
  });
}
