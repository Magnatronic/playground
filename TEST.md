# Playground — Manual QA Checklist

> Run the full checklist after completing each phase. Previous phases' checks act as regression tests.

---

## Phase 1: Project Scaffold & Core Systems

- [x] App boots without errors
- [x] Canvas fills entire viewport (no scrollbars)
- [x] Canvas resizes correctly on window resize
- [x] Space key does NOT scroll the page
- [x] Arrow keys do NOT scroll the page
- [x] F7/F8 do NOT trigger browser actions
- [x] All 8 keys log correct switch profile (key, colour, impact multiplier)
- [x] Pressing multiple keys simultaneously tracks all of them
- [x] Key release is detected correctly

---

## Phase 2: Effect System

- [x] Solid circle renders with correct colour
- [x] Soft brush renders with feathered edge
- [x] Smoke effect emits particles that drift and fade
- [x] Starburst effect emits radial burst particles
- [x] All effects fade over time
- [x] Impact multiplier scales effect size
- [x] **Phase 1 checks still pass**

---

## Phase 3: Collaborative Painting

- [x] Random mode: press paints at random position each time
- [x] Cursor mode: press paints at current mouse/touch position
- [x] Sweep mode: cursor moves continuously across screen
- [x] Sweep mode: press paints at sweep cursor position
- [x] Sweep speed is adjustable
- [x] Sweep works in both horizontal and vertical patterns
- [x] Each switch paints in its assigned colour
- [x] Impact multiplier scales effect size per switch
- [x] Debounce/cooldown works (rapid presses don't flood)
- [x] Can switch between all 3 modes
- [x] **Phase 1 & 2 checks still pass**

---

## Phase 4: Screen Fill Challenge

- [x] Random mode: paint biased toward unfilled areas
- [x] Sweep mode: reuses sweep cursor from painting
- [x] Progress bar updates as coverage increases
- [x] Timer starts on first press
- [x] Timer displays as MM:SS
- [x] 100% coverage triggers celebration
- [x] Timer stops on completion
- [x] Celebration auto-dismisses after a few seconds
- [x] **Phase 1–3 checks still pass**

---

## Phase 4b: Fill Modes

### Standard Fill Mode
- [x] Standard fill mode works identically to Phase 4 behaviour (circle stamps)
- [x] All position modes (random, cursor, sweep) work with standard fill
- [x] 10 stamp shapes render correctly: circle, square, triangle, rectangle, diamond, pentagon, hexagon, star, parallelogram, trapezoid
- [x] Per-switch assignment: different switches produce different shapes
- [x] Global assignment: all switches use the same shape
- [x] Random assignment: each press produces a random shape
- [x] Stamp shape cycles via keyboard shortcut (T key)
- [x] Stamp size adjustable via +/- keys
- [x] Coverage tracking works correctly with all stamp shapes

### Mosaic Tiles
- [x] Square pattern: full grid, no gaps, press fills nearest tile
- [x] Hexagon pattern: honeycomb layout with correct stagger and edge coverage
- [x] Triangle pattern: tessellating up/down triangles
- [x] Brick pattern: offset rows with correct aspect ratio and edge coverage
- [x] Progress bar tracks filled tile percentage accurately
- [x] BiasedRandomMode targets unfilled tiles correctly
- [x] Tile size adjustable via +/- keys
- [x] Cursor/sweep mode: only fills tile under cursor, not distant tiles
- [x] Zero scatter in mosaic mode for accurate tile selection

### Fill Mode Integration
- [x] F key cycles fill modes: standard → mosaic
- [x] G key cycles fill mode options (stamp shape assignment / tile pattern)
- [x] Fill mode switch resets timer, progress, and completion state
- [x] All position modes (random, cursor, sweep) work with both fill modes
- [x] Ctrl+R clear works for both fill modes
- [x] Timer and celebration work for both fill modes
- [x] Window resize works for both fill modes (deferred resize, no distortion)
- [x] **Phase 1–4 checks still pass**

---

## Phase 5: Audio

- [x] Paint press produces a pitched sound (different pitch per switch)
- [x] Completion fanfare plays dramatic arpeggio + chord on 100% fill
- [x] Mute toggle (Ctrl+M) silences all sounds
- [x] Unmute (Ctrl+M again) restores sounds
- [x] No audio errors on first interaction (lazy AudioContext init)
- [x] Sounds work in both Painting and Screen Fill activities
- [x] **Phase 1–4b checks still pass**

---

## Phase 6: UI — Menu & Settings

### Navigation
- [ ] App starts on Home Screen (activity cards visible)
- [ ] Can launch Collaborative Painting from Home Screen card
- [ ] Can launch Screen Fill from Home Screen card
- [ ] Activity header shows correct activity name
- [ ] Home button in header returns to Home Screen
- [ ] Activity is destroyed when returning to Home (no orphaned DOM)
- [ ] Gear icon opens Settings Panel
- [ ] Escape opens Settings Panel from activity
- [ ] Escape closes Settings Panel back to activity
- [ ] Escape does nothing on Home Screen
- [ ] URL param `?activity=painting` bypasses Home Screen and launches directly

### Settings Panel
- [ ] Settings Panel slides in from right
- [ ] Settings Panel slides out on close
- [ ] Close button (✕) closes Settings Panel
- [ ] Panel shows only relevant sections for current activity
- [ ] Painting sections hidden during Screen Fill
- [ ] Screen Fill sections hidden during Painting

### Settings: Sound
- [ ] Mute toggle mutes all sounds
- [ ] Mute toggle unmutes sounds
- [ ] Ctrl+M still works as mute shortcut

### Settings: Position Mode
- [ ] Can change to Random mode
- [ ] Can change to Cursor mode
- [ ] Can change to Sweep mode
- [ ] Sweep sub-options appear when Sweep is selected
- [ ] Sweep sub-options hidden when Random/Cursor selected
- [ ] Sweep speed slider adjusts sweep speed
- [ ] Sweep pattern options change sweep pattern

### Settings: Effect Type (Painting only)
- [ ] Can change effect type to each of the 4 types
- [ ] Changed effect type applies immediately on next press

### Settings: Effect Settings (Painting only)
- [ ] Size slider changes effect size
- [ ] Opacity slider changes effect opacity
- [ ] Scatter slider changes scatter amount

### Settings: Blend Mode (Painting only)
- [ ] Can change blend mode
- [ ] Changed blend mode applies immediately

### Settings: Fill Mode (Screen Fill only)
- [ ] Can switch between Standard and Mosaic fill modes
- [ ] Fill mode change resets timer and progress
- [ ] Standard sub-options: shape assignment, stamp size
- [ ] Mosaic sub-options: tile pattern, tile size
- [ ] Sub-options apply immediately

### Settings: Switches
- [ ] All 8 switches listed with label, colour, and multiplier
- [ ] Can change switch colour via colour picker
- [ ] Can change impact multiplier via slider
- [ ] Changed colour applies to next press
- [ ] Changed multiplier applies to next press

### Settings: Actions
- [ ] Clear Canvas button clears the canvas
- [ ] Ctrl+R still works as clear shortcut
- [ ] Reset Defaults restores all settings to initial values
- [ ] Reset Defaults restores switch profiles to defaults

### Switch Safety
- [ ] Space/Enter/Arrow/F7/F8 keys do NOT interact with UI controls
- [ ] Switch presses produce no effect while Home Screen is visible
- [ ] Switch presses produce no effect while Settings Panel is open
- [ ] Switch presses resume working after Settings Panel is closed

### Touch & Responsiveness
- [ ] All controls work via touch (no hover-only interactions)
- [ ] All touch targets ≥ 48px
- [ ] Settings Panel responsive at 768px and 1024px widths
- [ ] Home Screen cards reflow on narrow viewport
- [ ] Window resize while Settings Panel open — no layout breakage

### Regression
- [ ] **Phase 1–5 checks still pass**

---

## Phase 7: Polish & Device Compatibility

- [ ] Canvas handles orientation change (iPad)
- [ ] Touch events work for cursor mode (iPad)
- [ ] Fullscreen button/shortcut works
- [ ] No iOS bounce/zoom on touch
- [ ] 60fps with all effects active + 8 simultaneous inputs (Chrome laptop)
- [ ] 60fps on Safari iPad
- [ ] GitHub Pages deployment works
- [ ] **All previous checks still pass**
