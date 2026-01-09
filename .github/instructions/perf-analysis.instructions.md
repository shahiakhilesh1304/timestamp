---
applyTo: "**/*.{ts,tsx,spec.ts}"
description: Performance monitoring and analysis guidelines for agents
---

# Performance Analysis Instructions

Guidelines for agents when analyzing or optimizing application performance.

## Available Tools

### Live Monitoring (Dev Mode)

The app includes a performance overlay accessible via `?perf=1` URL parameter:

- **FPS**: Real-time frames per second
- **Frame time**: Milliseconds per frame
- **DOM Nodes**: Total element count
- **INP**: Interaction to Next Paint

### E2E Performance Tests

Run performance tests to check for regressions:

```bash
# Performance tests only (long-running)
npm run test:e2e:perf
```

### Window API

When monitoring is active, `window.__perfMonitor` exposes:

```typescript
interface PerfMonitor {
  getSnapshot(): PerfSnapshot;
  getStats(metric: MetricType): MetricStats | null;
  isActive(): boolean;
}
```

## Performance Budgets

| Metric | Budget | Notes |
|--------|--------|-------|
| First paint | <1500ms | Landing or countdown page |
| Theme switch | <500ms | Full transition |
| Menu animation | <300ms | Mobile menu open/close |
| Grid rebuild | <300ms | After resize |
| DOM nodes | <10,000 | Total elements |
| FPS (p95) | ≥50 | During animations |
| INP | <200ms | Interaction latency |

## When to Check Performance

- After modifying hot paths (countdown tick, grid operations)
- After adding new DOM elements
- After changing animations or transitions
- After modifying theme lifecycle code
- When users report sluggishness

## Optimization Checklist

### CSS Performance

- [ ] Animations use only `opacity` and `transform`
- [ ] No `box-shadow` transitions on many elements
- [ ] `will-change` only on containers, not children
- [ ] `contain: strict` on grids with many children

### JavaScript Performance

- [ ] No inline style changes in hot loops
- [ ] DOM reads batched before DOM writes
- [ ] RAF used only for visual updates, not logic
- [ ] Intervals at 10Hz or less for background work
- [ ] Ring buffers for metrics (bounded size)

### Memory

- [ ] Event listeners cleaned up on destroy
- [ ] Intervals/timeouts cleared on destroy
- [ ] No growing arrays in long-running loops
- [ ] Theme switch doesn't leak memory

## Files to Reference

- `src/core/utils/perf-monitor.ts` - Monitoring API
- `src/core/utils/perf-types.ts` - Type definitions
- `e2e/performance-profiling.spec.ts` - Comprehensive E2E performance tests with CDP profiling
- `.github/instructions/complex-theme-patterns.instructions.md` - Advanced theme patterns and performance

## Reporting Findings

When reporting performance issues, include:

1. Which budget was exceeded
2. Measured value vs budget
3. Reproduction steps
4. Suggested fix with code pattern from guidelines

---

## Examples

### Performance Check Command

```bash
# Performance tests only (long-running)
npm run test:e2e:perf
```

### Using the Window API

```typescript
// Check if monitoring is active and get snapshot
if (window.__perfMonitor?.isActive()) {
  const snapshot = window.__perfMonitor.getSnapshot();
  console.log(`FPS: ${snapshot.fps}, DOM Nodes: ${snapshot.domNodes}`);
}
```

### Optimization Check

```typescript
// ✅ Correct: opacity-only animation
element.style.transition = 'opacity 150ms ease-out';
element.style.opacity = '0';

// ❌ Avoid: paint-heavy properties
element.style.transition = 'background-color 150ms, box-shadow 150ms';
```

---

## Anti-Patterns

| Anti-Pattern | Why It's Problematic | Better Approach |
|--------------|---------------------|------------------|
| Ignoring performance budgets | Regressions slip through unnoticed | Check budgets after hot path changes |
| `will-change` on many elements | Creates compositor layer per element | Apply to containers only |
| Animating `background-color` | Triggers paint on every frame | Use `opacity` or `transform` |
| Running full E2E suite for perf | Too slow for iteration | Use `test:e2e:perf` for performance tests only |
| Missing cleanup verification | Memory leaks accumulate | Always verify `getResourceTracker()` |

---

## References

### Project Documentation
- [complex-theme-patterns.instructions.md](.github/instructions/complex-theme-patterns.instructions.md) - Complex theme patterns
- [themes.instructions.md](.github/instructions/themes.instructions.md) - Theme lifecycle and cleanup patterns
- [testing.instructions.md](.github/instructions/testing.instructions.md) - Performance test patterns

### External Resources
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/) - Profiling guide
- [web.dev INP](https://web.dev/articles/inp) - Interaction to Next Paint
- [CSS Containment](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment) - Browser optimization hints
