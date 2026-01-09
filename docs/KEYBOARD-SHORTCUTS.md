# Keyboard Shortcuts Guide

Timestamp supports keyboard shortcuts for hands-free timer control in **timer mode only**. This guide covers all available shortcuts, their behavior, and best practices.

## Quick Reference

| Key | Action | Mode | Context |
|-----|--------|------|---------|
| `Space` | Toggle play/pause | Timer | Global (unless typing or modal open) |
| `Enter` | Reset timer | Timer | Global (unless typing or modal open) |
| `R` (or `r`) | Reset timer | Timer | Global (unless typing or modal open) |
| `Escape` | Exit fullscreen | All | Browser default + custom handler |

## Detailed Behavior

### Space - Play/Pause Toggle

**What it does:**
- Pauses a running timer
- Resumes a paused timer
- Preserves remaining time when paused

**Keyboard accessibility:**
- Works in both fullscreen and normal view
- Calls `preventDefault()` to avoid page scrolling
- Disabled when typing in text fields
- Disabled when modal dialogs are open

**Visual feedback:**
- Timer button updates from "Pause timer" ↔ "Resume timer"
- `aria-pressed` attribute changes for screen readers
- Countdown display continues updating when playing, freezes when paused

**Examples:**
```
Playing (5:00) → Press Space → Paused (5:00)
Paused (3:42) → Press Space → Playing (3:42 and counting)
```

### Enter - Reset Timer

**What it does:**
- Resets timer to original configured duration
- Preserves play/pause state (if paused, stays paused after reset)
- Resets from celebration state back to countdown

**Keyboard accessibility:**
- Works in both fullscreen and normal view
- Disabled when typing in text fields
- Disabled when modal dialogs are open

**Visual feedback:**
- Countdown display jumps back to original duration
- Screen reader announces "Timer reset"
- If timer was celebrating, returns to normal countdown view

**Examples:**
```
Timer at 2:30 → Press Enter → Resets to 5:00 (original duration)
Timer celebrating → Press Enter → Back to 5:00 countdown
```

### R - Reset Timer (Alternative)

**What it does:**
- Identical to Enter key
- Case-insensitive (works with `r` or `R`)
- Provided as an ergonomic alternative for one-handed use

**Why both Enter and R?**
- Enter: Standard "action" key, familiar to most users
- R: Mnemonic for "Reset", easier to reach one-handed

### Escape - Exit Fullscreen

**What it does:**
- Exits fullscreen mode
- Returns to normal countdown view
- Browser default behavior, also enhanced with custom handler

**Notes:**
- Works in all countdown modes (not just timer)
- Cannot be prevented (browser security requirement)
- Timer continues running when exiting fullscreen

## When Shortcuts Are Disabled

Keyboard shortcuts are **automatically disabled** in these scenarios to prevent conflicts:

### 1. Text Input Focus
When typing in any text-accepting element:
- `<input type="text">`, `<input type="email">`, `<input type="password">`, etc.
- `<textarea>` elements
- Any element with `contenteditable="true"`

**Why?** Prevents shortcuts from interfering with normal typing. For example, you don't want Space to pause the timer while entering a custom message.

### 2. Modal Dialogs Open
When any modal is open (detected via `[aria-modal="true"]`):
- Theme picker modal
- Any future modal dialogs

**Why?** Modals have their own keyboard interactions (Escape to close, Tab to navigate). Global shortcuts should not interfere with modal workflows.

### 3. Non-Timer Modes
Shortcuts only work in **timer mode**:
- Wall-clock mode: No shortcuts (different use case)
- Absolute mode: No shortcuts (different use case)
- Timer mode: All shortcuts enabled ✓

**Why?** Wall-clock and absolute modes don't have play/pause/reset concepts — they count to a specific calendar date/time.

## Fullscreen Timer Controls

In **timer mode + fullscreen**, moving your mouse reveals timer controls alongside the exit button:

- **Play/Pause button**: Click to toggle (or use Space)
- **Reset button**: Click to reset (or use Enter/R)
- **Exit Fullscreen button**: Click to exit (or use Escape)

**Auto-hide behavior:**
- Controls appear on mouse movement
- Auto-hide after 3 seconds of no mouse activity
- Stay visible while hovering over them (WCAG 1.4.13 compliance)
- If a control has keyboard focus when auto-hide triggers, focus moves to document body

**Focus order** (Tab key):
1. Play/Pause button
2. Reset button  
3. Exit Fullscreen button

## Accessibility Features

### Screen Reader Support

All keyboard actions announce their result via `aria-live="polite"` region:
- "Timer paused"
- "Timer resumed"
- "Timer reset"

Announcements are throttled (max 1 per second) to prevent spam.

### Button States

Timer control buttons have proper ARIA attributes:
- `aria-label`: Describes current state ("Pause timer" or "Resume timer")
- `aria-pressed`: Reflects play/pause state (`false` when playing, `true` when paused)
- `role="toolbar"`: Groups controls semantically (fullscreen only)
- `aria-label="Timer controls"`: Labels the toolbar (fullscreen only)

### Reduced Motion

When `prefers-reduced-motion` is enabled:
- Control appear/hide transitions are instant (no fade animation)
- Fullscreen controls still function normally

## Developer Notes

### Implementation Details

**Keyboard guards** (`src/core/utils/keyboard-guards.ts`):
- `shouldIgnoreShortcut()`: Checks if active element is text input
- `isModalOpen()`: Checks for `[aria-modal="true"]` elements

**Keyboard shortcuts** (`src/app/orchestrator/keyboard-shortcuts.ts`):
- Document-level `keydown` listener
- Mode check: Only activates in timer mode
- Guard checks: Ignores shortcuts when typing or modal open
- Modifier key check: Ignores Ctrl/Alt/Meta combinations

**Fullscreen timer controls** (`src/components/countdown-buttons/fullscreen-manager.ts`):
- Creates controls dynamically in timer mode
- Positions left of exit button
- Hover persistence for WCAG 1.4.13 compliance
- Focus restoration when controls auto-hide

### Testing

**Unit tests:**
- `keyboard-guards.test.ts`: 23 tests for focus/modal detection
- `keyboard-shortcuts.test.ts`: 42 tests for shortcut behavior
- `timer-controls.test.ts`: 47 tests for timer control UI
- `fullscreen-manager.test.ts`: 19 tests for fullscreen integration

**E2E tests:**
- `timer-keyboard-shortcuts.spec.ts`: End-to-end keyboard interaction tests
- `fullscreen-mode.spec.ts`: Fullscreen timer controls tests

### Browser Compatibility

Keyboard shortcuts work in all modern browsers:
- Chrome/Edge: Full support ✓
- Firefox: Full support ✓
- Safari: Full support ✓
- Mobile browsers: N/A (virtual keyboards don't send these keys)

**Fullscreen API:**
- Vendor prefixes handled automatically
- Graceful degradation if API unavailable

## Common Questions

### Q: Why don't shortcuts work on mobile?
**A:** Mobile devices use virtual keyboards that don't send Space/Enter key events the same way physical keyboards do. Timer controls remain accessible via touch (tap the play/pause/reset buttons).

### Q: Can I customize the shortcuts?
**A:** Not currently. Shortcuts are hardcoded for consistency. If there's demand for customization, we could add it in a future release.

### Q: Why can't I use shortcuts in wall-clock mode?
**A:** Wall-clock mode counts to a specific calendar date (e.g., New Year's Eve). There's no concept of play/pause/reset — time keeps moving regardless. Timer mode is different because you control when it starts and stops.

### Q: What if I want to pause during fullscreen presentation?
**A:** Just press Space! Or move your mouse to reveal the play/pause button and click it. Both work great for presentations.

### Q: Do shortcuts work with Caps Lock on?
**A:** Yes! The `R` key is case-insensitive (`r` and `R` both work). Space and Enter are unaffected by Caps Lock.

## Feedback & Contributions

Found a bug or have a suggestion for keyboard shortcuts? [Open an issue](https://github.com/chrisreddington/timestamp/issues) or submit a pull request.

**Related documentation:**
- [PWA Instructions](../.github/instructions/pwa.instructions.md)
- [Testing Guide](../.github/instructions/testing.instructions.md)
