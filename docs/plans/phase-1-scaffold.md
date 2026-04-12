# Phase 1: Project Scaffold & Core Systems — Implementation Plan

## Summary

Phase 1 creates a runnable Vite + PixiJS v8 app with a fullscreen WebGL canvas, a keyboard input tracking system, and a switch profile registry. No visual effects yet — just the foundation. On completion, the app boots, shows a blank canvas, and console-logs key presses with correct switch profile data (key, colour, impact multiplier). This plan includes a critical dependency change: replace `@pixi/particle-emitter` (not compatible with PixiJS v8) with `pixi-particle-system` (built natively for v8).

---

## Critical Finding: Particle Emitter Compatibility

**`@pixi/particle-emitter` does NOT support PixiJS v8.** Open issue [#211](https://github.com/pixijs-userland/particle-emitter/issues/211) confirms this. The library targets PixiJS v6/v7 and uses removed APIs (`DisplayObject`).

**Recommended replacement:** `pixi-particle-system` (npm: `pixi-particle-system`, v1.2.0, MIT license)
- Built specifically for PixiJS v8 using native `ParticleContainer` + `Particle`
- Behavior-oriented design (AlphaBehavior, ColorBehavior, MovementBehavior, ScaleBehavior, SpawnBehavior, TextureBehavior)
- Auto-attaches to PixiJS shared ticker
- Interactive editor available
- API: `new Emitter(container)` → `emitter.play()`

**Alternative:** `@barvynkoa/particle-emitter` (community fork, v8 support but no linked list container, reported performance issues)

**Decision needed:** Confirm switch to `pixi-particle-system` before implementation. This plan assumes the switch.

---

## PixiJS v8 API Notes (verified from docs)

- `new Application()` then `await app.init({...})` — constructor takes no options in v8
- `app.canvas` (not `app.view` — deprecated)
- `resizeTo: window` for automatic resize handling
- `preference: 'webgl'` to force WebGL renderer
- `app.ticker.add((ticker) => { ... })` for game loop
- `app.stage` is the root `Container`

---

## File Manifest

| # | File (relative to workspace root) | Purpose |
|---|---|---|
| 1 | `package.json` | Project metadata, dependencies, scripts |
| 2 | `vite.config.js` | Vite config with GitHub Pages base path |
| 3 | `index.html` | Fullscreen canvas host, viewport meta, CSS reset |
| 4 | `src/main.js` | PixiJS Application init, imports + wires all systems |
| 5 | `src/input/InputManager.js` | keydown/keyup tracking, key states, browser default prevention |
| 6 | `src/switches/SwitchProfile.js` | Data class: key, colour, impactMultiplier |
| 7 | `src/switches/SwitchManager.js` | 8 default profiles, lookup by key code |

---

## Implementation Steps

### Step 1 — Create `package.json`
**File:** `package.json`  
**Depends on:** nothing  

Create manually (not via `npm create vite`) to avoid scaffold overwriting SPEC.md, PLAN.md, TEST.md.

Contents:
- `name`: `"playground"`
- `private`: `true`
- `version`: `"0.1.0"`
- `type`: `"module"`
- `scripts`:
  - `"dev"`: `"vite"`
  - `"build"`: `"vite build"`
  - `"preview"`: `"vite preview"`
- `dependencies`:
  - `"pixi.js"`: `"^8.x"` (latest v8)
  - `"pixi-particle-system"`: `"^1.2.0"` (v8-native particle system — installed now for Phase 2)
- `devDependencies`:
  - `"vite"`: `"^6.x"` (latest stable)

---

### Step 2 — Create `vite.config.js`
**File:** `vite.config.js`  
**Depends on:** nothing  

Contents:
- Import `defineConfig` from `'vite'`
- Set `base: './'` (relative paths — works for both local dev and GitHub Pages)
- `server.open: true` (auto-open browser on `npm run dev`)

---

### Step 3 — Install dependencies
**Files:** `package-lock.json`, `node_modules/`  
**Depends on:** Step 1  

Run `npm install` in the workspace root.

---

### Step 4 — Create `index.html`
**File:** `index.html`  
**Depends on:** nothing (can run parallel with Step 3)  

Contents:
- `<!DOCTYPE html>` with `<html lang="en">`
- `<head>`:
  - `<meta charset="UTF-8">`
  - `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` (prevents iOS zoom)
  - `<title>Playground</title>`
  - Inline `<style>`:
    - `*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }`
    - `html, body { width: 100%; height: 100%; overflow: hidden; }` (no scrollbars)
    - `body { background: #000; touch-action: none; }` (dark bg, prevent iOS gestures)
    - `canvas { display: block; }` (remove inline-block spacing)
- `<body>`:
  - `<script type="module" src="/src/main.js"></script>` (Vite module entry)
  - No `<canvas>` element — PixiJS creates its own canvas via `app.canvas`

Key details:
- `touch-action: none` on body prevents iOS bounce/zoom
- No `<div id="app">` needed — canvas appended to body directly
- `overflow: hidden` prevents all scrolling

---

### Step 5 — Create `src/switches/SwitchProfile.js`
**File:** `src/switches/SwitchProfile.js`  
**Depends on:** nothing (pure data class, no external imports)  

Contents:
- Export a class `SwitchProfile`
- Constructor takes `{ key, label, colour, impactMultiplier = 1.0 }`
  - `key` — the `event.code` string (e.g., `'Space'`, `'ArrowUp'`, `'F7'`)
  - `label` — human-readable name (e.g., `'Space'`, `'Arrow Up'`, `'F7'`)
  - `colour` — hex string (e.g., `'#E69F00'`)
  - `impactMultiplier` — number, default `1.0`
- Store as instance properties

No methods beyond the constructor for now. This is a plain data container.

---

### Step 6 — Create `src/input/InputManager.js`
**File:** `src/input/InputManager.js`  
**Depends on:** nothing (no external imports)  

Contents:
- Export a class `InputManager`
- **Constructor:**
  - `this._held = new Set()` — keys currently held down
  - `this._justPressed = new Set()` — keys pressed this frame (cleared each frame)
  - `this._justReleased = new Set()` — keys released this frame (cleared each frame)
  - `this._onPress = null` — callback: `(keyCode) => void`
  - `this._onRelease = null` — callback: `(keyCode) => void`
  - Bind and attach `keydown` + `keyup` listeners to `window`

- **Blocked keys constant** (module-level):
  ```
  const BLOCKED_KEYS = new Set([
    'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'F7', 'F8', 'Enter'
  ]);
  ```

- **`_onKeyDown(event)` handler:**
  - If `event.code` is in `BLOCKED_KEYS`: call `event.preventDefault()`
  - If `event.repeat`: return early (ignore OS key repeat)
  - Add `event.code` to `_held` and `_justPressed`
  - If `this._onPress`: call `this._onPress(event.code)`

- **`_onKeyUp(event)` handler:**
  - If `event.code` is in `BLOCKED_KEYS`: call `event.preventDefault()`
  - Remove `event.code` from `_held`
  - Add `event.code` to `_justReleased`
  - If `this._onRelease`: call `this._onRelease(event.code)`

- **`update()` method** — call once per frame (from PixiJS ticker):
  - Clear `_justPressed` and `_justReleased`

- **Query methods:**
  - `isHeld(keyCode)` → `this._held.has(keyCode)`
  - `wasPressed(keyCode)` → `this._justPressed.has(keyCode)`
  - `wasReleased(keyCode)` → `this._justReleased.has(keyCode)`

- **`set onPress(callback)`** / **`set onRelease(callback)`** — setters for callbacks

- **`destroy()`** — remove event listeners from `window`

Edge cases:
- `event.repeat` must be filtered out in `keydown` — holding a key fires repeated keydown events, but we only want the first
- Multiple simultaneous keys work naturally because `_held` is a Set
- Tab key is NOT blocked (allow tab-out for accessibility)

---

### Step 7 — Create `src/switches/SwitchManager.js`
**File:** `src/switches/SwitchManager.js`  
**Depends on:** Step 5 (imports `SwitchProfile`)  

Contents:
- Import `SwitchProfile` from `'./SwitchProfile.js'`
- Export a class `SwitchManager`

- **Constructor:**
  - `this._profiles = new Map()` — keyed by `event.code` string
  - Call `this._registerDefaults()`

- **`_registerDefaults()` method** — creates 8 default profiles:

  | Key Code | Label | Colour (Wong's palette) | Impact Multiplier |
  |----------|-------|------------------------|-------------------|
  | `'Space'` | Space | `#E69F00` (Orange) | 1.0 |
  | `'Enter'` | Enter | `#56B4E9` (Sky Blue) | 1.0 |
  | `'ArrowUp'` | Arrow Up | `#009E73` (Bluish Green) | 1.0 |
  | `'ArrowDown'` | Arrow Down | `#F0E442` (Yellow) | 1.0 |
  | `'ArrowLeft'` | Arrow Left | `#0072B2` (Blue) | 1.0 |
  | `'ArrowRight'` | Arrow Right | `#D55E00` (Vermillion) | 1.0 |
  | `'F7'` | F7 | `#CC79A7` (Reddish Purple) | 1.0 |
  | `'F8'` | F8 | `#FFFFFF` (White) | 1.0 |

  For each, create a `new SwitchProfile(...)` and store in `this._profiles`

- **`getProfile(keyCode)`** — returns `SwitchProfile` or `undefined`
- **`hasProfile(keyCode)`** — returns boolean
- **`getAllProfiles()`** — returns `Array.from(this._profiles.values())`
- **`updateProfile(keyCode, changes)`** — merges changes into existing profile (for future settings panel)

---

### Step 8 — Create `src/main.js`
**File:** `src/main.js`  
**Depends on:** Steps 3, 6, 7 (needs pixi.js installed, InputManager, SwitchManager)  

Contents:
- Import `Application` from `'pixi.js'`
- Import `InputManager` from `'./input/InputManager.js'`
- Import `SwitchManager` from `'./switches/SwitchManager.js'`

- **`async function init()`:**
  1. Create `const app = new Application()`
  2. `await app.init({ background: '#1a1a2e', resizeTo: window, preference: 'webgl' })`
     - Dark background for contrast with switch colours
  3. `document.body.appendChild(app.canvas)`
  4. Create `const inputManager = new InputManager()`
  5. Create `const switchManager = new SwitchManager()`
  6. Wire input to switches:
     ```js
     inputManager.onPress = (keyCode) => {
       const profile = switchManager.getProfile(keyCode);
       if (profile) {
         console.log(`[PRESS] ${profile.label} | colour: ${profile.colour} | impact: ${profile.impactMultiplier}`);
       }
     };
     inputManager.onRelease = (keyCode) => {
       const profile = switchManager.getProfile(keyCode);
       if (profile) {
         console.log(`[RELEASE] ${profile.label}`);
       }
     };
     ```
  7. Add ticker for per-frame updates:
     ```js
     app.ticker.add(() => {
       inputManager.update();
     });
     ```
  8. Log startup confirmation: `console.log('Playground ready — press any mapped key')`

- Call `init()` at module level

---

### Step 9 — Manual Verification
**Depends on:** Step 8  

Run `npm run dev` and verify against TEST.md Phase 1 checklist:
- [ ] App boots without errors
- [ ] Canvas fills entire viewport (no scrollbars)
- [ ] Canvas resizes correctly on window resize
- [ ] Space key does NOT scroll the page
- [ ] Arrow keys do NOT scroll the page
- [ ] F7/F8 do NOT trigger browser actions
- [ ] All 8 keys log correct switch profile (key, colour, impact multiplier)
- [ ] Pressing multiple keys simultaneously tracks all of them
- [ ] Key release is detected correctly

---

## Parallelization Map

```
Wave 1:  [Step 1: package.json]  [Step 2: vite.config.js]
              │
Wave 2:  [Step 3: npm install]  ║  [Step 4: index.html]  [Step 5: SwitchProfile.js]  [Step 6: InputManager.js]
              │                  ║                                    │
Wave 3:       │                  ║                          [Step 7: SwitchManager.js]
              │                  ║                                    │
Wave 4:  ─────┴──────────────────╨────────────────────────────────────┘
         [Step 8: src/main.js — wires everything together]
              │
Wave 5:  [Step 9: Verify]
```

**Wave 1** (parallel, no deps): Steps 1 + 2 → `package.json`, `vite.config.js`  
**Wave 2** (parallel, after Wave 1): Steps 3 + 4 + 5 + 6 → npm install ‖ `index.html` ‖ `SwitchProfile.js` ‖ `InputManager.js`  
**Wave 3** (after Step 5): Step 7 → `SwitchManager.js`  
**Wave 4** (after Steps 3 + 6 + 7): Step 8 → `src/main.js`  
**Wave 5** (after Step 8): Step 9 → run dev server and test  

---

## Edge Cases to Handle

1. **`event.repeat` on keydown** — OS fires repeated keydown events when a key is held. InputManager MUST filter these out (`if (event.repeat) return`) to prevent flooding `_justPressed`.
2. **F7/F8 browser shortcuts** — F7 toggles caret browsing in Firefox; F8 has no default in Chrome but may in other browsers. Both must call `preventDefault()`.
3. **Tab key NOT blocked** — Accessibility requirement: users must be able to Tab out of the app. Do not add Tab to `BLOCKED_KEYS`.
4. **Vite scaffold conflict** — Workspace already has SPEC.md, PLAN.md, TEST.md. Using `npm create vite` with `--template vanilla` would fail or overwrite. Solution: create files manually (Steps 1-2).
5. **Canvas not in HTML** — PixiJS v8 creates its own canvas element via `app.canvas`. Do not put a `<canvas>` in `index.html`.
6. **Async init required** — PixiJS v8's `app.init()` is async. The entry point must use an async IIFE or async function.
7. **iOS viewport bounce** — `touch-action: none` on body + `user-scalable=no` in viewport meta prevents zoom/bounce on iPad.
8. **Window blur** — When the window loses focus, held keys should ideally be released. For Phase 1, this is acceptable to omit (no visual consequence yet), but note for Phase 3 when input drives painting.

---

## Open Questions

1. **Confirm particle library switch:** Replace `@pixi/particle-emitter` with `pixi-particle-system` in PLAN.md? This affects Phase 2 implementation significantly (different API, behavior-based config instead of legacy emitter config).
2. **Background colour:** `#1a1a2e` (dark navy) — is this acceptable as the default canvas background? Needs contrast with all 8 Wong palette colours, especially Yellow (`#F0E442`).
3. **Window blur key release:** Should InputManager clear all held keys on `window` blur event? Not critical for Phase 1 but becomes important in Phase 3.
4. **GitHub Pages base path:** Using `base: './'` (relative) works universally. Should this be a repo-specific path like `base: '/playground/'` instead?

---

## Todo List

- [ ] **Step 1** — Create `package.json` → `package.json`
- [ ] **Step 2** — Create `vite.config.js` → `vite.config.js`
- [ ] **Step 3** — Run `npm install` → `package-lock.json`, `node_modules/`
- [ ] **Step 4** — Create `index.html` → `index.html`
- [ ] **Step 5** — Create `SwitchProfile.js` → `src/switches/SwitchProfile.js`
- [ ] **Step 6** — Create `InputManager.js` → `src/input/InputManager.js`
- [ ] **Step 7** — Create `SwitchManager.js` → `src/switches/SwitchManager.js`
- [ ] **Step 8** — Create `main.js` (wired) → `src/main.js`
- [ ] **Step 9** — Run dev server + verify TEST.md Phase 1 checklist
