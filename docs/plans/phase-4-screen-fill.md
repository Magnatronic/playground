# Phase 4: Screen Fill Challenge — Implementation Plan

## Summary

Phase 4 adds the second activity: Screen Fill Challenge. Students collaboratively paint to fill the entire screen, with a progress bar tracking coverage, a count-up timer, and a celebration on completion. The activity reuses `PaintLayer` for persistent paint and `SweepMode` for auto-cursor movement. A new `CoverageGrid` (low-res boolean grid) tracks filled areas without pixel-reading. A `BiasedRandomMode` steers random placements toward unfilled cells. DOM overlays handle the progress bar and timer display. A PixiJS-based celebration fires on 100% coverage. `main.js` gains an activity switcher.

---

## Critical Design Decisions

### Coverage Tracking: Low-Res Grid, Not Pixel Reading
A `CoverageGrid` with ~100×60 cells (mapping to screen pixels) tracks which areas are filled. When a stamp is placed, all grid cells overlapping the stamp's radius are marked. This is O(1) per stamp (bounded by stamp radius / cell size), avoids GPU readback, and gives instant percentage calculation.

### Grid Dimensions
At 1920×1080 resolution with 100×60 cells, each cell is ~19×18px. A standard stamp (radius 30px, scaled by impactMultiplier) covers roughly 3×3 to 6×6 cells. This provides meaningful granularity without overhead. Grid dimensions should be derived from a target cell size (~18-20px) rather than hardcoded column/row counts, so it adapts to different screen sizes.

### BiasedRandomMode vs Patching RandomMode
A new `BiasedRandomMode` class is created (rather than modifying `RandomMode`) because it requires a `CoverageGrid` dependency and different selection logic. `RandomMode` stays untouched for PaintingActivity. BiasedRandomMode picks from unfilled cells, with a fallback to fully random when few cells remain (to avoid clustering on the last few pixels).

### Always Normal Blend Mode
`ScreenFillActivity` locks `PaintLayer` to `'normal'` blend mode. This ensures stamps are opaque and coverage is visually clear. No blend mode switching is exposed.

### Timer Lifecycle
The timer starts on the **first switch press** (not on activity init). It counts up. It pauses (not resets) when coverage reaches 100%. The timer tracks elapsed time using `performance.now()` deltas — no `setInterval`.

### DOM Overlays for UI
`ProgressBar` and `Timer` are DOM elements (not PixiJS objects). This simplifies text rendering, styling, and accessibility. They're absolutely positioned over the canvas. Each component creates and owns its DOM elements, and removes them on `destroy()`.

### Celebration Scope
On 100% completion: the celebration fires (PixiJS particles), the timer stops, and input is **ignored** (no further painting). After the celebration auto-dismisses (3-5 seconds), the activity remains in its completed state. A reset (Ctrl+R) clears everything and allows replay.

### Reuse of Existing SweepMode
`SweepMode` from `src/activities/painting/modes/SweepMode.js` is imported directly — it was designed for reuse (no painting-specific logic). The activity passes `app` to `init()` and calls `update(delta)` and `getPosition()` as-is.

---

## File Manifest

| # | File | Purpose | New/Modify |
|---|------|---------|------------|
| 1 | `src/activities/screen-fill/CoverageGrid.js` | Low-res boolean grid for coverage tracking | **New** |
| 2 | `src/activities/screen-fill/BiasedRandomMode.js` | Random position biased toward unfilled cells | **New** |
| 3 | `src/ui/ProgressBar.js` | DOM overlay — horizontal progress bar with percentage | **New** |
| 4 | `src/ui/Timer.js` | DOM overlay — count-up timer in MM:SS format | **New** |
| 5 | `src/ui/Celebration.js` | PixiJS fullscreen particle celebration | **New** |
| 6 | `src/activities/screen-fill/ScreenFillActivity.js` | Activity orchestrator — ties everything together | **New** |
| 7 | `src/main.js` | Add activity switching (keyboard shortcut + URL param) | **Modify** |
| 8 | `index.html` | Add CSS rules for UI overlay elements | **Modify** |

---

## Implementation Steps

### Step 1 — CoverageGrid
**File:** `src/activities/screen-fill/CoverageGrid.js` (new)
**Depends on:** Nothing
**Parallel group:** A

Pure data structure — no PixiJS dependency.

**Responsibilities:**
- Constructor takes `screenWidth` and `screenHeight`. Derives grid dimensions from a target cell size (~18-20px), stores cell width/height.
- Internal storage: a `Uint8Array` (flat, row-major) where 0 = unfilled, 1 = filled. Flat array is faster than nested arrays.
- `markFilled(x, y, radius)` — converts the stamp's screen-space circle (center + radius) to grid cell bounds, marks all overlapping cells as filled. Clamp to grid bounds to prevent out-of-range writes.
- `getPercentage()` — returns filled cell count / total cell count as a 0-100 number. Cache the filled count (increment on each newly-marked cell in `markFilled`) so this is O(1).
- `getRandomUnfilledCell()` — returns a random unfilled cell's center position in screen coordinates `{ x, y }`. If no unfilled cells remain, returns `null`. Strategy: pick a random index, scan forward until an unfilled cell is found (wrap around). This is O(n) worst case but average O(1) when many cells are unfilled.
- `reset()` — zero the array, reset filled count.
- `resize(screenWidth, screenHeight)` — recalculate grid dimensions and reset (mirrors PaintLayer's resize behaviour).

**Edge cases:**
- Stamps near screen edges: clamp grid indices to `[0, cols-1]` and `[0, rows-1]`.
- Very small screens: minimum grid of e.g. 10×6 cells.
- `getRandomUnfilledCell()` when coverage is >95%: the scan-forward approach still works but may take more iterations. Acceptable at this grid size (~6000 cells max).

---

### Step 2 — BiasedRandomMode
**File:** `src/activities/screen-fill/BiasedRandomMode.js` (new)
**Depends on:** CoverageGrid (Step 1)
**Parallel group:** A (structurally independent — just needs CoverageGrid interface)

Position strategy that steers painting toward unfilled areas.

**Interface:** Same duck-typed mode interface as existing modes:
- `init(pixiApp)` — store app reference
- `getPosition()` — returns `{ x, y }`
- `update(delta)` — no-op
- `destroy()` — null references

**Responsibilities:**
- Holds a reference to the `CoverageGrid` (passed via constructor or setter, not via `init`).
- `getPosition()`:
  - Call `coverageGrid.getRandomUnfilledCell()`.
  - If result is non-null, return it (with small random offset within the cell for visual variety).
  - If null (100% filled), fall back to fully random position (like `RandomMode`).
- No visual cursor — same as `RandomMode`.

---

### Step 3 — ProgressBar (DOM Overlay)
**File:** `src/ui/ProgressBar.js` (new)
**Depends on:** Nothing
**Parallel group:** A

DOM-based progress indicator positioned over the canvas.

**Responsibilities:**
- Constructor creates DOM elements: outer container div + inner filled div + percentage text span.
- Appends to `document.body` (or a designated overlay container).
- Positioned via CSS: fixed at bottom-center of viewport, high z-index to overlay canvas.
- `update(percentage)` — sets inner div width and text content. Clamp to 0-100. Round to integer for display.
- Colour transitions: bar fill colour shifts as progress increases (e.g., red → yellow → green) via simple hue interpolation or stepped thresholds.
- `show()` / `hide()` — toggle visibility.
- `destroy()` — remove DOM elements from document.

**Styling notes:**
- Semi-transparent background so canvas shows through.
- Large, high-contrast text (accessibility audience).
- Rounded corners, minimal design — should not distract from painting.
- Width ~60% of viewport, height ~30-40px.

---

### Step 4 — Timer (DOM Overlay)
**File:** `src/ui/Timer.js` (new)
**Depends on:** Nothing
**Parallel group:** A

DOM-based count-up timer.

**Responsibilities:**
- Constructor creates a DOM text element, positions it at top-right of viewport (fixed, high z-index).
- Internal state: `startTime` (null until started), `elapsedMs` (accumulated), `running` (boolean).
- `start()` — record `performance.now()` as start time, set `running = true`.
- `stop()` — calculate final elapsed, set `running = false`.
- `update()` — if running, compute elapsed ms from start time, format as `MM:SS`, update DOM text. Called each frame from the activity's `update()`.
- `reset()` — zero elapsed, clear display to `00:00`, set `running = false`, `startTime = null`.
- `getElapsed()` — return total elapsed ms (for potential future use).
- `show()` / `hide()` — toggle visibility.
- `destroy()` — remove DOM element.

**Formatting:** `Math.floor(seconds / 60)` padded to 2 digits + `:` + `seconds % 60` padded to 2 digits.

---

### Step 5 — Celebration
**File:** `src/ui/Celebration.js` (new)
**Depends on:** Nothing (uses PixiJS directly)
**Parallel group:** A

PixiJS-based fullscreen particle celebration, similar to `StarburstEffect` but larger and multi-burst.

**Responsibilities:**
- `play(pixiApp, onComplete)`:
  - Create a Container added to `app.stage` (on top of everything).
  - Spawn multiple bursts (3-5) from different screen positions (spread across viewport).
  - Each burst: 30-50 particles with radial velocity, random colours (use all 8 switch colours for a rainbow effect), larger sizes than StarburstEffect.
  - Particles expand outward, slow down, fade out, and shrink over 2-3 seconds.
  - After all particles finish (or after a fixed duration of ~4 seconds), remove the container and call `onComplete` callback.
- `destroy()` — force-remove container if still active (for early cleanup on activity destroy).

**Design notes:**
- Inspired by `StarburstEffect.createEffect()` pattern: Graphics circles with `_vx`, `_vy`, `_life`, `_born` properties, animated via `Ticker.shared`.
- Multiple burst origins (e.g., center, top-left quadrant, top-right quadrant, bottom-left, bottom-right) for screen coverage.
- Optional: slight delay between bursts (staggered 200-400ms) for a cascading fireworks feel.
- No sound (that's Phase 5).

---

### Step 6 — ScreenFillActivity
**File:** `src/activities/screen-fill/ScreenFillActivity.js` (new)
**Depends on:** Steps 1-5 (CoverageGrid, BiasedRandomMode, ProgressBar, Timer, Celebration)
**Parallel group:** B

The main orchestrator — extends `BaseActivity`.

**Responsibilities:**

#### `init(pixiApp)`
- Call `super.init(pixiApp)`.
- Create `PaintLayer` (reuse from `src/painting/PaintLayer.js`), force blend mode to `'normal'`.
- Add paint layer display object to stage.
- Create `CoverageGrid` with `app.screen.width` and `app.screen.height`.
- Create effects container (`Container`) and add to stage above paint layer.
- Create `BiasedRandomMode`, pass coverage grid reference, call `init(app)`.
- Create `SweepMode` (import from painting/modes), call `init(app)`.
- Set default active mode to `BiasedRandomMode` (name: `'random'`).
- Create `ProgressBar`, show it.
- Create `Timer`, show it (displays `00:00` initially).
- Set `completed = false`, `started = false`.
- Log activity start.

#### `update(delta)`
- Call active mode's `update(delta)` (needed for SweepMode).
- Call `timer.update()` (updates display if running).

#### `handleInput(switchProfile, eventType)`
- If `eventType !== 'press'` or `completed`, return.
- Debounce check (same pattern as `PaintingActivity`, 150ms default).
- If `!started`: set `started = true`, call `timer.start()`.
- Get position from active mode's `getPosition()`.
- Apply scatter (small for sweep ~10, larger for random ~30 — same as PaintingActivity).
- Stamp on paint layer with `stamp()` (always solid/opaque, not `stampSoft()`).
- Spawn animated effect via `EffectFactory.createEffect()` + `effect.spawn()` for visual feedback.
- Call `coverageGrid.markFilled(x, y, stampRadius)` where `stampRadius = baseSize * impactMultiplier`.
- Get new percentage from `coverageGrid.getPercentage()`.
- Call `progressBar.update(percentage)`.
- If `percentage >= 100` and not `completed`:
  - Set `completed = true`.
  - Call `timer.stop()`.
  - Trigger `celebration.play(app, onComplete)` where `onComplete` is a no-op or logs.

#### `setMode(modeName)`
- Support `'random'` (BiasedRandomMode) and `'sweep'` (SweepMode).
- Destroy current mode, create/init new one (same pattern as PaintingActivity).

#### `clear()` (reset)
- Clear paint layer.
- Reset coverage grid.
- Reset timer.
- Reset progress bar to 0%.
- Set `completed = false`, `started = false`.
- Destroy and recreate celebration if it was playing.
- Log reset.

#### `destroy()`
- Destroy active mode, paint layer, effects container, coverage grid.
- Destroy UI: progress bar, timer, celebration.
- Call `super.destroy()`.

#### `getInputConfig()`
- Return `{ debounce: 150 }`.

**Edge cases:**
- Resize during play: PaintLayer auto-clears on resize. CoverageGrid should also resize and reset. Coverage resets to 0% — acceptable tradeoff, same as painting activity. Timer keeps running.
- Very fast fill (large stamp, high impactMultiplier): celebration fires as soon as 100% is detected. No partial-percent rounding issues because we check `>= 100`.
- Multiple switch presses on same frame: debounce prevents this (150ms).

---

### Step 7 — main.js Activity Switching
**File:** `src/main.js` (modify)
**Depends on:** Step 6 (ScreenFillActivity)
**Parallel group:** C

Add the ability to switch between PaintingActivity and ScreenFillActivity.

**Changes:**
- Import `ScreenFillActivity`.
- Add an activity registry: `{ painting: PaintingActivity, 'screen-fill': ScreenFillActivity }`.
- Read initial activity from URL search param: `?activity=screen-fill` (default: `painting`).
- Extract a `switchActivity(name)` function:
  - If current activity exists, call `activity.destroy()`.
  - Create new activity instance, call `activity.init(app)`.
  - Re-wire `inputManager.onKeyAction` to new activity's `handleInput`.
  - Store reference to current activity.
- Add keyboard shortcut: `Digit9` switches to screen-fill, `Digit0` switches to painting ($temporary, replaced by menu in Phase 6).
- Wire `Ctrl+R` to activity's `clear()` method (already exists, just ensure it works with new activity).
- Update console log with new shortcuts.

**Edge cases:**
- Switching activity mid-play: `destroy()` on old activity must clean up all DOM overlays (ProgressBar, Timer) and PixiJS objects. This is handled by each component's `destroy()`.
- URL param validation: if unknown activity name, default to `painting`.

---

### Step 8 — index.html Overlay Styles
**File:** `index.html` (modify)
**Depends on:** Steps 3, 4 (ProgressBar, Timer — need to know element structure)
**Parallel group:** A

Add CSS rules for the DOM overlay elements.

**Changes:**
- Add styles within the existing `<style>` block for:
  - `.playground-progress` — fixed bottom-center positioning, z-index above canvas, semi-transparent background, rounded corners, height ~30-40px, width ~60%.
  - `.playground-progress-fill` — inner bar, height 100%, transition on width for smooth animation, colour (initial colour set; JS will update).
  - `.playground-progress-text` — centered percentage text, white, large bold font, text-shadow for readability.
  - `.playground-timer` — fixed top-right positioning, z-index, semi-transparent background, large monospace font, white text, padding.
- Keep styles minimal — components may also set inline styles for dynamic values.

**Alternative:** Each UI component could inject its own `<style>` tag on creation and remove it on destroy. This keeps styles co-located with components. Either approach works — choose one and be consistent.

---

## Dependency Graph

```
Step 1 (CoverageGrid)          ─┐
Step 2 (BiasedRandomMode)      ─┤ (needs Step 1 interface)
Step 3 (ProgressBar)            ─┤
Step 4 (Timer)                  ─┤──→ Step 6 (ScreenFillActivity) ──→ Step 7 (main.js)
Step 5 (Celebration)            ─┤
Step 8 (index.html styles)      ─┘
```

**Parallel group A** (Steps 1-5, 8): All independent, can be built simultaneously.
**Parallel group B** (Step 6): Requires all group A components.
**Parallel group C** (Step 7): Requires Step 6.

---

## Edge Cases Summary

| Scenario | Handling |
|----------|----------|
| Window resize during play | PaintLayer clears, CoverageGrid resets, progress resets to 0%, timer keeps running |
| 100% coverage reached | Input ignored, timer stops, celebration plays, Ctrl+R resets everything |
| Ctrl+R during celebration | Cancel celebration, full reset, ready for replay |
| Switching activity mid-play | `destroy()` cleans up all DOM + PixiJS elements |
| Stamp overlaps screen edge | CoverageGrid clamps cell indices, PaintLayer clips naturally |
| All cells filled except unreachable corners | BiasedRandomMode steers toward them; sweep mode can also reach them |
| Very high impactMultiplier | Covers more grid cells per stamp — just fills faster, no breakage |
| `getRandomUnfilledCell()` with >95% coverage | Scan-forward still finds cells; 6000 cells max is trivially fast |
| Multiple simultaneous switch presses | Debounce (150ms) ensures only one processes per window |

---

## Open Questions

1. **Stamp size for coverage marking**: Should the coverage radius match the visual stamp radius exactly, or be slightly smaller (e.g., 80%) to require more deliberate filling? Smaller radius = harder challenge, takes longer.

2. **Sweep pattern for screen-fill**: Should the screen-fill activity default to `'systematic'` sweep pattern (which naturally covers the screen row-by-row), or let the teacher pick? Systematic is the most logical default for this activity.

3. **Effect type**: Should screen-fill lock to `'solid'` effect (most visible coverage) or allow effect switching like painting? Locking to solid keeps it simple and focused; allowing switching adds variety.

4. **Celebration replay**: After celebration dismisses, should the activity auto-reset for another round, or stay in completed state until Ctrl+R? Staying completed seems safer (teacher decides when to reset).

5. **Progress milestones**: Should the progress bar show milestone markers (25%, 50%, 75%) visually? Phase 5 will add milestone sounds, so visual markers could be prep for that. Low effort to add as CSS pseudo-elements.

---

## Task Checklist

- [ ] **Task 1** — Create `src/activities/screen-fill/CoverageGrid.js` — Pure data grid with `markFilled()`, `getPercentage()`, `getRandomUnfilledCell()`, `reset()`, `resize()`
- [ ] **Task 2** — Create `src/activities/screen-fill/BiasedRandomMode.js` — Random position picker biased toward unfilled cells via CoverageGrid
- [ ] **Task 3** — Create `src/ui/ProgressBar.js` — DOM overlay progress bar with percentage text, colour transitions, show/hide/destroy
- [ ] **Task 4** — Create `src/ui/Timer.js` — DOM overlay count-up timer (MM:SS), start/stop/reset/destroy
- [ ] **Task 5** — Create `src/ui/Celebration.js` — PixiJS multi-burst particle celebration, auto-dismiss, destroy
- [ ] **Task 6** — Create `src/activities/screen-fill/ScreenFillActivity.js` — Activity orchestrator: PaintLayer + CoverageGrid + modes + UI + completion logic
- [ ] **Task 7** — Modify `src/main.js` — Activity registry, URL param switching, keyboard shortcut (9/0), re-wire input on switch
- [ ] **Task 8** — Modify `index.html` — Add CSS for `.playground-progress`, `.playground-timer` overlay elements
- [ ] **Task 9** — Manual QA per TEST.md Phase 4 checklist (8 items)
