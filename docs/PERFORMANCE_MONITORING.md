# Performance Monitoring Guide

This guide explains how to use the performance monitoring infrastructure to identify bottlenecks in the Timestamp app.

## Quick Start

### Enable Live Performance Overlay

The performance overlay is available in development mode. Enable it by adding
`?perf=1` to the URL (not available in production builds).

### What's Displayed

The overlay shows real-time metrics:

| Metric | Description | Target |
|--------|-------------|--------|
| **FPS** | Frames per second | ≥55 (green), 45-55 (yellow), <45 (red) |
| **Frame** | Time per frame in ms | <16ms for 60fps |
| **DOM Nodes** | Total DOM elements | <10,000 |
| **INP** | Interaction to Next Paint | <200ms |

### Expanded Details

Click "Show Details" to see:

- **FPS Statistics**: p50, p95, min, max values
- **Recent Operations**: Timestamped log of measured operations

## Programmatic Usage

### Recording Custom Operations

```typescript
import { perfMonitor } from '@core/perf/perf-monitor';

// Record operations with label
perfMonitor.recordOperation('my-operation', 42.5);

// Record raw metrics
perfMonitor.record('fps', 60);
perfMonitor.record('tick', 1.5);
```

### Getting Statistics

```typescript
import { perfMonitor } from '@core/perf/perf-monitor';

// Get stats for a specific metric
const fpsStats = perfMonitor.getStats('fps');
console.log(`FPS p95: ${fpsStats?.p95}`);

// Get full snapshot
const snapshot = perfMonitor.getSnapshot();
console.log(`DOM nodes: ${snapshot.domNodes}`);
console.log(`Long tasks: ${snapshot.longTaskCount}`);
```

### Subscribing to Updates

```typescript
const unsubscribe = perfMonitor.subscribe((snapshot) => {
  if (snapshot.fps < 30) {
    console.warn('Low FPS detected!');
  }
});

// Later: stop listening
unsubscribe();
```

## Metric Types

| Type | Description | Source |
|------|-------------|--------|
| `fps` | Frames per second | RAF sampler (2s buckets) |
| `inp` | Interaction to Next Paint | PerformanceObserver |
| `longtask` | Tasks >50ms | PerformanceObserver |
| `tick` | Countdown tick duration | Sampled measurement |
| `theme-switch` | Theme transition time | Manual measurement |
| `grid-rebuild` | Grid rebuild time | Manual measurement |
| `memory` | Memory usage (MB) | Chrome-only API |
| `activity-active` | Active ambient contributions | Activity animation system |
| `activity-pending` | Pending fades queued | Activity animation system |
| `activity-valid` | Valid placement squares | Activity animation system |

## E2E Performance Tests

Performance tests are in `e2e/performance.spec.ts` and `e2e/contribution-graph-performance.spec.ts`. Run them with:

```bash
# Performance tests only (long-running, tagged with @perf)
npm run test:e2e:perf

# Or run all E2E tests including performance tests
npm run test:e2e:full
```

### Test Scenarios

| Test | Budget | Description |
|------|--------|-------------|
| Landing page load | <1500ms | Initial paint time |
| Countdown load | <1500ms | Deep link load time |
| DOM node count | <10,000 | Memory/performance indicator |
| Theme switch | <600ms (dev), <2000ms (CI) | Full transition time |
| Menu animation | <300ms | Mobile menu open/close |
| Resize rebuild | <500ms | Grid rebuild after resize |
| FPS (p95) | ≥50 | Sustained frame rate |
| Memory growth | <8MB | 10 theme switches, check heap delta |
| Hover interaction FPS | ≥30 (≥15 high-res) | FPS during mouse movement over grid |

### Adding New Performance Tests

```typescript
test('my operation is fast', async ({ page }) => {
  await navigateToCountdown(page);
  
  const duration = await measureOperation(page, async () => {
    await doSomething(page);
  });
  
  expect(duration).toBeLessThan(MAX_BUDGET_MS);
  console.log(`My operation: ${duration.toFixed(1)}ms`);
});
```

## Production Considerations

All performance monitoring code is:

1. **Gated by `__PROFILING__` flag**: Defined in `vite.config.ts`
2. **Tree-shaken in production**: Dead code elimination removes it
3. **Null-object pattern**: Production builds get no-op implementations

To verify production build is clean:

```bash
npm run build
# Check bundle size - should not include perf-monitor code
```

## Troubleshooting

### Overlay Not Appearing

1. Ensure you're in development mode (`npm run dev`)
2. Check console for `[PerfOverlay] Available` message
3. Use `?perf=1` in URL (most reliable method)
4. Keyboard shortcut `Ctrl+Shift+P` may conflict with browser shortcuts on some systems

### Low FPS

Check these common causes:

1. **Too many DOM nodes**: Target <10,000
2. **Paint-heavy animations**: Use `opacity` and `transform` only
3. **Long tasks blocking main thread**: Check "Recent Operations"
4. **Memory pressure**: Look for memory leaks

### High INP

Interaction to Next Paint issues usually come from:

1. **Synchronous layout thrashing**: Batch DOM reads/writes
2. **Heavy click handlers**: Defer non-critical work
3. **Third-party scripts**: Check for blocking resources

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    PerfMonitor Module                         │
│  (Gated by __PROFILING__ - tree-shaken in production)        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ FPS Probe   │  │ INP Observer│  │ LongTask Obs│          │
│  │ (RAF-based) │  │ (PerfObs)   │  │ (PerfObs)   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │   Central Recorder    │                       │
│              │  (Ring buffers x 256) │                       │
│              └───────────┬───────────┘                       │
│                          │                                   │
│         ┌────────────────┼────────────────┐                  │
│         ▼                ▼                ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Dev Overlay │  │window.      │  │ E2E Tests   │          │
│  │ (UI)        │  │__perfMonitor│  │ (Playwright)│          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Agent Integration

The performance monitoring infrastructure exposes data that can be used by Copilot agents for automated performance analysis.

### Exposed Global

When monitoring is active, `window.__perfMonitor` provides access to the full API:

```typescript
// In E2E tests or browser console
const monitor = window.__perfMonitor;
const snapshot = monitor.getSnapshot();
console.log(snapshot.fps, snapshot.domNodes, snapshot.operations);
```

### Using with Playwright E2E Tests

Agents can leverage performance data in E2E tests:

```typescript
// Get performance snapshot from running app
const snapshot = await page.evaluate(() => {
  return window.__perfMonitor?.getSnapshot();
});

if (snapshot) {
  console.log(`FPS: ${snapshot.fps}`);
  console.log(`DOM Nodes: ${snapshot.domNodes}`);
  console.log(`Recent ops:`, snapshot.operations);
}
```

### Agent Workflow for Performance Analysis

1. **Run E2E tests with performance collection**:

   ```bash
   npm run test:e2e:perf
   ```

2. **Check for budget violations** in test output

3. **Use Visual Debug agent** to screenshot and inspect slow operations

4. **Cross-reference** with [complex-theme-patterns.instructions.md](
   ../../.github/instructions/complex-theme-patterns.instructions.md)
   for optimization patterns

### Performance Analysis Prompt

For comprehensive performance analysis, agents can use:

```text
Analyze performance of [feature/component]:
1. Run `npm run test:e2e:perf`
2. Check DOM node count and FPS metrics
3. Identify any budget violations
4. Suggest optimizations based on complex-theme-patterns.instructions.md
```

## Related Documentation

- [Complex Theme Patterns](../../.github/instructions/complex-theme-patterns.instructions.md)
- [Theme Development Guide](../THEME_DEVELOPMENT.md)
