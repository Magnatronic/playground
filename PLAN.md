# Plan: Playground — Accessibility-First Switch Activity App

## TL;DR
Build a browser-based, WebGL-powered activity app for students with physical/learning disabilities. Uses PixiJS for professional-quality particle/smoke/fluid effects. Vite for build tooling (needed for npm deps, deploys easily to GitHub Pages). Two activities: Collaborative Painting and Screen Fill Challenge (with fill modes: standard and mosaic tiles). Runs on a single shared screen (projector/TV/whiteboard) with up to 8 Bluetooth switches mapped to keyboard keys.

---

## Decisions (from discussion)

- **Display**: Single shared screen (projector/TV) — all students see the same display
- **Cursor mode**: Teacher controls mouse cursor, students press switches to paint at that location
- **Persistence**: Settings reset each session (no localStorage)
- **Graphics**: WebGL via PixiJS for particle/smoke/fluid effects
- **Build**: Vite + vanilla JS (needed for PixiJS npm package, auto-deploys to GitHub Pages)
- **Keys**: 8 default keys (Space, Enter, 4 arrows, F7, F8), extensible architecture
- **Targets**: Laptop + projector, interactive whiteboard, iPad/tablet
- **Sound**: Basic sound effects included from the start (Web Audio API)
- **Teacher controls**: Settings panel + keyboard shortcuts (e.g., Ctrl+R reset, Escape for menu)

---

## Project Structure

```
playground/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   └── sounds/           # Sound effect files (Phase 5)
├── src/
│   ├── main.js           # Entry: init PixiJS app, wire activity
│   ├── input/
│   │   └── InputManager.js    # Core keydown/keyup tracking, key states, multi-key
│   ├── switches/
│   │   ├── SwitchProfile.js   # Key, colour, impact multiplier
│   │   └── SwitchManager.js   # 8 profiles (Wong's palette), lookup by key
│   ├── effects/
│   │   ├── BaseEffect.js      # Abstract effect with scatter + fadeAndRemove
│   │   ├── EffectFactory.js   # Creates effect by type name
│   │   ├── SolidCircle.js     # Graphics circle, colour-filled
│   │   ├── SoftBrush.js       # Radial gradient sprite
│   │   ├── SmokeEffect.js     # Manual particle smoke (drift + fade)
│   │   └── StarburstEffect.js # Manual particle radial burst
│   ├── painting/
│   │   └── PaintLayer.js      # RenderTexture persistent paint, stamps, blend modes
│   ├── activities/
│   │   ├── BaseActivity.js    # Abstract: init(), update(), handleInput(), destroy()
│   │   ├── painting/
│   │   │   ├── PaintingActivity.js  # Orchestrates modes + effects + paint layer
│   │   │   └── modes/
│   │   │       ├── RandomMode.js    # Random position per press
│   │   │       ├── CursorMode.js    # Teacher mouse/touch position
│   │   │       └── SweepMode.js     # Auto-moving cursor, 4 patterns
│   │   └── screen-fill/
│   │       ├── ScreenFillActivity.js  # Coverage tracking + fill mode orchestration
│   │       ├── CoverageGrid.js        # Low-res coverage bitmap with mask support
│   │       ├── BiasedRandomMode.js    # Random positions biased to unfilled cells
│   │       └── fill-modes/
│   │           ├── BaseFillMode.js        # Abstract fill mode interface
│   │           ├── StandardFillMode.js    # RenderTexture stamps with shape selection (default)
│   │           ├── ShapeStamper.js        # Geometric shape drawing utility
│   │           ├── MosaicFillMode.js      # Tile grid fill (Phase 4b)
│   │           ├── tile-patterns/         # Mosaic tile layouts
│   │           │   ├── SquarePattern.js
│   │           │   ├── HexPattern.js
│   │           │   ├── TrianglePattern.js
│   │           │   └── BrickPattern.js
│   ├── audio/
│   │   └── AudioManager.js   # Web Audio API (Phase 5)
│   ├── utils/
│   │   └── colour.js          # Hex string → number conversion for PixiJS
│   └── ui/
│       ├── Menu.js            # Activity selection (Phase 6)
│       ├── SettingsPanel.js   # Settings overlay (Phase 6)
│       ├── ProgressBar.js     # Screen fill progress (Phase 4)
│       └── Celebration.js     # Completion animation (Phase 4)
├── SPEC.md
├── PLAN.md
└── TEST.md
```

---

## Implementation Phases

### Phase 1: Project Scaffold & Core Systems
**Goal**: Runnable app with PixiJS canvas and input handling

1. Initialize Vite project with PixiJS dependency (`pixi.js`, `pixi-particle-system`)
2. Create `index.html` — fullscreen canvas, no scrolling, prevent default on mapped keys
3. `src/main.js` — Initialize PixiJS Application (WebGL renderer, full viewport, resize handling)
4. `src/input/InputManager.js` — keydown/keyup listeners, track pressed/released/held states, support simultaneous keys. Prevent browser defaults for Space (scroll), arrows, F-keys.
5. `src/switches/SwitchProfile.js` — data class: `{ key, colour, impactMultiplier }`
6. `src/switches/SwitchManager.js` — default 8 profiles with distinct colours, lookup by key code

**Verification**: App boots, shows blank canvas, console logs key presses with correct switch profile data.

---

### Phase 2: Effect System
**Goal**: Four working effects rendered via PixiJS

1. `src/effects/EffectFactory.js` — factory function: takes effect type name, returns effect instance
2. `SolidCircle.js` — PixiJS Graphics circle with switch colour, size scaled by impact multiplier
3. `SoftBrush.js` — Sprite with radial gradient texture, alpha blending
4. `SmokeEffect.js` — Manual particle system (Graphics + Ticker), drift upward, grow, fade
5. `StarburstEffect.js` — Manual particle system, radial burst, shrink + fade
6. All effects accept: `{ x, y, colour, size, opacity, scatter, impactMultiplier }` — scatter randomizes position offset
7. Effects support fade-over-time via PixiJS ticker alpha reduction

**Verification**: Manually trigger each effect at screen center, confirm rendering and fade.

---

### Phase 3: Collaborative Painting Activity
**Goal**: Full painting activity with 3 modes

1. `src/activities/BaseActivity.js` — abstract class with `init(pixiApp)`, `update(delta)`, `handleInput(switchProfile, eventType)`, `destroy()`, `getInputConfig()` — activity declares its input behavior (debounce, hold-to-repeat, etc.)
2. `src/activities/painting/PaintingActivity.js` — manages mode switching, delegates input to active mode, applies global effect type
3. `RandomMode.js` — on press: pick random x/y, spawn effect at position
4. `CursorMode.js` — track mouse/touch position, on switch press: spawn effect at pointer location
5. `SweepMode.js` — auto-moving cursor, 4 patterns (horizontal, vertical, bounce, systematic), configurable speed, visible crosshair indicator
6. Wire `InputManager` → `SwitchManager` → active activity's `handleInput()`
7. Activity-level input config: painting uses single-press with optional debounce (configurable cooldown)
8. `src/painting/PaintLayer.js` — persistent RenderTexture paint layer with solid + soft stamps, 4 blend modes (normal, add, multiply, screen), clear/reset support

**Verification**: Switch between all 3 modes, confirm persistent paint marks stay on screen, each switch paints in its assigned colour, impact multiplier scales effect size, blend modes change appearance, Ctrl+R clears canvas.

---

### Phase 4: Screen Fill Challenge
**Goal**: Coverage-based collaborative activity

1. `src/activities/screen-fill/ScreenFillActivity.js`:
   - Maintain off-screen coverage bitmap (low-res grid, e.g., 100x60 cells) to track filled areas
   - Random mode: bias position toward unfilled cells
   - Sweep mode: reuse SweepMode logic from painting
   - Reuse `PaintLayer` from Phase 3 for persistent paint marks
   - Blend mode: always use opaque stamps (`normal`) for clear coverage visibility
2. Coverage calculation: percentage of filled cells → `ProgressBar` component
3. Timer: count-up timer (started on first press, paused on completion), display as MM:SS
4. Completion detection: when coverage ≥ 100%, trigger celebration
5. `src/ui/Celebration.js` — fullscreen particle burst + fade, auto-dismiss after 3-5 seconds

**Verification**: Fill screen to 100%, confirm progress bar updates, timer stops, celebration fires.

---

### Phase 4b: Fill Modes for Screen Fill Challenge
**Goal**: Two fill modes that offer different visual experiences for the Screen Fill

The Screen Fill Challenge gains a fill mode system with two modes:

**Standard** (default) — Stamps on RenderTexture with configurable stamp shape. Shapes: circle (default), square, triangle, rectangle, diamond, pentagon, hexagon, star, parallelogram, trapezoid. Shape assignment: per-switch (each switch uses a different shape), global (teacher picks one), or random (each press picks randomly). Stamp size configurable via +/- keys (10–80px, 10px steps). Stamp shapes extensible for future additions.

**Mosaic Tiles** — Screen divided into a pre-drawn tile grid. Presses fill the nearest unfilled tile with the switch's colour + pop animation. Four tile patterns: squares, hexagons, triangles, bricks. Structured and satisfying — every tile is a visible target.

Implementation approach:
1. `BaseFillMode` strategy interface — `init()`, `stamp()`, `getPercentage()`, `getDisplayObject()`, `reset()`, `resize()`, `destroy()`
2. `ScreenFillActivity` delegates stamp rendering + coverage tracking to the active fill mode
3. `PaintLayer.stamp()` gains optional `shape` parameter for stamp shape selection
4. `ShapeStamper` utility draws geometric shapes via PixiJS Graphics API
5. Mosaic mode uses 2-layer Graphics (unfilled + filled) for performance instead of per-tile objects
6. Stamp/tile size configurable via +/- keys — too small and fill takes forever; teacher adjusts for session pacing. Mosaic tile size: 15–120px range.
7. Temporary keyboard shortcuts: F=cycle fill mode, G=cycle option (stamp shape assignment / tile pattern), T=cycle stamp shape, +/- = increase/decrease stamp size

**Verification**: Both fill modes work with all 3 position modes (random/cursor/sweep). Progress bar, timer, and celebration work for both fill modes. Fill mode switching resets state.

---

### Phase 5: Audio System
**Goal**: Sound feedback for interactions and completion

1. `src/audio/AudioManager.js` — Singleton audio engine using Web Audio API with procedural synthesis (no sound files). Lazy AudioContext init on first user gesture for browser autoplay policy. Master GainNode for mute control.
2. Sound effects:
   - Paint press: pentatonic-pitched sine tone per switch (C5-E6 scale mapped to switch index 0-7, 80ms, volume 0.2)
   - Completion fanfare: 6-note ascending triangle arpeggio (C5->G6, ~1s) followed by sustained open chord (C5+G5+E6, 800ms) - total ~1.8s dramatic celebration sound
3. Each switch has an `index` property (0-7) on `SwitchProfile`, wired in `SwitchManager`, used for pitch mapping
4. Mute toggle via `Ctrl+M` keyboard shortcut - session-scoped, resets to unmuted on page reload
5. Press sound wired into both `PaintingActivity.handleInput()` and `ScreenFillActivity.handleInput()`
6. Fanfare wired into `ScreenFillActivity` completion block (100% only)
7. Conservative volumes (0.15-0.45) to support 8 simultaneous inputs without clipping

**Verification**: Toggle mute via Ctrl+M, confirm press sounds play with different pitches per switch, confirm fanfare plays on Screen Fill 100% completion.

---

### Phase 6: UI — Menu & Settings
**Goal**: Teacher-friendly controls

1. `src/ui/Menu.js` — Activity selection screen: large icon buttons for each activity, minimal text, accessible contrast
2. `src/ui/SettingsPanel.js` — slide-in overlay (Escape key + gear icon toggle):
   - Switch profiles: edit colour, impact multiplier per switch
   - Effect type selector (global): solid circle / soft brush / smoke / starburst
   - Sweep settings: speed slider, pattern toggle (H/V)
   - Sound toggle
   - Mode selector for current activity
   - Sweep pattern selector: horizontal / vertical / bounce / systematic
   - Blend mode selector: normal / add / multiply / screen
   - Effect settings: size slider, opacity slider, scatter slider
3. Keyboard shortcuts:
   - `Escape` — toggle settings panel / return to menu
   - `Ctrl+R` — reset/clear canvas
   - `Ctrl+M` — mute toggle
4. Touch-friendly controls for iPad/whiteboard (large tap targets, no hover-only interactions)
5. `src/app.js` — App shell: manages active activity lifecycle, handles switching between activities (painting ↔ screen fill), owns the menu state. Currently main.js hardcodes PaintingActivity — this must be refactored into an app shell that dynamically loads/destroys activities.

**Verification**: Navigate menu → activity → settings → back, all via both touch and keyboard. Reset clears canvas.

Note: Phase 6 must consolidate all temporary keyboard shortcuts (mode switching, effect types, sweep patterns, blend modes) into the settings panel UI. The UI should be collapsible, accessible, and consistent across all controls.

---

### Phase 7: Polish & Device Compatibility
**Goal**: Runs well on all target devices

1. Responsive canvas: ~~handle window resize~~ (done), orientation change (iPad — needs testing)
2. Touch event support for iPad (in addition to mouse events for cursor mode)
3. iPad touch-as-switch: map screen tap zones to switch inputs for testing without physical switches
4. Fullscreen API button (F11 or tap) for projector/whiteboard use
5. Performance: test on low-spec hardware, reduce particle count if FPS drops below 50
6. WebGL fallback: graceful error message if WebGL is not supported (low-spec Chromebooks)
7. ~~Prevent iOS bounce/zoom (viewport meta, touch-action CSS)~~ (done in Phase 1)
8. GitHub Pages deployment: ~~base path config~~ (done), document deploy command
9. Generate README.md from real features

**Verification**: Test on Chrome (laptop), Safari (iPad), confirm 60fps with all effects active and 8 simultaneous inputs.

---

## Key Library Choices

| Need | Library | Why |
|------|---------|-----|
| Rendering | PixiJS v8 | WebGL 2D renderer, great particle support, handles low-spec hardware well |
| Particles | Manual (PixiJS Graphics) | @pixi/particle-emitter incompatible with PixiJS v8 — using manual particle systems with Graphics + Ticker |
| Build | Vite | Fast dev server, tree-shaking for PixiJS, trivial GitHub Pages deploy |
| Audio | Web Audio API (native) | No library needed, procedural sounds + sample playback |

---

## Scope Boundaries

**Included**: Two activities (painting + screen fill with 2 fill modes), 4 effects, 8 switches, audio, settings panel, GitHub Pages deploy

**Excluded**: MIDI input, music/rhythm activities, multiplayer networking, user accounts, backend — all listed as future extensions in spec

## Deferred Items

Items discussed during development, deferred to later phases or future work:

### Shape Targets / Mystery Paint (Separate App)
- Paint inside large silhouettes (colouring) or reveal hidden pictures (mystery mode)
- Discussed during Phase 4b planning — decided this is a different UX goal (discovery/colouring vs speed/coverage)
- Will be built as a separate web app with its own shape library, categories, and difficulty levels
- Core tech (CoverageGrid mask, PaintLayer masking) can be reused from this codebase

### Particle paint effects (Future)
- Smoke and starburst effects currently play as animations over the paint layer
- Future: particle trails could themselves leave persistent paint marks (particles "painting" as they move)
- Would require rendering particle paths onto the RenderTexture each frame

### iPad touch as switch input (Phase 7)
- Map screen tap zones to different switch inputs for testing without physical switches
- Useful for demo/testing scenarios where Bluetooth switches aren't available

### README regeneration (Phase 7)
- README.md deleted during planning (was outdated)
- Generate a proper README from real features after Phase 7 completion

### pixi-particle-system evaluation (Future)
- Installed but unused — @pixi/particle-emitter was incompatible with PixiJS v8
- pixi-particle-system is installed and v8-compatible but manual particles were simpler for current needs
- Evaluate for more complex effects (fluid, fire) in future activities

### Configurable effect settings (Phase 6)
- Effect size, opacity, and scatter are currently hardcoded in PaintingActivity
- Phase 6 settings panel should expose these as sliders
- Per-switch size/intensity variation (from SPEC §6.5) also needs implementing

---

## Further Considerations

1. **Canvas vs DOM for UI**: Menu and settings should be DOM overlays on top of the PixiJS canvas (easier for forms/buttons) rather than rendered in WebGL. PixiJS handles activity rendering only.
