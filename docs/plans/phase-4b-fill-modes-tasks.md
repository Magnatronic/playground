# Phase 4b: Fill Modes — Task List

## Wave A — No dependencies (parallelizable)

- [ ] **Task 1: BaseFillMode interface**
  - File: `src/activities/screen-fill/fill-modes/BaseFillMode.js` (new)
  - Create abstract base class with methods: `init`, `stamp`, `getPercentage`, `getDisplayObject`, `reset`, `resize`, `destroy`
  - All methods throw "not implemented"

- [ ] **Task 2: CoverageGrid mask support**
  - File: `src/activities/screen-fill/CoverageGrid.js` (modify)
  - Add `setMask(maskArray)`, `clearMask()` methods
  - Update `markFilled()` to skip cells where mask is 0
  - Update `getPercentage()` to use masked total as denominator
  - Update `getRandomUnfilledCell()` to respect mask
  - Handle edge case: mask with zero valid cells

- [ ] **Task 3: ShapeStamper utility**
  - File: `src/activities/screen-fill/fill-modes/ShapeStamper.js` (new)
  - Implement `drawShape(graphics, shapeName, radius)` for: circle, square, triangle, star, heart, diamond
  - Export `SHAPE_NAMES` array
  - All shapes drawn centered at (0,0) within bounding radius

- [ ] **Task 4: Tile pattern — Squares**
  - File: `src/activities/screen-fill/fill-modes/tile-patterns/SquarePattern.js` (new)
  - Export `generateTiles(screenWidth, screenHeight, targetSize)` returning tile array
  - Each tile: `{ id, points, centerX, centerY }`

- [ ] **Task 5: Tile pattern — Hexagons**
  - File: `src/activities/screen-fill/fill-modes/tile-patterns/HexPattern.js` (new)
  - Pointy-top hexagons with row stagger
  - Full screen coverage, no gaps

- [ ] **Task 6: Tile pattern — Triangles**
  - File: `src/activities/screen-fill/fill-modes/tile-patterns/TrianglePattern.js` (new)
  - Alternating up/down equilateral triangles
  - centerX/centerY at centroid

- [ ] **Task 7: Tile pattern — Bricks**
  - File: `src/activities/screen-fill/fill-modes/tile-patterns/BrickPattern.js` (new)
  - 2:1 aspect ratio rectangles, every other row offset half-width

- [ ] **Task 8: Shape library — geometric shapes**
  - File: `src/activities/screen-fill/fill-modes/shape-library/geometric.js` (new)
  - Implement `draw` and `rasterize` functions for: Star, Heart, Circle, Moon, Diamond, Lightning
  - Each shape targets 30-60% screen coverage

- [ ] **Task 9: Shape library — animal shapes**
  - File: `src/activities/screen-fill/fill-modes/shape-library/animals.js` (new)
  - Implement `draw` and `rasterize` for: Cat, Dog, Fish, Butterfly
  - Simple silhouettes using bezier curves and arcs

- [ ] **Task 10: Shape library — object shapes**
  - File: `src/activities/screen-fill/fill-modes/shape-library/objects.js` (new)
  - Implement `draw` and `rasterize` for: House, Tree

- [ ] **Task 11: ShapeLibrary registry**
  - File: `src/activities/screen-fill/fill-modes/shape-library/ShapeLibrary.js` (new)
  - Registry mapping names to `{ draw, rasterize, label }` entries
  - Export `getShape()`, `getShapeNames()`, `getRandomShape()`

## Wave B — Needs Wave A

- [ ] **Task 12: PaintLayer shape stamp support**
  - File: `src/painting/PaintLayer.js` (modify)
  - Add optional `shape` parameter to `stamp()` (default: `'circle'`)
  - Import ShapeStamper; use `drawShape()` when shape is not `'circle'`
  - Depends on: Task 3

- [ ] **Task 13: StandardFillMode**
  - File: `src/activities/screen-fill/fill-modes/StandardFillMode.js` (new)
  - Wraps PaintLayer + CoverageGrid (current behaviour)
  - Exposes `getCoverageGrid()` for BiasedRandomMode
  - Depends on: Tasks 1, 2

## Wave C — Needs Waves A and B

- [ ] **Task 14: ShapeStampsFillMode**
  - File: `src/activities/screen-fill/fill-modes/ShapeStampsFillMode.js` (new)
  - Extends/composes StandardFillMode
  - Shape assignment: per-switch, global, random
  - Methods: `setShapeAssignment()`, `setCurrentShape()`, `cycleShape()`
  - Depends on: Tasks 1, 2, 3, 12

- [ ] **Task 15: MosaicFillMode**
  - File: `src/activities/screen-fill/fill-modes/MosaicFillMode.js` (new)
  - Creates Container of tile Graphics objects from selected pattern
  - Nearest-tile hit detection on stamp
  - Pop animation (scale 1.3→1.0 over 200ms)
  - Exposes getRandomUnfilledCell adapter for BiasedRandomMode
  - Methods: `setPattern()`, `cyclePattern()`
  - Depends on: Tasks 1, 4-7

- [ ] **Task 16: ShapeTargetFillMode**
  - File: `src/activities/screen-fill/fill-modes/ShapeTargetFillMode.js` (new)
  - Colouring sub-mode: visible outline, no PaintLayer mask
  - Mystery sub-mode: PaintLayer mask = shape Graphics, no outline
  - Applies CoverageGrid mask from rasterized shape
  - Methods: `setSubMode()`, `setShape()`, `cycleShape()`, `cycleSubMode()`
  - Depends on: Tasks 1, 2, 8-11

## Wave D — Needs all fill modes

- [ ] **Task 17: Refactor ScreenFillActivity to use FillMode**
  - File: `src/activities/screen-fill/ScreenFillActivity.js` (modify)
  - Replace direct PaintLayer/CoverageGrid with `this.fillMode`
  - Default to StandardFillMode
  - Add `setFillMode()`, `cycleFillMode()`, pass-through option methods
  - Update BiasedRandomMode when fill mode changes
  - Wire all lifecycle methods through fill mode
  - Depends on: Tasks 13-16

## Wave E — Needs refactored activity

- [ ] **Task 18: Keyboard shortcuts in main.js**
  - File: `src/main.js` (modify)
  - F = cycle fill mode, G = cycle mode option, H = cycle target shape, T = cycle stamp shape
  - Update console.log help text
  - Depends on: Task 17
