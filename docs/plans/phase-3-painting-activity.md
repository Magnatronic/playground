# Phase 3: Collaborative Painting Activity — Implementation Plan

## Summary

Phase 3 introduces the activity system and the first full activity: Collaborative Painting. It creates a `BaseActivity` abstract class that defines the lifecycle contract for all future activities, then builds `PaintingActivity` with three painting modes (Random, Cursor, Sweep). Each mode provides a position strategy; the activity orchestrates effect spawning, debounce, mode switching, and effect type switching. `main.js` is refactored from the Phase 2 test harness into an activity-based architecture. Temporary keyboard shortcuts for mode/effect switching are wired in, to be replaced by the settings panel in Phase 6.

---

## Critical Design Decisions

### Mode Architecture
Modes are **not** subclasses of a base mode class — they are plain objects/classes with a minimal interface (`getPosition()`, and optionally `init()`/`update()`/`destroy()`). This keeps them lightweight. `PaintingActivity` owns all effect spawning logic; modes only supply coordinates.

### Debounce Ownership
Debounce lives in `PaintingActivity.handleInput()`, not in `BaseActivity` or `InputManager`. The spec says each activity defines its own input behaviour (§3.3). A simple timestamp comparison (`performance.now() - lastSpawnTime < cooldown`) is sufficient — no timers or intervals needed.

### Effect Spawning
`PaintingActivity` creates a fresh effect instance via `createEffect(type)` on each press, then calls `effect.spawn(container, options)`. Effects are fire-and-forget (they self-cleanup via their own ticker callbacks, as established in Phase 2). No effect pooling is needed at this scale.

### SweepMode Cursor Visual
SweepMode draws a visible cursor indicator (crosshair or thin line) using PixiJS `Graphics`. This graphic is added to `app.stage` (above the effects container) so it's always visible. It's created on `init()` and destroyed on `destroy()`.

### Reusability for Phase 4
`SweepMode` will be imported by `ScreenFillActivity` in Phase 4. Design it with no painting-specific logic — it just tracks and returns a position, and optionally draws a cursor visual.

---

## PixiJS v8 API Notes (verified from codebase)

- `app.screen.width` / `app.screen.height` — current canvas dimensions (used for random bounds, sweep bounds)
- `app.stage` — root Container, already used in main.js
- `app.canvas` — the DOM element, used for pointer event listeners (CursorMode)
- `app.ticker.add(fn)` — frame loop callback, receives `ticker` with `ticker.deltaTime`
- `new Graphics()` — for SweepMode cursor visual
- `new Container()` — for effects container (already used in Phase 2 main.js)

---

## File Manifest

| # | File | Purpose | New/Modify |
|---|------|---------|------------|
| 1 | `src/activities/BaseActivity.js` | Abstract activity lifecycle contract | **New** |
| 2 | `src/activities/painting/modes/RandomMode.js` | Random position generator | **New** |
| 3 | `src/activities/painting/modes/CursorMode.js` | Mouse/touch position tracker | **New** |
| 4 | `src/activities/painting/modes/SweepMode.js` | Auto-moving cursor with visual indicator | **New** |
| 5 | `src/activities/painting/PaintingActivity.js` | Painting activity orchestrator | **New** |
| 6 | `src/main.js` | Replace test harness with activity routing | **Modify** |

---

## Shared Mode Interface

All modes implement this duck-typed interface (no formal base class):

```js
{
  getPosition(app)  // Required. Returns { x: Number, y: Number }
  init(pixiApp)     // Optional. Called when mode becomes active
  update(delta)     // Optional. Called each frame (only SweepMode needs this)
  destroy()         // Optional. Cleanup listeners/visuals
}
```

---

## Implementation Steps

### Step 1 — BaseActivity.js
**File:** `src/activities/BaseActivity.js`
**Depends on:** Nothing
**Parallel group:** A

Create an abstract base class with the following methods (all throw if not overridden):

- `init(pixiApp)` — receives the PixiJS `Application` instance. Subclass stores `this.app = pixiApp`, creates containers, sets up state.
- `update(delta)` — called each frame from `app.ticker`. `delta` is PixiJS `ticker.deltaTime` (frame-rate-normalized).
- `handleInput(switchProfile, eventType)` — receives a `SwitchProfile` instance and `'press'` or `'release'` string.
- `destroy()` — cleanup: remove containers from stage, remove event listeners, null references.
- `getInputConfig()` — returns an object describing input behaviour. Default return: `{ debounce: 150 }`. Subclasses can override to change cooldown, or add future config (hold-to-repeat, etc.).

Implementation notes:
- `init`, `handleInput`, and `destroy` should throw `Error('Subclasses must implement ...')`.
- `update` and `getInputConfig` provide sensible defaults (no-op and `{ debounce: 150 }` respectively).
- No imports needed beyond standard JS.

---

### Step 2 — RandomMode.js
**File:** `src/activities/painting/modes/RandomMode.js`
**Depends on:** Nothing
**Parallel group:** A (can be built in parallel with Steps 1, 3, 4)

Simplest mode — stateless position generator.

- `getPosition(app)`:
  - `x = Math.random() * app.screen.width`
  - `y = Math.random() * app.screen.height`
  - Returns `{ x, y }`
- No `init`, `update`, or `destroy` needed.

Export as a class with a single method (keeps consistent with other modes).

---

### Step 3 — CursorMode.js
**File:** `src/activities/painting/modes/CursorMode.js`
**Depends on:** Nothing
**Parallel group:** A

Tracks mouse/touch position on the PixiJS canvas.

- Constructor: initializes `this.x = 0`, `this.y = 0`, `this.app = null`, `this._onPointerMove = null`.
- `init(pixiApp)`:
  - Store `this.app = pixiApp`
  - Create bound handler: `this._onPointerMove = (e) => { this.x = e.offsetX; this.y = e.offsetY; }`
  - Add `pointermove` listener on `pixiApp.canvas` (covers mouse and touch)
  - Set initial position to center: `this.x = pixiApp.screen.width / 2; this.y = pixiApp.screen.height / 2`
- `getPosition()`:
  - Returns `{ x: this.x, y: this.y }`
- `destroy()`:
  - Remove `pointermove` listener from `this.app.canvas`
  - Null out references

Edge cases:
- If no pointer move has occurred yet, position defaults to screen center (set in `init`).
- `pointermove` fires for both mouse and touch — no separate `touchmove` needed.
- Use `offsetX`/`offsetY` (relative to canvas element), not `clientX`/`clientY`, so coordinates match PixiJS screen space.

---

### Step 4 — SweepMode.js
**File:** `src/activities/painting/modes/SweepMode.js`
**Depends on:** Nothing
**Parallel group:** A

Auto-moving cursor that bounces across the screen. Draws a visible cursor indicator.

**Constructor parameters (with defaults):**
- `speed`: `3` (pixels per delta unit — at 60fps this is ~180px/sec)
- `direction`: `'horizontal'` (or `'vertical'`)

**State:**
- `this.x`, `this.y` — current cursor position
- `this.velocityX`, `this.velocityY` — derived from speed + direction
- `this.cursorGraphic` — PixiJS Graphics object for the visual indicator
- `this.app` — stored reference to PixiJS app

**Methods:**

- `init(pixiApp)`:
  - Store `this.app = pixiApp`
  - Set starting position to center of screen
  - Set velocity: if horizontal, `velocityX = speed`, `velocityY = 0`; if vertical, `velocityX = 0`, `velocityY = speed`
  - Create cursor visual: a PixiJS `Graphics` object drawing a crosshair (two thin lines, ~40px span, white with 0.7 alpha, 2px stroke width)
  - Add cursor graphic to `pixiApp.stage` (on top of everything)
  - Position cursor graphic at starting position

- `update(delta)`:
  - Move position: `this.x += this.velocityX * delta; this.y += this.velocityY * delta`
  - Bounce logic:
    - If `this.x <= 0` or `this.x >= app.screen.width`: reverse `this.velocityX`, clamp position
    - If `this.y <= 0` or `this.y >= app.screen.height`: reverse `this.velocityY`, clamp position
  - Update cursor graphic position: `this.cursorGraphic.position.set(this.x, this.y)`

- `getPosition()`:
  - Returns `{ x: this.x, y: this.y }`

- `destroy()`:
  - Remove cursor graphic from parent and destroy it
  - Null out references

- `setSpeed(speed)`:
  - Update speed. Preserve direction of velocity (sign). Recalculate magnitude.

- `setDirection(direction)`:
  - Switch between `'horizontal'` and `'vertical'`. Reset position to center. Recalculate velocity components.

**Cursor visual design:**
- Crosshair: horizontal line + vertical line, centered at position
- White (`0xffffff`), alpha `0.7`, line width `2`
- Each arm ~20px from center (total span 40px)
- Drawn once in `init()`, then only position is updated in `update()`

Edge cases:
- Window resize: bounce bounds use live `app.screen.width/height`, so they adapt automatically.
- If cursor is outside bounds after resize, the next `update()` bounce check will correct it.

---

### Step 5 — PaintingActivity.js
**File:** `src/activities/painting/PaintingActivity.js`
**Depends on:** Steps 1–4
**Parallel group:** B

The main orchestrator. Extends `BaseActivity`.

**State:**
- `this.app` — PixiJS Application
- `this.effectsContainer` — PixiJS Container for all spawned effects
- `this.currentMode` — active mode instance (RandomMode, CursorMode, or SweepMode)
- `this.currentEffectType` — string (`'solid'`, `'brush'`, `'smoke'`, `'starburst'`)
- `this.modes` — object/Map holding mode instances: `{ random: RandomMode, cursor: CursorMode, sweep: SweepMode }`
- `this.lastSpawnTime` — timestamp of last effect spawn (for debounce)
- `this.cooldown` — debounce window in ms (default: `150`)

**Methods:**

- `init(pixiApp)`:
  - Store `this.app = pixiApp`
  - Create `this.effectsContainer = new Container()` and add to `app.stage`
  - Instantiate all three modes: `new RandomMode()`, `new CursorMode()`, `new SweepMode()`
  - Store in `this.modes` object
  - Set default mode to `random`
  - Call `this.currentMode.init?.(pixiApp)` (if the mode has an init method)
  - Set `this.currentEffectType = 'solid'`
  - Set `this.lastSpawnTime = 0`
  - Set `this.cooldown = 150`

- `update(delta)`:
  - Forward to current mode: `this.currentMode.update?.(delta)` (only SweepMode uses this)

- `handleInput(switchProfile, eventType)`:
  - If `eventType !== 'press'`, return (painting only responds to presses)
  - Debounce check: `const now = performance.now(); if (now - this.lastSpawnTime < this.cooldown) return;`
  - Update: `this.lastSpawnTime = now`
  - Get position from mode: `const pos = this.currentMode.getPosition(this.app)`
  - Create effect: `const effect = createEffect(this.currentEffectType)`
  - Spawn: `effect.spawn(this.effectsContainer, { x: pos.x, y: pos.y, colour: switchProfile.colour, size: 30, opacity: 0.9, scatter: 50, impactMultiplier: switchProfile.impactMultiplier })`
  - Console log: `[mode:effectType] label (colour)`

- `setMode(modeKey)`:
  - Validate `modeKey` is one of `'random'`, `'cursor'`, `'sweep'`
  - Call `this.currentMode.destroy?.()` on old mode
  - Set `this.currentMode = this.modes[modeKey]`
  - Call `this.currentMode.init?.(this.app)` on new mode
  - Console log mode switch

- `setEffectType(type)`:
  - Validate type exists in `getEffectTypes()`
  - Set `this.currentEffectType = type`
  - Console log effect type switch

- `destroy()`:
  - Call `this.currentMode.destroy?.()` for current mode
  - Remove `this.effectsContainer` from stage and destroy it
  - Null out references

- `getInputConfig()`:
  - Returns `{ debounce: this.cooldown }`

**Imports:**
- `BaseActivity` from `../BaseActivity.js`
- `createEffect, getEffectTypes` from `../../effects/EffectFactory.js`
- `Container` from `pixi.js`
- `RandomMode` from `./modes/RandomMode.js`
- `CursorMode` from `./modes/CursorMode.js`
- `SweepMode` from `./modes/SweepMode.js`

---

### Step 6 — Update main.js
**File:** `src/main.js`
**Depends on:** Step 5
**Parallel group:** C

Replace the Phase 2 test harness with activity-based architecture.

**Remove:**
- The `effectsContainer` creation and `app.stage.addChild(effectsContainer)` (PaintingActivity owns its container now)
- The `effectTypes`, `currentEffectIndex`, `currentEffectType` state variables
- The `inputManager.onKeyAction` handler that cycles effects and spawns at screen center
- The `directTypeByCode` map and the `window.addEventListener('keydown', ...)` handler for Digit1–4

**Add:**
- Import `PaintingActivity` from `./activities/painting/PaintingActivity.js`
- Import `SwitchManager` and `InputManager` (already imported)
- After `app.init()` and DOM append, create and init the activity:
  ```
  const activity = new PaintingActivity();
  activity.init(app);
  ```
- Wire input to activity:
  ```
  inputManager.onKeyAction = (code, actionType) => {
    const profile = switchManager.getProfile(code);
    if (profile) {
      activity.handleInput(profile, actionType);
    }
  };
  ```
- Add ticker callback:
  ```
  app.ticker.add((ticker) => {
    inputManager.update();
    activity.update(ticker.deltaTime);
  });
  ```
- Add temporary keyboard shortcuts for mode/effect switching (separate from InputManager's switch handling):
  ```
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    switch (event.code) {
      case 'Digit1': activity.setMode('random'); break;
      case 'Digit2': activity.setMode('cursor'); break;
      case 'Digit3': activity.setMode('sweep'); break;
      case 'KeyQ': activity.setEffectType('solid'); break;
      case 'KeyW': activity.setEffectType('brush'); break;
      case 'KeyE': activity.setEffectType('smoke'); break;
      case 'KeyR': activity.setEffectType('starburst'); break;
    }
  });
  ```

**Keep:**
- `app.init()` configuration (background, resizeTo, etc.)
- `document.getElementById('app').appendChild(app.canvas)`
- `InputManager` and `SwitchManager` instantiation

---

## Parallel Execution Map

```
Group A (no dependencies — can all run in parallel):
  Step 1: BaseActivity.js
  Step 2: RandomMode.js
  Step 3: CursorMode.js
  Step 4: SweepMode.js

Group B (depends on Group A):
  Step 5: PaintingActivity.js

Group C (depends on Group B):
  Step 6: main.js update
```

---

## Edge Cases to Handle

1. **Debounce on rapid multi-key presses**: Each switch press goes through the same `handleInput` with a single shared cooldown. This means if switch A fires at t=0, switch B won't fire until t=150ms. This is intentional — the spec says "rapid presses don't flood" and the debounce cooldown is per-activity, not per-switch.

2. **Window resize during Sweep**: SweepMode reads `app.screen.width/height` live in its bounce check, so it adapts automatically. If the cursor ends up outside bounds after a resize, the next frame's bounce logic clamps it back.

3. **Mode switch mid-sweep**: When switching from Sweep to another mode, `SweepMode.destroy()` removes the cursor visual. When switching back, `SweepMode.init()` recreates it at screen center. No stale state carries over.

4. **CursorMode before any pointer movement**: Defaults to screen center (set in `init()`), so a press before any mouse move still produces a visible effect.

5. **Effect type validation**: `setEffectType()` checks against `getEffectTypes()` to prevent invalid type strings from causing runtime errors.

6. **Destroy lifecycle**: `PaintingActivity.destroy()` calls `currentMode.destroy?.()` to clean up the active mode's listeners/visuals, then removes and destroys the effects container. Any in-flight effects (mid-fade) are destroyed with `{ children: true }`.

7. **CursorMode pointer coordinates**: Uses `event.offsetX/offsetY` (relative to the canvas element) rather than `clientX/clientY`, ensuring coordinates align with PixiJS screen space even if the canvas isn't at (0,0) in the page.

---

## Verification Checklist (from TEST.md)

- [ ] Random mode: press paints at random position each time
- [ ] Cursor mode: press paints at current mouse/touch position
- [ ] Sweep mode: cursor moves continuously across screen
- [ ] Sweep mode: press paints at sweep cursor position
- [ ] Sweep speed is adjustable (via `setSpeed()` — tested manually via console for now)
- [ ] Sweep works in both horizontal and vertical patterns (via `setDirection()`)
- [ ] Each switch paints in its assigned colour
- [ ] Impact multiplier scales effect size per switch
- [ ] Debounce/cooldown works (rapid presses don't flood)
- [ ] Can switch between all 3 modes (Digit1/2/3)
- [ ] Phase 1 & 2 checks still pass (input tracking, all 4 effects render correctly)

---

## Open Questions

1. **Per-switch debounce vs global debounce**: Current plan uses a single shared cooldown (any press resets the timer for all switches). If the team wants per-switch cooldowns (so different students can paint independently within the cooldown window), the debounce logic would need a `Map<switchKey, lastSpawnTime>` instead. The spec doesn't specify — defaulting to global debounce for simplicity.

2. **Sweep cursor visual style**: Plan uses a simple white crosshair. Could alternatively be a pulsing circle, an animated target, or coloured to match "no assigned switch." Choosing crosshair for now as it's simple, visible on the dark background, and doesn't imply colour association.

3. **Effect size/opacity/scatter defaults**: Currently hardcoded in `PaintingActivity.handleInput()` as `{ size: 30, opacity: 0.9, scatter: 50 }`. These will move to settings in Phase 6. For now, these values match the Phase 2 test harness constants.

---

## Todo List

| # | Task | File(s) | Agent | Depends on |
|---|------|---------|-------|------------|
| 1 | Create BaseActivity abstract class | `src/activities/BaseActivity.js` | Coder | — |
| 2 | Create RandomMode | `src/activities/painting/modes/RandomMode.js` | Coder | — |
| 3 | Create CursorMode with pointer tracking | `src/activities/painting/modes/CursorMode.js` | Coder | — |
| 4 | Create SweepMode with bounce + cursor visual | `src/activities/painting/modes/SweepMode.js` | Coder | — |
| 5 | Create PaintingActivity orchestrator | `src/activities/painting/PaintingActivity.js` | Coder | 1, 2, 3, 4 |
| 6 | Refactor main.js: remove test harness, wire activity | `src/main.js` | Coder | 5 |
| 7 | Manual QA: run TEST.md Phase 3 checklist | — | Tester | 6 |
