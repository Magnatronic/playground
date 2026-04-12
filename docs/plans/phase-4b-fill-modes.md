# Phase 4b: Fill Modes — Implementation Plan

## Summary

Phase 4b adds fill mode selection to the Screen Fill Challenge: **Standard** (with configurable stamp shapes: circle, square, triangle, star, heart, diamond) and **Mosaic Tiles** (structured tile grids that fill on press). Each mode changes how stamps render and/or how coverage is tracked, but reuses the existing position modes (BiasedRandom, Cursor, Sweep), effects system, timer, progress bar, and celebration. A `FillMode` strategy abstraction lets `ScreenFillActivity` delegate stamp rendering and coverage tracking to the active fill mode, keeping the orchestrator thin. Temporary keyboard shortcuts (until Phase 6 settings panel) let the teacher switch between fill modes and their options. Shape Targets / Mystery Paint was discussed but deferred to a separate app (different UX goal).

---

## Critical Design Decisions

### 1. Fill Mode as Strategy Pattern

`ScreenFillActivity` currently handles stamping, coverage marking, and completion detection inline in `handleInput()`. This will be extracted into a **fill mode strategy** interface:

```
FillMode {
  init(app, options)       // Set up visuals (containers, grids, etc.)
  stamp(x, y, colour, size, impactMultiplier)  // Render the stamp + mark coverage
  getPercentage()          // 0-100 coverage
  getDisplayObject()       // Container/Sprite to add to stage
  reset()                  // Clear state
  resize(w, h)             // Handle window resize
  destroy()                // Cleanup
}
```

`ScreenFillActivity.handleInput()` calls `this.fillMode.stamp(...)` instead of directly calling `paintLayer.stamp()` and `coverageGrid.markFilled()`. The activity still owns effects, timer, progress bar, and celebration.

**Why:** Avoids bloating ScreenFillActivity with mode-specific branching. Each fill mode encapsulates its own rendering approach and coverage logic. New fill modes can be added later without touching the orchestrator.

### 2. Standard Mode (Current Behaviour) Becomes `StandardFillMode`

The existing circle-stamp-on-RenderTexture + CoverageGrid approach is wrapped in a `StandardFillMode` class. This preserves backward compatibility and serves as the reference implementation for the fill mode interface.

### 3. Shape Stamps: Integrated Into Standard Fill Mode

Standard fill mode uses PaintLayer (RenderTexture) and CoverageGrid with configurable stamp shapes. A `ShapeStamper` utility draws shapes procedurally via PixiJS Graphics API methods (`rect`, `poly`, `star`, `regularPoly`, `moveTo`/`lineTo`/`closePath`). PaintLayer.stamp() gains an optional `shape` parameter (default: `'circle'`).

**Shape assignment strategy:** Configurable on StandardFillMode:
- `'per-switch'` — each switch key maps to a shape index via a lookup table
- `'global'` — teacher picks one shape for all
- `'random'` — each press picks from SHAPE_NAMES randomly

Animated effects remain circles — only the PaintLayer stamp changes shape.

### 4. Mosaic Tiles: Replace PaintLayer, Not Layer On Top

Mosaic mode uses a **Container of pre-created tile Graphics objects** instead of a PaintLayer RenderTexture. Each tile starts as an outlined/dim shape. When a press lands on or near a tile, that tile fills with the switch's colour and plays a brief pop animation (scale tween via ticker). Coverage = number of filled tiles / total tiles.

The tile grid IS the coverage grid — no separate CoverageGrid needed. The `MosaicFillMode` manages its own tile container and exposes `getPercentage()` directly.

Tile patterns:
- **Squares** — regular grid (trivial: `rect()` per cell)
- **Hexagons** — offset hex grid (`regularPoly(x, y, radius, 6)` with row stagger)
- **Triangles** — alternating up/down triangles (`poly()` with 3 vertices)
- **Bricks** — offset rectangular grid (every other row shifted by half-width)

### 5. Shape Targets: Deferred to Separate App

Shape Targets (colouring inside silhouettes) and Mystery Paint (reveal hidden pictures) were discussed but deferred. Different UX goal (discovery/colouring) vs Screen Fill (speed/coverage). Will be a separate web app with its own shape library, categories, and difficulty levels. CoverageGrid mask support and PaintLayer masking techniques from this codebase can be reused when building it.

### 6. Stamp Shape Library (Extensible)

Six stamp shapes available in Standard fill mode: circle, square, triangle, star, heart, diamond. Defined in `ShapeStamper.js` as simple draw functions using PixiJS Graphics API. Additional shapes can be added later by extending ShapeStamper.

### 7. Teacher Controls (Temporary Keyboard Shortcuts)

Until Phase 6 settings panel:
- **`F` key** — cycle fill mode: standard → mosaic
- **`G` key** — cycle fill mode option:
  - Standard: cycle shape assignment (per-switch / global / random)
  - Mosaic: cycle tile pattern (squares / hexagons / triangles / bricks)
- **`T` key** — cycle stamp shape in Standard mode global assignment (circle → square → triangle → star → heart → diamond)

These are registered in `main.js` alongside existing shortcuts.

### 8. CoverageGrid: No Mask Needed

With Shape Targets deferred, CoverageGrid does not need mask support. Standard and Mosaic fill modes both track full-screen coverage. Mask support can be added later if needed for Shape Targets app.

---

## File Manifest

| # | File | Purpose | New/Modify |
|---|------|---------|------------|
| 1 | `src/activities/screen-fill/fill-modes/BaseFillMode.js` | Abstract fill mode interface | **New** |
| 2 | `src/activities/screen-fill/fill-modes/StandardFillMode.js` | PaintLayer + CoverageGrid + stamp shape selection | **New** |
| 3 | `src/activities/screen-fill/fill-modes/ShapeStamper.js` | Draws geometric shapes on PixiJS Graphics | **New** |
| 4 | `src/activities/screen-fill/fill-modes/MosaicFillMode.js` | Mosaic Tiles fill mode | **New** |
| 5 | `src/activities/screen-fill/fill-modes/tile-patterns/SquarePattern.js` | Square tile layout | **New** |
| 6 | `src/activities/screen-fill/fill-modes/tile-patterns/HexPattern.js` | Hexagon tile layout | **New** |
| 7 | `src/activities/screen-fill/fill-modes/tile-patterns/TrianglePattern.js` | Triangle tile layout | **New** |
| 8 | `src/activities/screen-fill/fill-modes/tile-patterns/BrickPattern.js` | Brick tile layout | **New** |
| 9 | `src/painting/PaintLayer.js` | Add `shape` parameter to `stamp()` | **Modify** |
| 10 | `src/activities/screen-fill/ScreenFillActivity.js` | Delegate to fill mode, add `setFillMode()` | **Modify** |
| 11 | `src/main.js` | Add fill mode keyboard shortcuts | **Modify** |

---

## Implementation Steps

### Step 1 — BaseFillMode interface
**File:** `src/activities/screen-fill/fill-modes/BaseFillMode.js` (new)
**Depends on:** Nothing
**Parallel group:** A

Abstract base class defining the fill mode contract. Methods:
- `init(app, options)` — receives PixiJS app and config object
- `stamp({ x, y, colour, size, impactMultiplier })` — render stamp and update coverage
- `getPercentage()` — return 0-100 coverage value
- `getDisplayObject()` — return Container/Sprite for stage
- `reset()` — clear all state
- `resize(width, height)` — handle viewport change
- `destroy()` — cleanup
- `getConfig()` — return current config for UI display (optional, for future settings panel)

All methods throw "not implemented" in base class. Lightweight — just documents the contract.

---

### Step 2 — REMOVED (CoverageGrid mask support)
CoverageGrid mask support was needed for Shape Targets, which has been deferred to a separate app. No changes to CoverageGrid needed.

---

### Step 3 — ShapeStamper utility
**File:** `src/activities/screen-fill/fill-modes/ShapeStamper.js` (new)
**Depends on:** Nothing
**Parallel group:** A

Pure utility — draws a specified shape onto a PixiJS Graphics object at (0,0) centered. Shapes:

- `circle(g, radius)` — `g.circle(0, 0, radius)`
- `square(g, radius)` — `g.rect(-radius, -radius, radius*2, radius*2)`
- `triangle(g, radius)` — equilateral triangle via `g.poly()`  
- `star(g, radius)` — `g.star(0, 0, 5, radius, radius*0.4)`
- `heart(g, radius)` — bezier curves forming a heart shape
- `diamond(g, radius)` — rotated square via `g.poly()`

Export: `drawShape(graphics, shapeName, radius)` — calls the appropriate function.

Also export: `SHAPE_NAMES` — array of valid shape name strings.

---

### Step 4 — PaintLayer shape stamp support
**File:** `src/painting/PaintLayer.js` (modify)
**Depends on:** ShapeStamper (Step 3)
**Parallel group:** B (after Step 3)

Modify `stamp(options)` to accept optional `shape` parameter (default: `'circle'`):

- When `shape === 'circle'` (or undefined): current behaviour, no change.
- Otherwise: use `ShapeStamper.drawShape(mark, shape, radius)` instead of `mark.circle(0, 0, radius)`.

The rest of `stamp()` (fill, blend mode, render to texture, cleanup) stays identical.

---

### Step 5 — StandardFillMode (with stamp shape selection)
**File:** `src/activities/screen-fill/fill-modes/StandardFillMode.js` (new)
**Depends on:** BaseFillMode (Step 1), PaintLayer (Step 4), ShapeStamper (Step 3)
**Parallel group:** B (after Steps 1, 3, 4)

Wraps the current ScreenFillActivity approach with stamp shape selection:
- `init(app, options)`: creates PaintLayer + CoverageGrid. Sets initial shape assignment mode and stamp shape from options.
- `stamp(options)`: determines shape (based on assignment mode), calls `this.paintLayer.stamp({...options, shape})` then `this.coverageGrid.markFilled(x, y, radius)`
- `getPercentage()`: delegates to `this.coverageGrid.getPercentage()`
- `getDisplayObject()`: returns `this.paintLayer.getDisplayObject()`
- `getCoverageGrid()`: exposes grid for BiasedRandomMode
- Owns its PaintLayer and CoverageGrid instances

Shape assignment logic:
- `setShapeAssignment(mode)` — switches between `'per-switch'` / `'global'` / `'random'`
- `setCurrentShape(shapeName)` — sets the shape for 'global' mode
- `cycleShape()` — advances to next shape (for T keyboard shortcut)
- `cycleShapeAssignment()` — cycles through assignment modes (for G keyboard shortcut)
- `setStampSize(size)` — sets base stamp radius (affects fill speed / session pacing)
- `increaseStampSize()` / `decreaseStampSize()` — adjust by step (e.g. ±10px), clamped to min/max
- For `'per-switch'`: maps switch colour/key to a shape index (8 switches → 6 shapes, with wrapping)
- For `'random'`: picks from SHAPE_NAMES randomly each press

This merges what was previously StandardFillMode + ShapeStampsFillMode into one class.

---

### Step 6 — REMOVED (ShapeStampsFillMode — merged into StandardFillMode)
Shape stamp functionality is now part of StandardFillMode (Step 5).

---

### Step 7 — Tile Pattern definitions
**Files:** (all new, parallel group C)
- `src/activities/screen-fill/fill-modes/tile-patterns/SquarePattern.js`
- `src/activities/screen-fill/fill-modes/tile-patterns/HexPattern.js`
- `src/activities/screen-fill/fill-modes/tile-patterns/TrianglePattern.js`
- `src/activities/screen-fill/fill-modes/tile-patterns/BrickPattern.js`

**Depends on:** Nothing (pure geometry)
**Parallel group:** A

Each exports a function:
```
generateTiles(screenWidth, screenHeight, targetSize)
→ Array<{ id, x, y, points, centerX, centerY }>
```

- `x, y` is the top-left origin of the tile's bounding area
- `points` is an array of `[x,y]` pairs defining the polygon vertices (for `Graphics.poly()`)
- `centerX, centerY` is the tile center (for hit testing: "which tile is nearest to stamp position?")
- `id` is the flat index

**SquarePattern:** Regular grid. Each tile is a rectangle. Straightforward.

**HexPattern:** Pointy-top hexagons. Every other row offset by half a hex width. Uses `regularPoly` coordinates (6 sides). Row stagger formula: `offsetX = (row % 2) * hexWidth / 2`.

**TrianglePattern:** Alternating up/down equilateral triangles. Two triangles per grid cell. Up-triangle points up, down-triangle points down. They tile perfectly.

**BrickPattern:** Rectangular tiles, every other row offset by half the tile width. Like square but with 2:1 aspect ratio and row offset.

Each pattern must cover the full screen with no gaps. Tiles at edges may extend slightly beyond screen bounds (acceptable — clipped by PixiJS stage).

---

### Step 8 — MosaicFillMode
**File:** `src/activities/screen-fill/fill-modes/MosaicFillMode.js` (new)
**Depends on:** BaseFillMode (Step 1), Tile Patterns (Step 7)
**Parallel group:** D (after Steps 1, 7)

Core approach:
- `init(app, options)`: Generate tile layout using selected pattern. Create a Container. For each tile, create a Graphics object drawn with the tile's polygon, initially filled with a dim/outline appearance (dark grey fill, faint white stroke). Store in `this.tiles[]` array with `{ graphics, filled, centerX, centerY }`.
- `stamp({ x, y, colour, size, impactMultiplier })`:
  1. Find the **nearest unfilled tile** to `(x, y)` using Euclidean distance to tile centers. If all tiles filled, no-op.
  2. Mark tile as filled. Redraw that tile's Graphics with the switch colour fill.
  3. Play pop animation: scale tile Graphics to 1.3x then tween back to 1.0x over ~200ms (via PixiJS ticker callback, same pattern as effect fade).
- `getPercentage()`: `filledCount / totalTiles * 100`
- `getDisplayObject()`: the Container of tile Graphics
- `setPattern(patternName)`: switch tile pattern. Destroys current tiles, regenerates.
- `cyclePattern()`: advance to next pattern.

**Tile target size:** ~40px (larger than CoverageGrid's ~19px cells because tiles need to be visually distinct). Configurable via `options.tileSize`.

**Hit detection:** Simple nearest-center approach. No need for point-in-polygon — if a press is closest to tile T, tile T fills. This is fast (iterate all unfilled tiles, find min distance) and works for all patterns.

**Pop animation:** On stamp, set tile Graphics `scale = 1.3`, then each tick reduce scale toward 1.0 over ~200ms. Use a small array of "animating tiles" checked each `update()` call. Same fire-and-forget pattern as effects.

---

### Step 9 — REMOVED (Shape Library — deferred to separate app)
Shape library and shape definitions deferred to the Shape Targets / Mystery Paint separate app.

---

### Step 10 — REMOVED (ShapeTargetFillMode — deferred to separate app)
Shape Target fill mode deferred to the Shape Targets / Mystery Paint separate app.

---

### Step 11 — Refactor ScreenFillActivity to use FillMode
**File:** `src/activities/screen-fill/ScreenFillActivity.js` (modify)
**Depends on:** StandardFillMode (Step 5), MosaicFillMode (Step 8)
**Parallel group:** D (after Steps 5, 8)

Changes:
1. Remove direct PaintLayer and CoverageGrid creation from `init()`. Instead, create a `StandardFillMode` as the default fill mode.
2. Add `this.fillMode` property. Add fill mode's display object to stage (where paintLayer was).
3. Replace `handleInput()` stamp logic: instead of calling `paintLayer.stamp()` + `coverageGrid.markFilled()`, call `this.fillMode.stamp({ x, y, colour, size: 30, impactMultiplier })`.
4. Replace `this.coverageGrid.getPercentage()` with `this.fillMode.getPercentage()`.
5. `clear()`: call `this.fillMode.reset()` instead of `paintLayer.clear()` + `coverageGrid.reset()`.
6. `handleResize()`: call `this.fillMode.resize()`.
7. `destroy()`: call `this.fillMode.destroy()`.
8. Add `setFillMode(modeName, options)` method:
   - Destroy current fill mode
  - Instantiate new fill mode by name (standard or mosaic)
   - Init it with app
   - Add display object to stage
   - Reset timer, progress, completion state
9. Add `cycleFillMode()` — toggles between standard and mosaic.
10. Add pass-through methods: `cycleFillModeOption()`, `cycleStampShape()` — delegates to current fill mode if applicable.

**BiasedRandomMode dependency:** BiasedRandomMode currently takes a CoverageGrid in its constructor. When fill mode changes, the position mode needs updating. Solutions:
- StandardFillMode exposes its CoverageGrid via `getCoverageGrid()`.
- MosaicFillMode exposes a lightweight adapter that implements `getRandomUnfilledCell()` using its tile array.
- ScreenFillActivity re-initializes BiasedRandomMode when fill mode changes, passing the new grid/adapter.

---

### Step 12 — Keyboard shortcuts in main.js
**File:** `src/main.js` (modify)
**Depends on:** ScreenFillActivity refactor (Step 11)
**Parallel group:** G (after Step 11)

Add to the keydown handler:
- `KeyF` → `currentActivity?.cycleFillMode?.()`
- `KeyG` → `currentActivity?.cycleFillModeOption?.()`
- `KeyT` → `currentActivity?.cycleStampShape?.()`
- `Equal` (+ key) → `currentActivity?.increaseStampSize?.()`
- `Minus` (- key) → `currentActivity?.decreaseStampSize?.()`

Update the console.log help text to include new shortcuts.

These shortcuts only fire if the current activity supports the method (duck typing, same as existing shortcuts).

---

## Task Dependencies Graph

```
Step 1 (BaseFillMode)       ─┐
Step 3 (ShapeStamper)        ├───→ Step 4 (PaintLayer shape) ──→ Step 5 (StandardFillMode) ──┐
Step 7 (Tile Patterns)       │                                                                 │
                             │                                                                 │
                             └───→ Step 8 (MosaicFillMode) ───────────────────────────────────┤
                                                                                               │
                                                                          Step 11 (Refactor) ──┤
                                                                                               │
                                                                          Step 12 (Shortcuts) ─┘
```

**Parallelizable groups:**
- **Wave A** (no deps): Steps 1, 3, 7
- **Wave B** (needs Wave A): Steps 4, 5, 8
- **Wave C** (needs all modes): Step 11
- **Wave D** (needs Step 11): Step 12

---

## Edge Cases to Handle

1. **Window resize during Mosaic mode**: All tiles must be destroyed and regenerated at new dimensions. In-progress fill state is lost (acceptable — same as current PaintLayer resize behaviour).

2. **Fill mode switch mid-game**: Reset timer, progress, celebration state. Equivalent to Ctrl+R clear + mode change. Students must restart.

3. **BiasedRandomMode with Mosaic tiles**: Mosaic has no CoverageGrid. BiasedRandomMode needs an adapter that wraps the tile array's `getRandomUnfilledTile()` as `getRandomUnfilledCell()`. The adapter returns the tile's center coordinates.

4. **Mystery mode + Paint outside shape**: Paint renders to PaintLayer RenderTexture but is masked by the shape Graphics. If the student later switches to a different shape, the accumulated hidden paint stays on the RenderTexture but the mask changes. Solution: on shape change, clear PaintLayer.

5. **Shape rasterization at different resolutions**: When CoverageGrid resizes (different screen dimensions), shape masks must be re-rasterized at the new grid resolution. `ShapeTargetFillMode.resize()` must call `rasterize()` again and `setMask()`.

6. **Hexagon hit detection**: Nearest-center works for hex grids because hex tiles have uniform spacing. No special case needed.

7. **Triangle tile pop animation**: Triangles have their center of mass at `(centroid)`, not geometric center. The `centerX/centerY` returned by TrianglePattern must be the centroid for correct scale origin.

8. **Degenerate shapes in shape library**: A shape that occupies <5% of the screen would be frustrating. Shape definitions should target 30-60% screen coverage. ShapeLibrary should document expected coverage range.

9. **Mosaic tile count**: At ~40px tile size on 1920×1080, squares = ~48×27 = 1296 tiles. Hex/triangle patterns will be similar. PixiJS handles thousands of Graphics objects fine, but each tile should use a shared GraphicsContext (PixiJS v8 feature) where possible to reduce GPU draw calls.

---

## Open Questions

1. **Mosaic tile appearance when unfilled**: Should unfilled tiles be invisible (just a faint grid outline), or have a visible dim fill? A dim fill makes the pattern visible and gives students a target. Recommend: faint dark fill + thin white stroke.

2. **Shape Stamps size vs circle**: Should shaped stamps cover the same area as a circle of the same radius, or the same bounding box? Bounding box is simpler and means `impactMultiplier` works the same way. Recommend: same bounding box (shape inscribed in radius).

3. **Shape Target difficulty**: Some shapes (cat, butterfly) have complex silhouettes with thin parts that are hard to fill. Should BiasedRandomMode bias toward the shape mask, or toward unfilled-within-mask? The latter (unfilled within mask) is already handled by the CoverageGrid mask integration in Step 2.

4. **Sound integration (Phase 5 dependency)**: Mosaic tiles popping and shape target reveals could have unique sounds. This is a Phase 5 concern — no sound wiring needed in Phase 4b.

---

## Verification Checklist

- [ ] Standard fill mode works identically to current behaviour with circle stamps (regression)
- [ ] Standard: all 6 stamp shapes render correctly in PaintLayer
- [ ] Standard: per-switch, global, and random shape assignment modes work
- [ ] Mosaic Squares: full grid of tiles, press fills nearest tile with colour, pop animation plays
- [ ] Mosaic Hexagons: honeycomb layout, correct stagger, full coverage
- [ ] Mosaic Triangles: tessellating up/down triangles, no gaps
- [ ] Mosaic Bricks: offset rows, correct aspect ratio
- [ ] Mosaic: progress bar tracks percentage of filled tiles
- [ ] Fill mode switching via `F` key works, resets state
- [ ] All position modes (random, cursor, sweep) work with both fill modes
- [ ] BiasedRandomMode correctly targets unfilled areas in both fill modes
- [ ] Window resize works for both fill modes
- [ ] Ctrl+R clear works for both fill modes
- [ ] Timer starts on first press for both fill modes
- [ ] Celebration fires at 100% for both fill modes
- [ ] No memory leaks: fill mode destroy cleans up all Graphics/Containers
