# Phase 6: UI Menu & Settings — Implementation Plan

## Summary

Phase 6 transforms Playground from a developer-shortcut-driven prototype into a teacher-friendly application with proper navigation. The build introduces three DOM overlay screens — **Home Screen** (activity launcher), **Activity Header** (in-activity toolbar), and **Settings Panel** (all configuration) — orchestrated by an **AppShell** state machine that replaces `main.js`'s hardcoded activity switching. A centralised **AppState** holds all settings and notifies activities of changes via an observer pattern. An **ActivityRegistry** makes the system extensible — adding a new activity is a single registry entry. All UI is DOM-based (overlaying the PixiJS canvas), touch-first with 64px minimum touch targets, and **switch-safe** — the 8 Bluetooth switch keys (Space, Enter, arrows, F7, F8) cannot interact with UI elements. CSS uses custom properties and a BEM-lite naming convention in a single stylesheet. Every temporary keyboard shortcut in `main.js` (modes, effects, blend, fill cycling) is absorbed into the Settings Panel; only Escape, Ctrl+R, and Ctrl+M remain as global shortcuts.

---

## Table of Contents

1. [Critical Design Decisions](#1-critical-design-decisions)
2. [Information Architecture](#2-information-architecture)
3. [Navigation Flow](#3-navigation-flow)
4. [App State Model](#4-app-state-model)
5. [Component Breakdown & File Assignments](#5-component-breakdown--file-assignments)
6. [CSS Architecture](#6-css-architecture)
7. [Switch-Safety Strategy](#7-switch-safety-strategy)
8. [Accessibility Approach](#8-accessibility-approach)
9. [Settings Panel Design](#9-settings-panel-design)
10. [How the App Scales](#10-how-the-app-scales)
11. [Build Order (Waves)](#11-build-order-waves)
12. [Edge Cases](#12-edge-cases)
13. [Alternative Approaches Considered](#13-alternative-approaches-considered)
14. [Open Questions](#14-open-questions)
15. [Test Checklist Additions](#15-test-checklist-additions)

---

## 1. Critical Design Decisions

### 1.1 App Shell State Machine

**Current problem:** `main.js` hardcodes activity switching via `Digit9`/`Digit0` keys and owns all keyboard shortcut logic in a 130-line init function. There's no concept of screens or navigation state.

**Solution:** An `AppShell` class manages three top-level states:

| State | What's visible | PixiJS canvas | Switch input |
|-------|---------------|---------------|-------------|
| `HOME` | Home screen overlay | Hidden (dark background) | Disabled |
| `ACTIVITY` | Activity header + canvas | Active | Active |
| `SETTINGS` | Settings panel overlay + dimmed canvas | Paused (ticker running but input ignored) | Disabled |

The state machine is simple — no nested states, no history. Direct transitions:
- `HOME → ACTIVITY` (user picks an activity)
- `ACTIVITY → SETTINGS` (Escape key or gear icon tap)
- `SETTINGS → ACTIVITY` (Escape key or close button tap)
- `ACTIVITY → HOME` (Home button in activity header)
- `HOME → SETTINGS` is **not** a valid transition (settings are activity-contextual)

**Why not a router?** This is a single-page app with 3 states, not a multi-page website. A state machine is simpler, more predictable, and doesn't require URL manipulation or History API.

### 1.2 Switch-Safety via `tabindex="-1"` + Event Interception

**The tension:** WCAG 2.1 AA requires keyboard operability (SC 2.1.1), but the 8 switch keys (Space, Enter, arrows, F7, F8) overlap with standard keyboard interaction patterns. If a student wearing a switch accidentally triggers a UI button, it could disrupt the entire session.

**Resolution:**

All interactive UI elements use `tabindex="-1"` by default, making them unreachable via keyboard Tab navigation. Activation is mouse/touch only. This is an intentional, documented accessibility trade-off:

> **Rationale:** In this app, the teacher always has mouse/touch access (laptop trackpad, interactive whiteboard, iPad screen). Students interact exclusively via switches. Making UI keyboard-operable would create a **safety conflict** where switch presses could accidentally navigate settings or change activities. The teacher's mouse/touch access is the keyboard alternative. This falls under WCAG's "except where the underlying function requires input that depends on the path of the user's movement" spirit — the UI must be inert to keyboard input to protect switch users.

Additionally, an event listener on the UI overlay container intercepts all switch key events (`Space`, `Enter`, arrows, `F7`, `F8`) and calls `event.stopPropagation()` + `event.preventDefault()` to prevent any accidental button activation.

**Preserved keyboard shortcuts:**
- `Escape` — toggle settings / navigate back (not a switch key)
- `Ctrl+R` — clear canvas (modifier combos are not switch keys)
- `Ctrl+M` — mute toggle (modifier combos are not switch keys)

### 1.3 Central AppState with Observer Pattern

**Current problem:** Settings are scattered — `PaintingActivity` holds `effectType`, `blendMode`, `debounceMs`; `ScreenFillActivity` holds `fillModeName`; `SwitchManager` holds profiles; `AudioManager` holds `muted`. The settings panel needs to read and write all of these.

**Solution:** A single `AppState` class holds all mutable state. Components subscribe to specific keys. When the settings panel changes a value, AppState notifies subscribers. Activities read from AppState on init and respond to change notifications.

```
AppState.set('effectType', 'smoke')
  → notifies PaintingActivity subscriber
  → PaintingActivity.setEffectType('smoke') called automatically
```

**Why not just direct method calls?** The settings panel shouldn't need to know about Activity internals (tight coupling). AppState as a mediator means the panel writes generic state, and activities interpret it themselves. This also means future activities can subscribe to relevant settings without modifying the panel.

### 1.4 Activity Registry for Scalability

**Current problem:** Activities are hardcoded in `main.js`:
```js
const activities = { painting: PaintingActivity, 'screen-fill': ScreenFillActivity };
```

**Solution:** An `ActivityRegistry` holds metadata for all activities:
```js
{
  id: 'painting',
  name: 'Collaborative Painting',
  description: 'Paint together on a shared canvas',
  icon: 'brush',        // SVG icon key
  ActivityClass: PaintingActivity,
  category: 'switch',   // 'switch', 'touch', 'sensory', etc.
  settingsSections: ['positionMode', 'effectType', 'effectSettings', 'blendMode'],
}
```

The Home Screen reads the registry to render cards. The Settings Panel reads `settingsSections` to show/hide relevant sections. Adding a new activity = adding one registry entry + the activity class itself.

### 1.5 DOM Overlays on PixiJS Canvas (Established Pattern)

Continuing the established pattern from ProgressBar and Timer: all UI is standard HTML/CSS positioned over the PixiJS canvas via `position: fixed` and `z-index` layering. The `#ui-overlay` div in `index.html` (already exists, `pointer-events: none`, `z-index: 100`) becomes the mount point for managed UI screens. Individual interactive containers within it set `pointer-events: auto`.

### 1.6 Settings Apply Immediately (No Save Button)

All settings changes take effect immediately. There's no "Save" or "Apply" button — changing a slider or toggle immediately updates the running activity. This reduces cognitive load (no "did I save?") and matches the session-scoped, no-persistence design (everything resets on reload anyway).

### 1.7 Going Home Destroys the Activity

When the teacher navigates from ACTIVITY → HOME, the current activity is destroyed (just like the current `switchActivity()` behaviour). This means timer, progress, and paint state are lost. This is intentional — sessions are short and disposable. If the teacher wants to change settings without losing state, they use the Settings Panel (which keeps the activity alive but paused).

---

## 2. Information Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ PLAYGROUND                                                  │
│                                                             │
│ ┌─────────────────────────────┐                             │
│ │ HOME SCREEN                 │                             │
│ │                             │                             │
│ │  ┌─────────┐ ┌─────────┐   │                             │
│ │  │Painting │ │Screen   │   │  ← Activity cards grid      │
│ │  │  🎨     │ │Fill 🎯  │   │    (grows with registry)    │
│ │  └─────────┘ └─────────┘   │                             │
│ │                             │                             │
│ │  [ Future categories... ]   │                             │
│ └─────────────────────────────┘                             │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ACTIVITY VIEW                                           │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ HEADER: [🏠 Home]  "Collaborative Painting"  [⚙️]  │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │              ╔═══════════════════╗                       │ │
│ │              ║   PixiJS Canvas   ║                       │ │
│ │              ║   (full screen)   ║                       │ │
│ │              ╚═══════════════════╝                       │ │
│ │                                                         │ │
│ │ ┌──────────────────────┐  ┌───────┐                     │ │
│ │ │ Progress Bar (if SF) │  │ Timer │ ← existing DOM UI   │ │
│ │ └──────────────────────┘  └───────┘                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SETTINGS PANEL (overlay)                                │ │
│ │                                                         │ │
│ │  [✕ Close]                                              │ │
│ │                                                         │ │
│ │  ── Sound ──────────────────────                        │ │
│ │  [🔊 / 🔇 Mute toggle]                                 │ │
│ │                                                         │ │
│ │  ── Position Mode ──────────────                        │ │
│ │  [Random] [Cursor] [Sweep]                              │ │
│ │    Sweep Speed: ━━━━●━━━━                               │ │
│ │    Pattern: [H] [V] [B] [S]                             │ │
│ │                                                         │ │
│ │  ── Effect Type ──────────────  (painting only)         │ │
│ │  [Solid] [Brush] [Smoke] [Starburst]                    │ │
│ │                                                         │ │
│ │  ── Effect Settings ──────────  (painting only)         │ │
│ │    Size:    ━━━━●━━━━                                   │ │
│ │    Opacity: ━━━━━━━●━                                   │ │
│ │    Scatter: ━━●━━━━━━                                   │ │
│ │                                                         │ │
│ │  ── Blend Mode ───────────────  (painting only)         │ │
│ │  [Normal] [Add] [Multiply] [Screen]                     │ │
│ │                                                         │ │
│ │  ── Fill Mode ────────────────  (screen fill only)      │ │
│ │  [Standard] [Mosaic]                                    │ │
│ │    Sub-options per mode...                               │ │
│ │                                                         │ │
│ │  ── Switches ─────────────────                          │ │
│ │  [Space ●] colour | impact ━━●━━                        │ │
│ │  [Enter ●] colour | impact ━━●━━                        │ │
│ │  ... (8 switches)                                       │ │
│ │                                                         │ │
│ │  ── Actions ──────────────────                          │ │
│ │  [Clear Canvas]  [Reset Defaults]                       │ │
│ │                                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Navigation Flow

### 3.1 State Transitions

```
                    ┌──────────┐
                    │   HOME   │ ← App starts here
                    └────┬─────┘
                         │ click activity card
                         ▼
                    ┌──────────┐ ─── Escape or ⚙️ ───▶ ┌──────────┐
                    │ ACTIVITY │                        │ SETTINGS │
                    └────┬─────┘ ◀── Escape or ✕ ─────┘──────────┘
                         │ click 🏠 Home
                         ▼
                    ┌──────────┐
                    │   HOME   │
                    └──────────┘
```

### 3.2 Escape Key Behaviour

| Current State | Escape Action |
|--------------|---------------|
| HOME | No action |
| ACTIVITY (no overlay) | Open settings panel → transition to SETTINGS |
| SETTINGS | Close settings panel → transition to ACTIVITY |

### 3.3 What Happens to the Activity During Transitions

| Transition | Activity Lifecycle |
|-----------|-------------------|
| HOME → ACTIVITY | New activity constructed and `init()`'d |
| ACTIVITY → SETTINGS | Activity stays alive, ticker keeps running (paint layer / sweep cursor visible), but **switch input is disconnected** |
| SETTINGS → ACTIVITY | Switch input reconnected, activity resumes |
| ACTIVITY → HOME | Activity `destroy()`'d, canvas cleared |

### 3.4 Global Shortcuts (Always Active)

| Key | Action | Active States |
|-----|--------|--------------|
| `Escape` | Toggle settings / close overlay | ACTIVITY, SETTINGS |
| `Ctrl+R` | Clear canvas (if activity has `clear()`) | ACTIVITY, SETTINGS |
| `Ctrl+M` | Toggle mute | All states |

---

## 4. App State Model

### 4.1 State Shape

```js
// src/app/AppState.js — default values
{
  // === Global ===
  muted: false,

  // === Position Mode (shared by all activities) ===
  positionMode: 'random',       // 'random' | 'cursor' | 'sweep'
  sweepSpeed: 3,                // px per delta (1-10 range)
  sweepPattern: 'horizontal',   // 'horizontal' | 'vertical' | 'bounce' | 'systematic'

  // === Painting-specific ===
  effectType: 'solid',          // 'solid' | 'brush' | 'smoke' | 'starburst'
  effectSize: 30,               // 10-80
  effectOpacity: 0.7,           // 0.1-1.0
  effectScatter: 30,            // 0-60
  blendMode: 'normal',          // 'normal' | 'add' | 'multiply' | 'screen'

  // === Screen Fill-specific ===
  fillMode: 'standard',         // 'standard' | 'mosaic'
  shapeAssignment: 'per-switch', // 'per-switch' | 'global' | 'random'
  globalStampShape: 'circle',   // shape name (when assignment is 'global')
  stampSize: 30,                // 10-80
  tilePattern: 'square',        // 'square' | 'hex' | 'triangle' | 'brick'
  tileSize: 50,                 // 15-120

  // === Switch Profiles ===
  // Stored as array of { key, label, colour, impactMultiplier, index }
  // Initialised from SwitchManager defaults
  switchProfiles: [/* 8 profiles */],
}
```

### 4.2 Observer API

```js
class AppState {
  constructor(defaults) { ... }
  get(key) { ... }
  set(key, value) { ... }                    // sets + notifies
  subscribe(key, callback) { ... }           // returns unsubscribe fn
  subscribeMany(keys, callback) { ... }      // subscribe to multiple keys
  getAll() { ... }                           // snapshot of all state
  reset() { ... }                            // restore defaults
}
```

Activities subscribe to the keys they care about during `init()` and unsubscribe during `destroy()`. The Settings Panel calls `appState.set()` when controls change.

### 4.3 SwitchManager Integration

`SwitchManager` currently constructs 8 hardcoded `SwitchProfile` instances. In Phase 6:
- `SwitchManager` reads initial profiles from its existing defaults
- `AppState.switchProfiles` is initialised from `SwitchManager.getAllProfiles()`
- When the Settings Panel changes a profile's colour or impact multiplier, it writes to `AppState`
- `AppState` subscriber updates the `SwitchProfile` objects in `SwitchManager`
- Existing `getProfile()` calls throughout the codebase continue to work unchanged

---

## 5. Component Breakdown & File Assignments

### 5.1 New Files

| File | Purpose | Dependencies |
|------|---------|-------------|
| `src/app/AppShell.js` | State machine, manages screens, owns PixiJS app + InputManager + SwitchManager lifecycle. Replaces orchestration logic in `main.js`. | AppState, ActivityRegistry, HomeScreen, SettingsPanel, ActivityHeader, InputManager, SwitchManager |
| `src/app/AppState.js` | Central observable state. Pure data + observer pattern; no DOM or PixiJS dependency. | None |
| `src/app/ActivityRegistry.js` | Activity metadata array. Imported by HomeScreen and SettingsPanel. | PaintingActivity, ScreenFillActivity (lazy import) |
| `src/ui/HomeScreen.js` | DOM overlay: activity card grid. Reads from ActivityRegistry. Emits activity selection via callback. | ActivityRegistry, icons |
| `src/ui/SettingsPanel.js` | DOM overlay: all settings sections. Reads/writes AppState. Shows/hides sections based on active activity's `settingsSections`. | AppState, components/* |
| `src/ui/ActivityHeader.js` | Fixed-position top bar during ACTIVITY state. Home button, activity name, gear icon. | None (emits callbacks) |
| `src/ui/components/ToggleButton.js` | Reusable on/off toggle (for mute, etc.). DOM element factory. | None |
| `src/ui/components/SliderControl.js` | Reusable range slider with label + value display. Large thumb for touch. | None |
| `src/ui/components/OptionGroup.js` | Reusable group of mutually exclusive options (visual radio buttons). Large touch targets. | None |
| `src/ui/components/ColourSwatch.js` | Colour picker: grid of preset accessible colours for switch profile editing. | None |
| `src/ui/icons.js` | SVG icon string constants (home, gear, brush, target, close, speaker, etc.). Inline SVG avoids asset loading. | None |
| `src/ui/styles.css` | All Phase 6 CSS. Imported via `index.html` `<link>` or Vite CSS import. | None |

### 5.2 Modified Files

| File | Changes |
|------|---------|
| `src/main.js` | **Gutted and simplified.** Becomes a ~15 line bootstrap: creates `AppShell` and calls `appShell.init()`. All keyboard shortcut handling, activity switching, and InputManager wiring moves into `AppShell`. |
| `index.html` | Add CSS `<link>` for `styles.css`. Add structural container inside `#ui-overlay` for screen mounting. Potentially add a `<noscript>` message. |
| `src/activities/BaseActivity.js` | Add optional `setAppState(appState)` method so activities can subscribe to state changes. Add `getSettingsSections()` method that returns which settings sections apply. |
| `src/activities/painting/PaintingActivity.js` | Read initial settings from AppState in `init()`. Subscribe to relevant state keys. Replace hardcoded defaults with AppState reads. Remove internal `setMode()`, `setEffectType()`, `setBlendMode()` direct calls — these become AppState subscribers. |
| `src/activities/screen-fill/ScreenFillActivity.js` | Same pattern as PaintingActivity. Read fill mode, stamp settings from AppState. Subscribe to changes. |
| `src/switches/SwitchManager.js` | Add `updateProfile(key, changes)` method to mutate a profile's colour/impactMultiplier. Called by AppState subscriber when switch settings change. |
| `src/switches/SwitchProfile.js` | No structural changes needed. Profile objects are already mutable. |
| `src/input/InputManager.js` | Add `enable()` / `disable()` methods to gate whether `onKeyAction` fires. When UI overlays are open, InputManager is disabled so switches don't fire activity actions. |

### 5.3 Unchanged Files

All files in `src/effects/`, `src/painting/PaintLayer.js`, `src/audio/AudioManager.js`, `src/ui/ProgressBar.js`, `src/ui/Timer.js`, `src/ui/Celebration.js`, `src/activities/screen-fill/fill-modes/`, `src/activities/painting/modes/`, `src/utils/colour.js` remain unchanged. Phase 6 is additive — it wraps existing systems without modifying their internals.

---

## 6. CSS Architecture

### 6.1 Approach

Single file `src/ui/styles.css` with CSS custom properties for theming. BEM-lite naming convention to avoid conflicts with any future library adoption.

### 6.2 Custom Properties

```css
:root {
  /* Colours */
  --pg-bg-dark: #1a1a2e;
  --pg-bg-panel: rgba(20, 20, 40, 0.95);
  --pg-bg-card: rgba(255, 255, 255, 0.08);
  --pg-bg-card-hover: rgba(255, 255, 255, 0.15);
  --pg-text-primary: #ffffff;
  --pg-text-secondary: rgba(255, 255, 255, 0.7);
  --pg-accent: #56B4E9;
  --pg-accent-active: #0072B2;
  --pg-border: rgba(255, 255, 255, 0.2);
  --pg-danger: #D55E00;

  /* Spacing */
  --pg-space-xs: 4px;
  --pg-space-sm: 8px;
  --pg-space-md: 16px;
  --pg-space-lg: 24px;
  --pg-space-xl: 32px;
  --pg-space-2xl: 48px;

  /* Touch targets (WCAG 2.5.8 Target Size) */
  --pg-touch-min: 48px;    /* minimum */
  --pg-touch-preferred: 64px;  /* preferred for whiteboard */

  /* Typography */
  --pg-font: system-ui, -apple-system, sans-serif;
  --pg-font-size-sm: 14px;
  --pg-font-size-md: 18px;
  --pg-font-size-lg: 24px;
  --pg-font-size-xl: 32px;

  /* Borders */
  --pg-radius-sm: 8px;
  --pg-radius-md: 12px;
  --pg-radius-lg: 16px;

  /* Z-index layers */
  --pg-z-canvas: 1;
  --pg-z-activity-ui: 100;     /* ProgressBar, Timer (existing) */
  --pg-z-header: 200;
  --pg-z-overlay: 300;          /* HomeScreen, SettingsPanel */
  --pg-z-overlay-backdrop: 299;
}
```

### 6.3 Naming Convention

```
.pg-{component}                    — component root
.pg-{component}__{element}         — child element
.pg-{component}--{modifier}        — variant
```

Examples:
- `.pg-home` — home screen container
- `.pg-home__card` — activity card
- `.pg-home__card--active` — focused/active card
- `.pg-settings` — settings panel
- `.pg-settings__section` — collapsible section
- `.pg-header` — activity header bar
- `.pg-option-group` — reusable option group component
- `.pg-slider` — reusable slider component

### 6.4 Responsive Strategy

- **Desktop/projector** (>1024px): Settings panel as centered overlay, ~500px wide, scrollable
- **Tablet** (768–1024px): Settings panel full-width, slightly narrower max-width
- **Small screen** (<768px): Settings panel full-screen overlay
- Activity cards: CSS Grid with `auto-fit` and `minmax(200px, 1fr)` — automatically reflows

```css
@media (max-width: 768px) {
  .pg-settings { width: 100%; max-width: 100%; }
  .pg-home__grid { grid-template-columns: 1fr; }
}
```

### 6.5 Transitions

- Home screen: opacity fade-in (200ms)
- Settings panel: slide-in from right (250ms ease-out) + backdrop fade
- Settings close: slide-out to right (200ms ease-in) + backdrop fade
- Option group selection: background-color transition (150ms)
- All transitions respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Switch-Safety Strategy

### 7.1 Three-Layer Protection

**Layer 1 — InputManager gating:**
`InputManager` gains `enable()` / `disable()` methods. When AppShell transitions to HOME or SETTINGS, `inputManager.disable()` is called. The `onKeyAction` callback stops firing. Switches produce no activity response.

**Layer 2 — UI element inertness to keyboard:**
All interactive UI elements (buttons, sliders, toggles) have `tabindex="-1"`. They cannot receive focus via Tab or any keyboard navigation. They respond only to `click` / `pointerdown` / `touchstart` events.

**Layer 3 — Event interception on overlay:**
Each UI overlay container has a `keydown` listener that checks if the key is a switch key and calls `event.stopPropagation(); event.preventDefault();`. This is a safety net in case focus somehow reaches a UI element (e.g., browser autofocus anomalies).

```js
// Applied to HomeScreen, SettingsPanel root elements
const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

overlay.addEventListener('keydown', (e) => {
  if (SWITCH_KEYS.has(e.code)) {
    e.preventDefault();
    e.stopPropagation();
  }
});
```

### 7.2 What Students Experience When UI is Open

When the teacher opens the Home Screen or Settings Panel:
- Switch presses produce **no visible effect** (input gated)
- The canvas remains visible (dimmed behind settings) but frozen
- Audio is silent (no press sounds fire)
- When the teacher closes the overlay, switch input resumes immediately

---

## 8. Accessibility Approach

### 8.1 WCAG 2.1 AA Conformance Notes

| Criterion | How Met | Notes |
|-----------|---------|-------|
| 1.1.1 Non-text Content | SVG icons have `aria-hidden="true"`, buttons have text labels or `aria-label` | |
| 1.3.1 Info and Relationships | Sections use `<fieldset>` / `<legend>` or `role="group"` with `aria-labelledby` | |
| 1.4.1 Use of Colour | Option groups show selection via border + fill, not colour alone | |
| 1.4.3 Contrast | All text ≥ 4.5:1 ratio against panel background. White (#fff) on dark panel (#141428) = 14.5:1 | |
| 1.4.11 Non-text Contrast | Interactive control borders ≥ 3:1 against background | |
| 2.1.1 Keyboard | Intentionally limited — see §1.2 rationale. Touch/mouse access is the equivalent. | Documented exception |
| 2.4.3 Focus Order | N/A — elements have `tabindex="-1"`, no keyboard focus order | |
| 2.5.5 Target Size (AAA) | 64px preferred touch target, 48px minimum | Exceeds AA, targets AAA |
| 2.5.8 Target Size (Minimum) | All targets ≥ 24×24px with ≥ 24px spacing (AA requirement) | Comfortably exceeded |
| 4.1.2 Name, Role, Value | Toggle buttons use `role="switch"` with `aria-checked`. Sliders use `<input type="range">`. Option groups use `role="radiogroup"` with `role="radio"`. | For screen reader users who may interact via mouse |

### 8.2 ARIA Patterns Used

| Component | ARIA Pattern |
|-----------|-------------|
| Settings Panel | `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to panel title |
| Mute Toggle | `role="switch"`, `aria-checked="true/false"` |
| Option Groups (mode, effect, blend, etc.) | `role="radiogroup"` with children `role="radio"`, `aria-checked` |
| Sliders | Native `<input type="range">` with `aria-label` and `aria-valuetext` |
| Collapsible sections | `<button aria-expanded="true/false">` controlling `<div>` with `aria-hidden` |
| Activity cards | `role="button"` with descriptive `aria-label` |

### 8.3 Colour Palette for Switch Profiles

The current Wong's colourblind-safe palette is preserved. The Settings Panel colour picker offers 12 preset colours (Wong's palette + 4 additional high-contrast options). No free-form hex input — presets only, all verified for WCAG contrast against the dark canvas background.

---

## 9. Settings Panel Design

### 9.1 Layout

The Settings Panel is a **right-side slide-in overlay** (not centered modal). This keeps the left portion of the canvas partially visible so the teacher can see the activity state while adjusting settings.

- Width: `380px` on desktop, `100%` on mobile
- Height: `100vh`, scrollable content area
- Semi-transparent backdrop to the left (click backdrop to close)
- Close button `✕` at top-right of panel (64px touch target)
- Panel title: current activity name + "Settings"

### 9.2 Section Order

Sections are displayed top-to-bottom. Activity-specific sections only appear when that activity is active.

1. **🔊 Sound** — Always visible
   - Mute toggle (single large switch control)

2. **🎯 Position Mode** — Always visible (all activities use position modes)
   - Option group: Random / Cursor / Sweep
   - *Conditional (sweep selected):*
     - Speed slider (1–10)
     - Pattern option group: Horizontal / Vertical / Bounce / Systematic

3. **🎨 Effect Type** — Painting only
   - Option group: Solid Circle / Soft Brush / Smoke / Starburst

4. **✨ Effect Settings** — Painting only
   - Size slider (10–80)
   - Opacity slider (0.1–1.0, step 0.1)
   - Scatter slider (0–60)

5. **🔀 Blend Mode** — Painting only
   - Option group: Normal / Add / Multiply / Screen

6. **📐 Fill Mode** — Screen Fill only
   - Option group: Standard / Mosaic
   - *Conditional (standard):*
     - Shape assignment: Per-Switch / Global / Random
     - *Conditional (global):* Shape selector
     - Stamp size slider (10–80)
   - *Conditional (mosaic):*
     - Tile pattern: Square / Hex / Triangle / Brick
     - Tile size slider (15–120)

7. **🎹 Switches** — Always visible
   - Expandable section (collapsed by default to save space)
   - 8 switch rows, each showing:
     - Switch label (Space, Enter, ↑, ↓, ←, →, F7, F8)
     - Colour swatch (tap to change via colour picker popup)
     - Impact multiplier slider (0.5–3.0, step 0.1)

8. **⚡ Actions** — Always visible
   - Clear Canvas button (with ⚠️ confirmation visual — brief red flash, no dialog)
   - Reset to Defaults button

### 9.3 Conditional Section Visibility

`SettingsPanel` reads the current activity ID from AppState, then cross-references `ActivityRegistry[id].settingsSections` to determine which sections to show.

```js
// ActivityRegistry entries
{
  id: 'painting',
  settingsSections: ['sound', 'positionMode', 'effectType', 'effectSettings', 'blendMode', 'switches', 'actions'],
}
{
  id: 'screen-fill',
  settingsSections: ['sound', 'positionMode', 'fillMode', 'switches', 'actions'],
}
```

### 9.4 Responsive Behaviour

| Viewport | Panel Width | Panel Position |
|----------|------------|----------------|
| > 1024px | 380px | Right edge, slide-in |
| 768–1024px | 420px | Right edge, slide-in |
| < 768px | 100% | Full-screen overlay |

---

## 10. How the App Scales

### 10.1 Adding a New Activity (Future)

Developer workflow to add a third activity (e.g., "Music Maker"):

1. Create `src/activities/music/MusicActivity.js` extending `BaseActivity`
2. Add entry to `src/app/ActivityRegistry.js`:
   ```js
   {
     id: 'music',
     name: 'Music Maker',
     description: 'Create music with switches',
     icon: 'music',
     ActivityClass: () => import('./activities/music/MusicActivity.js'),
     category: 'switch',
     settingsSections: ['sound', 'switches', 'musicSettings'],
   }
   ```
3. If it needs new settings, add a new section component and register it with SettingsPanel
4. Add SVG icon to `icons.js`
5. Done — Home Screen auto-renders the new card, Settings Panel auto-shows relevant sections

### 10.2 Activity Categories

The Home Screen groups activities by category. With 2 activities in one category, the grouping header is minimal. When a second category appears (e.g., 'sensory', 'touch'), the Home Screen renders category headers:

```
Switch Activities
  [Painting] [Screen Fill] [Music Maker]

Sensory Activities
  [Light Show] [Colour Wash]
```

The category system is built into the card rendering from day one but only visually activates when >1 category exists.

### 10.3 Settings Section Registry

Settings sections are modular. Each section is a function that receives `(containerEl, appState)` and creates its DOM elements. New activities can define custom settings sections:

```js
// Future: SettingsPanel.registerSection('musicSettings', createMusicSettingsSection);
```

For Phase 6, sections are hardcoded in SettingsPanel (only 8 sections total — premature to abstract further). The registry pattern can be extracted in future if needed.

---

## 11. Build Order (Waves)

### Wave 1: Foundation Layer (No UI, No DOM)
*All files in this wave are pure JS with no DOM dependencies. Can be built and unit-tested independently.*

| Task | File | Description |
|------|------|-------------|
| 1.1 | `src/app/AppState.js` | Observable state container. Implement `get`, `set`, `subscribe`, `subscribeMany`, `getAll`, `reset`. Wire default values from §4.1. |
| 1.2 | `src/app/ActivityRegistry.js` | Array of activity metadata objects for Painting and Screen Fill. Include `id`, `name`, `description`, `icon`, `category`, `settingsSections`. Import activity classes. |
| 1.3 | `src/input/InputManager.js` | Add `enable()` / `disable()` methods. When disabled, `onKeyAction` callback is not called. Default: enabled. No other changes to existing behaviour. |
| 1.4 | `src/switches/SwitchManager.js` | Add `updateProfile(key, { colour?, impactMultiplier? })` method. Mutates the existing `SwitchProfile` object. |

### Wave 2: CSS + Icons
*Can be built in parallel with Wave 1.*

| Task | File | Description |
|------|------|-------------|
| 2.1 | `src/ui/styles.css` | Full CSS file with custom properties, component styles for all Phase 6 components (home, header, settings, option-group, slider, toggle, colour-swatch). Include responsive breakpoints and `prefers-reduced-motion`. |
| 2.2 | `src/ui/icons.js` | SVG string constants for: home, gear/settings, close (×), brush, target, speaker-on, speaker-off, chevron-down, chevron-up. Each exported as a function returning an SVG string. |
| 2.3 | `index.html` | Add `<link>` to styles.css (or Vite CSS import). Add structural container `<div id="pg-screens"></div>` inside `#ui-overlay`. |

### Wave 3: Reusable UI Components
*Depends on Wave 2 (CSS). No dependencies between components — all can be built in parallel.*

| Task | File | Description |
|------|------|-------------|
| 3.1 | `src/ui/components/ToggleButton.js` | Creates a toggle switch DOM element. API: `create({ label, initialValue, onChange })` → returns DOM element. Uses `role="switch"`, `aria-checked`. 64px hit area. |
| 3.2 | `src/ui/components/SliderControl.js` | Creates a labeled range slider. API: `create({ label, min, max, step, value, unit, onChange })` → returns DOM element. Native `<input type="range">` with custom styling. Large thumb (24px+). Displays current value. |
| 3.3 | `src/ui/components/OptionGroup.js` | Creates a group of mutually exclusive buttons. API: `create({ label, options: [{ value, label, icon? }], selected, onChange })` → returns DOM element. Uses `role="radiogroup"` / `role="radio"`. 48px+ per option. |
| 3.4 | `src/ui/components/ColourSwatch.js` | Creates a colour picker popup. API: `create({ colours, selected, onChange })` → returns DOM element. Grid of colour circles. 48px per swatch. Popup positions near the trigger. |

### Wave 4: Home Screen
*Depends on Waves 1 (ActivityRegistry), 2 (CSS, icons).*

| Task | File | Description |
|------|------|-------------|
| 4.1 | `src/ui/HomeScreen.js` | Creates the activity selection screen. Reads `ActivityRegistry` to generate cards. Each card: icon (SVG), name, description. CSS Grid layout. Callback: `onActivitySelected(activityId)`. Mount/unmount methods. Category grouping logic (single group for now). Switch-key interception on container. |

### Wave 5: Activity Header
*Depends on Wave 2 (CSS, icons).*

| Task | File | Description |
|------|------|-------------|
| 5.1 | `src/ui/ActivityHeader.js` | Creates the minimal in-activity toolbar. Fixed top bar: Home button (left), activity name (center), gear icon (right). Callbacks: `onHomeClick()`, `onSettingsClick()`. Show/hide methods. Semi-transparent background to not obscure canvas. |

### Wave 6: Settings Panel (Structure)
*Depends on Waves 1 (AppState), 2 (CSS, icons), 3 (components).*

| Task | File | Description |
|------|------|-------------|
| 6.1 | `src/ui/SettingsPanel.js` | Creates the settings overlay. Builds all 8 sections using reusable components. Reads initial values from AppState. Writes changes to AppState on every interaction. Conditional section visibility based on `settingsSections` array. Slide-in/out animation. Backdrop click-to-close. Close button. Scrollable content area. Mount/unmount methods. Switch-key interception. |

### Wave 7: App Shell + main.js Refactor
*Depends on all previous waves.*

| Task | File | Description |
|------|------|-------------|
| 7.1 | `src/app/AppShell.js` | State machine (HOME/ACTIVITY/SETTINGS). Owns PixiJS app init, InputManager, SwitchManager, AppState. Creates and manages HomeScreen, ActivityHeader, SettingsPanel instances. Handles Escape/Ctrl+R/Ctrl+M globally. Manages activity lifecycle (create/destroy). Connects InputManager.onKeyAction to active activity. Calls inputManager.enable/disable on state transitions. |
| 7.2 | `src/main.js` | **Rewrite.** ~15 lines: import AppShell, call `new AppShell().init()`. Remove all keyboard shortcut handling, activity switching, mode/effect key maps. |
| 7.3 | `src/activities/BaseActivity.js` | Add `setAppState(appState)` method, `getSettingsSections()` returning empty array. |
| 7.4 | `src/activities/painting/PaintingActivity.js` | Integrate AppState: subscribe to `positionMode`, `effectType`, `blendMode`, `effectSize`, `effectOpacity`, `effectScatter` in `init()`. Replace hardcoded values with `appState.get()`. Unsubscribe in `destroy()`. |
| 7.5 | `src/activities/screen-fill/ScreenFillActivity.js` | Integrate AppState: subscribe to `positionMode`, `fillMode`, `shapeAssignment`, `globalStampShape`, `stampSize`, `tilePattern`, `tileSize`. Replace hardcoded values. Unsubscribe in `destroy()`. |

### Wave 8: Integration Testing + Polish
*Depends on Wave 7.*

| Task | File | Description |
|------|------|-------------|
| 8.1 | All files | Full navigation flow testing: HOME → ACTIVITY → SETTINGS → ACTIVITY → HOME. Verify all settings changes propagate to activities. |
| 8.2 | `src/ui/styles.css` | Touch target verification on iPad-size viewport. Responsive testing at 768px, 1024px, 1920px breakpoints. |
| 8.3 | All UI files | Switch-safety verification: press all 8 switch keys rapidly while every UI overlay is open. Confirm zero UI interactions triggered. |
| 8.4 | All files | Edge case testing (see §12). |
| 8.5 | `TEST.md` | Add Phase 6 test checklist items. |

### Dependency Graph

```
Wave 1 (AppState, Registry,        Wave 2 (CSS, icons,
        InputManager, SwitchManager)        index.html)
        │                                   │
        │              ┌────────────────────┤
        │              │                    │
        ▼              ▼                    ▼
     Wave 3 (Components)              Wave 4 (HomeScreen)
        │                                   │
        │                              Wave 5 (ActivityHeader)
        │                                   │
        ▼                                   │
     Wave 6 (SettingsPanel)                 │
        │                                   │
        └──────────────┬────────────────────┘
                       ▼
                 Wave 7 (AppShell + Refactors)
                       │
                       ▼
                 Wave 8 (Integration + Polish)
```

**Parallelisation opportunities:**
- Waves 1 and 2 are fully parallel
- Within Wave 3, all 4 components are independent
- Waves 4 and 5 can be built in parallel
- Wave 6 needs Wave 3 complete
- Wave 7 is the integration point — sequential

---

## 12. Edge Cases

### 12.1 Window Resize While Settings Panel is Open

Settings panel uses CSS `position: fixed` + percentages/max-widths — it reflows automatically on resize. No JS handling needed. The activity Canvas resize handler (`handleResize()` on activities) still fires since the activity is alive during SETTINGS state.

### 12.2 Activity Switching Mid-Game (Home Button While Screen Fill is in Progress)

Current activity is `destroy()`'d — timer, progress, coverage, paint all lost. This matches existing `switchActivity()` behaviour. No confirmation dialog (low cognitive load, sessions are disposable). The teacher can use Settings Panel (which preserves state) instead of going Home if they want to keep progress.

### 12.3 Settings Change During Active Sweep Mode

If the teacher changes `positionMode` from 'sweep' to 'random' while the sweep cursor is moving, the activity must:
1. Destroy the current SweepMode (removes crosshair)
2. Create a new RandomMode
3. Resume accepting input with the new mode

This is the same code path as the current `setMode()` methods — it's just triggered by AppState subscription instead of a keyboard shortcut.

### 12.4 Fill Mode Change During Active Screen Fill

Changing `fillMode` from 'standard' to 'mosaic' (or vice versa) triggers a full reset (timer, progress, coverage) — same as current `cycleFillMode()` behaviour. The Settings Panel should show a brief visual indicator that reset occurred (e.g., progress bar flashes).

### 12.5 Colour Change on Switch Profile

When a teacher changes a switch's colour, existing paint marks on the canvas retain their old colour (RenderTexture is baked pixels). Only future presses use the new colour. This is correct behaviour — no retroactive changes.

### 12.6 Impact Multiplier Change

Immediate effect on next press. No retroactive changes to existing effects/stamps.

### 12.7 Multiple Rapid Settings Changes

AppState observer fires synchronously on `set()`. If the teacher rapidly changes 5 settings, 5 individual updates fire. This is fine — each is cheap (no DOM reflow, just JS state). Activities should not do expensive operations in their subscribers (e.g., don't recreate the entire fill mode on every slider tick — use a debounce/threshold internally if needed).

### 12.8 Escape Key During Transition Animation

If the settings panel is sliding in/out and Escape is pressed again, the transition should be interrupted and reversed. Use `transitionend` event to track animation state, and allow re-triggering during animation.

### 12.9 Touch Outside Settings Panel (Backdrop)

Clicking/touching the semi-transparent backdrop to the left of the Settings Panel closes it. This is the same as pressing Escape or the close button.

### 12.10 iPad Orientation Change

Settings panel: CSS `100vh` + `position: fixed` handles rotation. Activity Canvas: existing `handleResize` in activities already handles this. Home Screen: CSS Grid reflows. No special handling needed beyond existing resize logic.

### 12.11 ProgressBar/Timer Visibility During HOME State

When navigating HOME, the current activity is destroyed, which calls `progressBar.destroy()` and `timer.destroy()` (removing their DOM elements). When a new activity inits, they're recreated. No orphaned DOM elements.

### 12.12 Browser Tab/Window Loses Focus

No special handling needed. PixiJS ticker pauses when tab is hidden (default browser behaviour). Audio may be suspended by browser. When focus returns, everything resumes normally.

---

## 13. Alternative Approaches Considered

### 13.1 Settings Panel: Sidebar vs. Modal vs. Slide-In

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Persistent sidebar** | Always visible, continuous adjustment | Takes screen space on projector, canvas shrunk | ❌ Rejected — screen real estate too valuable on shared display |
| **Centered modal** | Clear focus, familiar pattern | Blocks canvas view entirely, can feel heavy | ❌ Rejected — teacher loses context of what the activity looks like |
| **Right slide-in** | Canvas partially visible, quick access, mobile-friendly | Slightly complex animation | ✅ Selected — best balance of context preservation and focus |

### 13.2 Settings: Immediate Apply vs Save/Cancel

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| **Immediate apply** | No cognitive load, see changes live | Can't "undo" a batch of changes | ✅ Selected — sessions are disposable, "Reset Defaults" covers the undo case |
| **Save/Cancel** | Explicit control, can cancel mistakes | Extra step, teacher may forget to save | ❌ Rejected — unnecessary friction for a session-scoped app |

### 13.3 Home Screen: Grid vs. List vs. Carousel

| Approach | Scales To | Touch-Friendly | Best For |
|----------|----------|---------------|----------|
| **Card grid** | 2–12 activities | ✅ Large targets | ✅ Current and near-future needs |
| **Scrollable list** | 10+ activities | ⚠️ Smaller targets | Long lists with descriptions |
| **Carousel** | 3–8 activities | ✅ Fun, visual | Fixed small set |

✅ Selected: **Card grid** with CSS Grid `auto-fit`. Automatically reflows from 2 columns to 3 to 4 as activities grow. Category headers appear when >1 category exists.

### 13.4 Keyboard Accessibility of UI

| Approach | Safety | WCAG-Compliant | Verdict |
|----------|--------|---------------|---------|
| **Full keyboard nav** (Tab + Space/Enter) | ❌ Students can activate buttons via switches | ✅ Fully compliant | ❌ Rejected — safety > compliance for this user base |
| **No keyboard nav** (tabindex=-1 everywhere) | ✅ Fully switch-safe | ⚠️ Exception needed | ✅ Selected — documented trade-off, touch/mouse always available |
| **Keyboard nav with switch blocking** (intercept Space/Enter on focused buttons) | ⚠️ Complex, fragile | ⚠️ Partially compliant (buttons don't activate via standard keys) | ❌ Rejected — confusing UX, not truly keyboard-accessible anyway |

### 13.5 State Management: Central Store vs. Direct Wiring

| Approach | Decoupling | Complexity | Verdict |
|----------|-----------|-----------|---------|
| **AppState (observable)** | Activities don't know about UI | Simple observer pattern, ~50 lines | ✅ Selected |
| **Direct method calls** (SettingsPanel calls activity methods) | Tight coupling, panel must know about every activity | Simpler initially, painful to extend | ❌ Rejected |
| **Event bus** (custom events on window) | Very decoupled | Hard to debug, no type safety | ❌ Rejected — overkill for this app size |

---

## 14. Open Questions — RESOLVED

All questions resolved by user:

1. **Home screen visual style**: Clean, good contrast, simple text with appropriate icon per activity. Not overly playful, not dark/minimal — clear and functional.
2. **Confirmation on destructive actions**: Immediate. No confirmation dialogs for Clear Canvas or Reset Defaults.
3. **URL-based activity selection**: Yes — preserve `?activity=` URL param to bypass Home Screen for teacher bookmarks.
4. **Settings panel sections**: Accordion-style collapsible. Switches section collapsed by default, others expanded.
5. **Activity categories**: No categories. Flat card grid only. Category grouping deferred — not needed until many activities exist.
6. **Settings coverage**: Current list is complete. Some settings are activity-specific (already handled via `settingsSections` per activity in the registry).

---

## 15. Test Checklist Additions

These should be added to TEST.md Phase 6 section:

### Navigation
- [ ] App starts on Home Screen
- [ ] Can launch Collaborative Painting from Home Screen card
- [ ] Can launch Screen Fill from Home Screen card
- [ ] Activity header shows correct activity name
- [ ] Home button in header returns to Home Screen
- [ ] Activity is destroyed when returning to Home (no orphaned DOM elements)
- [ ] Gear icon opens Settings Panel
- [ ] Escape opens Settings Panel from activity
- [ ] Escape closes Settings Panel back to activity
- [ ] Escape does nothing on Home Screen
- [ ] URL param `?activity=painting` bypasses Home Screen and launches directly

### Settings Panel
- [ ] Settings Panel slides in from right
- [ ] Settings Panel slides out on close
- [ ] Backdrop click closes Settings Panel
- [ ] Close button (✕) closes Settings Panel
- [ ] Panel shows only relevant sections for current activity
- [ ] Painting-specific sections hidden during Screen Fill
- [ ] Screen Fill-specific sections hidden during Painting

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

### Settings: Effect Type (Painting)
- [ ] Can change effect type to each of the 4 types
- [ ] Changed effect type applies immediately on next press

### Settings: Effect Settings (Painting)
- [ ] Size slider changes effect size
- [ ] Opacity slider changes effect opacity
- [ ] Scatter slider changes scatter amount

### Settings: Blend Mode (Painting)
- [ ] Can change blend mode to each of the 4 modes
- [ ] Changed blend mode applies immediately

### Settings: Fill Mode (Screen Fill)
- [ ] Can switch between Standard and Mosaic fill modes
- [ ] Fill mode change resets timer and progress
- [ ] Standard sub-options: shape assignment, stamp size
- [ ] Mosaic sub-options: tile pattern, tile size
- [ ] All sub-options apply immediately

### Settings: Switches
- [ ] All 8 switches listed with label, colour, and multiplier
- [ ] Can change switch colour via colour picker
- [ ] Can change impact multiplier via slider
- [ ] Changed colour applies to next press (existing paint unchanged)
- [ ] Changed multiplier applies to next press

### Settings: Actions
- [ ] Clear Canvas button clears the canvas
- [ ] Ctrl+R still works as clear shortcut
- [ ] Reset Defaults restores all settings to initial values

### Switch Safety
- [ ] Space key does NOT interact with any UI button/control
- [ ] Enter key does NOT interact with any UI button/control
- [ ] Arrow keys do NOT interact with any UI control
- [ ] F7/F8 do NOT interact with any UI control
- [ ] Switch presses produce no effect while Home Screen is visible
- [ ] Switch presses produce no effect while Settings Panel is open
- [ ] Switch presses resume working after Settings Panel is closed

### Touch & Responsiveness
- [ ] All controls work via touch (no hover-only interactions)
- [ ] All touch targets ≥ 48px
- [ ] Settings Panel responsive at 768px viewport width
- [ ] Settings Panel responsive at 1024px viewport width
- [ ] Home Screen cards reflow on narrow viewport
- [ ] Window resize while Settings Panel open — no layout breakage

### Regression
- [ ] **Phase 1–5 checks still pass**

---

## Appendix A: File Tree After Phase 6

```
src/
  main.js                              ← SIMPLIFIED (bootstrap only)
  app/
    AppShell.js                        ← NEW (state machine, orchestration)
    AppState.js                        ← NEW (observable state)
    ActivityRegistry.js                ← NEW (activity metadata)
  input/
    InputManager.js                    ← MODIFIED (enable/disable)
  switches/
    SwitchProfile.js                   ← UNCHANGED
    SwitchManager.js                   ← MODIFIED (updateProfile)
  effects/
    BaseEffect.js                      ← UNCHANGED
    EffectFactory.js                   ← UNCHANGED
    SolidCircle.js                     ← UNCHANGED
    SoftBrush.js                       ← UNCHANGED
    SmokeEffect.js                     ← UNCHANGED
    StarburstEffect.js                 ← UNCHANGED
  painting/
    PaintLayer.js                      ← UNCHANGED
  activities/
    BaseActivity.js                    ← MODIFIED (setAppState, getSettingsSections)
    painting/
      PaintingActivity.js              ← MODIFIED (AppState integration)
      modes/
        RandomMode.js                  ← UNCHANGED
        CursorMode.js                  ← UNCHANGED
        SweepMode.js                   ← UNCHANGED
    screen-fill/
      ScreenFillActivity.js            ← MODIFIED (AppState integration)
      BiasedRandomMode.js              ← UNCHANGED
      CoverageGrid.js                  ← UNCHANGED
      fill-modes/
        BaseFillMode.js                ← UNCHANGED
        StandardFillMode.js            ← UNCHANGED
        ShapeStamper.js                ← UNCHANGED
        MosaicFillMode.js              ← UNCHANGED
        tile-patterns/                 ← ALL UNCHANGED
  audio/
    AudioManager.js                    ← UNCHANGED
  ui/
    styles.css                         ← NEW (all Phase 6 CSS)
    icons.js                           ← NEW (SVG icon strings)
    HomeScreen.js                      ← NEW
    SettingsPanel.js                   ← NEW
    ActivityHeader.js                  ← NEW
    ProgressBar.js                     ← UNCHANGED
    Timer.js                           ← UNCHANGED
    Celebration.js                     ← UNCHANGED
    components/
      ToggleButton.js                  ← NEW
      SliderControl.js                 ← NEW
      OptionGroup.js                   ← NEW
      ColourSwatch.js                  ← NEW
  utils/
    colour.js                          ← UNCHANGED
```

**New files: 12** | **Modified files: 6** | **Unchanged files: 24**
