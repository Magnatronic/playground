# Phase 2: Effect System — Implementation Plan

## Summary

Phase 2 creates four visual effects (SolidCircle, SoftBrush, SmokeEffect, StarburstEffect) with a shared `BaseEffect` interface, an `EffectFactory` for instantiation by name, and a temporary test harness wired into `main.js`. SolidCircle and SoftBrush use PixiJS Graphics/Sprite with ticker-driven alpha fade. SmokeEffect and StarburstEffect use `pixi-particle-system` v1.2.0 (already in `package.json` as `pixi-particle-system`), which auto-attaches to the PixiJS shared ticker. All effects self-cleanup from their parent container once fade completes.

---

## Critical Findings from Research

### pixi-particle-system v1.2.0 API (verified)

- **Import:** `import { Emitter } from 'pixi-particle-system'`
- **Container:** Requires `ParticleContainer` from `pixi.js` — can be added as child of a regular `Container`
- **Lifecycle:** `emitter.play()` starts, `emitter.stop(false)` stops spawning (particles die naturally), `emitter.stop(true)` kills instantly
- **Auto-ticker:** Emitter hooks into PixiJS shared ticker automatically — no manual update loop needed for particle effects
- **Config-based:** Constructor accepts `EmitterConfig` object with behavior configs:
  - `alphaBehavior` — `{ mode: 'list', list: [1, 0] }` for fade-out
  - `colorBehavior` — `{ value: '#ff00ff' }` for static tint (hex string)
  - `movementBehavior` — `{ minMoveSpeed: {x,y}, maxMoveSpeed: {x,y}, mode: 'linear', space: 'global' }`
  - `scaleBehavior` — `{ mode: 'random', xList: [min, max], yList: [min, max] }`
  - `spawnBehavior` — `{ shape: 'point'|'circle'|'line'|'rectangle', direction: {x,y}, origin: {x,y} }`
  - `rotationBehavior`, `textureBehavior`
- **Config fields:** `emitterVersion`, `minParticleLifetime`, `maxParticleLifetime`, `spawnInterval`, `maxParticles`, `particlesPerWave`, `spawnChance`
- **Key constraint:** `ParticleContainer` cannot hold regular `Graphics`/`Sprite` children — only `Particle` objects managed by the emitter

### PixiJS v8 API (verified)

- **Graphics:** `new Graphics().circle(x, y, r).fill({ color: '#E69F00' })` — NOT `.beginFill()`
- **Texture from Canvas:** `Texture.from(canvas)` — create offscreen canvas, draw gradient, convert to texture
- **Sprite:** `new Sprite(texture)` — set `anchor`, `alpha`, `tint`
- **Container:** `new Container()` — use as parent, can hold Sprites/Graphics/ParticleContainers
- **Ticker:** `app.ticker.add((ticker) => { ... })` — `ticker.deltaTime` gives frame delta

### Architecture Decision: Two Effect Families

| Family | Effects | Rendering | Fade Mechanism | Cleanup |
|--------|---------|-----------|----------------|---------|
| **Graphics-based** | SolidCircle, SoftBrush | `Graphics` / `Sprite` added to regular `Container` | App ticker callback reduces `alpha` each frame | Remove display object from parent + remove ticker callback |
| **Particle-based** | SmokeEffect, StarburstEffect | `Emitter` + `ParticleContainer` added to parent `Container` | `alphaBehavior` list `[1, 0]` over particle lifetime | `emitter.stop(false)` → poll `particleCount === 0` → destroy `ParticleContainer` |

This split is necessary because `ParticleContainer` only accepts internally-managed `Particle` objects, not arbitrary Graphics/Sprites.

---

## Shared Options Interface

All effects accept:
```js
{
  x,                  // Number — center x position
  y,                  // Number — center y position
  colour,             // String — hex colour e.g. '#E69F00'
  size,               // Number — base size in pixels (default: 40)
  opacity,            // Number — initial alpha 0–1 (default: 1)
  scatter,            // Number — random offset range in px (default: 0)
  impactMultiplier    // Number — scales size (default: 1.0)
}
```

Scatter: before rendering, apply `x += (Math.random() - 0.5) * scatter * 2`, same for y.

Effective size: `size * impactMultiplier`.

---

## File Manifest

| # | File | Purpose | New/Modify |
|---|------|---------|------------|
| 1 | `src/effects/BaseEffect.js` | Base class — common `spawn(container, options)` interface, scatter utility, cleanup contract | **New** |
| 2 | `src/effects/SolidCircle.js` | Graphics circle, colour-filled, ticker-driven fade | **New** |
| 3 | `src/effects/SoftBrush.js` | Radial gradient texture via offscreen Canvas 2D, renders as Sprite, alpha fade | **New** |
| 4 | `src/effects/SmokeEffect.js` | Particle emitter: upward drift, scale up, alpha fade-out | **New** |
| 5 | `src/effects/StarburstEffect.js` | Particle emitter: radial burst outward from center, alpha fade | **New** |
| 6 | `src/effects/EffectFactory.js` | Factory: name string → effect class instance | **New** |
| 7 | `src/main.js` | Add test harness: wire switches → effect spawning, ticker update loop | **Modify** |

---

## Implementation Steps

### Step 1: BaseEffect.js
**File:** `src/effects/BaseEffect.js`  
**Depends on:** Nothing  
**Parallel group:** A

Create a base class with:
- `spawn(container, options)` — abstract, throws if not overridden. Before calling subclass logic, apply scatter offset to `options.x` / `options.y` via a helper method.
- `_applyScatter(options)` — returns new `{x, y}` with random offset: `x += (Math.random() - 0.5) * scatter * 2`
- `_getEffectiveSize(options)` — returns `(options.size || 40) * (options.impactMultiplier || 1.0)`
- Subclasses override `spawn()` and call these helpers

The base class does NOT hold rendering state — each `spawn()` call is a fire-and-forget operation that adds display objects to the container and schedules its own cleanup.

---

### Step 2: SolidCircle.js
**File:** `src/effects/SolidCircle.js`  
**Depends on:** Step 1 (BaseEffect)  
**Parallel group:** B

Extends `BaseEffect`. The `spawn(container, options)` method:
1. Call `_applyScatter(options)` for final `x, y`
2. Calculate `effectiveSize = _getEffectiveSize(options)` → use as radius
3. Create `new Graphics().circle(0, 0, effectiveSize).fill({ color: options.colour })`
4. Set `graphics.position.set(x, y)` and `graphics.alpha = options.opacity ?? 1`
5. Add to `container`
6. Store a reference to the ticker callback for cleanup
7. **Fade logic:** Needs access to `app.ticker` — pass `app` as part of options or as a separate parameter to `spawn`. Recommended: add `ticker` to options object (`options.ticker`). Each frame: reduce `alpha` by `deltaTime / 60` (fades over ~60 frames ≈ 1 second at 60fps). When `alpha <= 0`, remove graphics from parent and remove ticker callback.

**PixiJS v8 API to use:**
- `import { Graphics } from 'pixi.js'`
- `.circle(x, y, r).fill({ color })` — v8 chainable API
- `graphics.destroy()` after removing from parent to free GPU resources

---

### Step 3: SoftBrush.js
**File:** `src/effects/SoftBrush.js`  
**Depends on:** Step 1 (BaseEffect)  
**Parallel group:** B (parallel with Step 2 — no file overlap)

Extends `BaseEffect`. The `spawn(container, options)` method:
1. Call `_applyScatter(options)` for final `x, y`
2. Calculate `effectiveSize = _getEffectiveSize(options)` → use as radius
3. **Create radial gradient texture:**
   - Create offscreen `document.createElement('canvas')` sized `effectiveSize * 2` × `effectiveSize * 2`
   - Get 2D context, create `ctx.createRadialGradient(center, center, 0, center, center, effectiveSize)`
   - Add colour stops: `0` → `options.colour` at full alpha, `1` → `options.colour` at alpha 0
   - Fill circle with gradient
   - Convert to PixiJS texture: `Texture.from(canvas)`
4. Create `new Sprite(texture)`, set `anchor.set(0.5)`, position at `(x, y)`, set initial `alpha`
5. Add to `container`
6. **Fade logic:** Same ticker-based alpha reduction as SolidCircle (~1 second fade)
7. On cleanup: `sprite.destroy({ texture: true, textureSource: true })` to free both sprite and the procedural texture

**PixiJS v8 API to use:**
- `import { Sprite, Texture } from 'pixi.js'`
- `Texture.from(canvas)` — creates texture from HTML canvas element

**Edge case:** Colour parsing — the hex colour string from `SwitchProfile` needs to be converted to RGBA for the Canvas 2D gradient. Parse `#RRGGBB` → extract R, G, B → use `rgba(r, g, b, alpha)` for gradient stops.

---

### Step 4: SmokeEffect.js
**File:** `src/effects/SmokeEffect.js`  
**Depends on:** Step 1 (BaseEffect)  
**Parallel group:** B (parallel with Steps 2 & 3 — no file overlap)

Extends `BaseEffect`. The `spawn(container, options)` method:
1. Call `_applyScatter(options)` for final `x, y`
2. Calculate `effectiveSize = _getEffectiveSize(options)`
3. Create `new ParticleContainer()` and add it to `container`
4. Position the `ParticleContainer` at `(x, y)`
5. **Create Emitter** with smoke config:
   ```js
   new Emitter(particleContainer, {
     emitterVersion: '1.2.0',
     minParticleLifetime: 0.8,
     maxParticleLifetime: 1.5,
     spawnInterval: 0.05,
     maxParticles: 30,
     particlesPerWave: 2,
     alphaBehavior: {
       mode: 'list',
       list: [options.opacity ?? 1, 0],
     },
     colorBehavior: {
       value: options.colour,
     },
     scaleBehavior: {
       mode: 'list',
       xList: [effectiveSize / 100, effectiveSize / 40],
       yList: [effectiveSize / 100, effectiveSize / 40],
     },
     movementBehavior: {
       minMoveSpeed: { x: -20, y: -80 },
       maxMoveSpeed: { x: 20, y: -30 },
       mode: 'linear',
       space: 'global',
     },
     spawnBehavior: {
       shape: 'circle',
       outerRadius: effectiveSize * 0.3,
       innerRadius: 0,
       direction: { x: 0, y: -1 },
     },
   })
   ```
6. Call `emitter.play()`
7. **One-shot behaviour:** After a short emit duration (~0.3s), call `emitter.stop(false)` to stop spawning but let existing particles die naturally
8. **Cleanup:** Use a ticker callback to check `emitter.particleCount === 0` after stopping. When zero, remove `ParticleContainer` from parent and destroy it.

**Scheduling the stop:** Use `setTimeout(() => emitter.stop(false), 300)` for the emit window, or track elapsed time in the ticker.

**Texture note:** Particles default to `Texture.WHITE` (1×1 white pixel). The ColorBehavior tints this to the switch colour. For a softer smoke look, consider creating a small blurred circle texture. This can be a **stretch goal** — start with `Texture.WHITE` + scale and see if it looks acceptable. If not, create a procedural soft-circle texture (similar to SoftBrush's gradient technique) and pass via `textureBehavior`.

---

### Step 5: StarburstEffect.js
**File:** `src/effects/StarburstEffect.js`  
**Depends on:** Step 1 (BaseEffect)  
**Parallel group:** B (parallel with Steps 2, 3, 4 — no file overlap)

Extends `BaseEffect`. The `spawn(container, options)` method:
1. Call `_applyScatter(options)` for final `x, y`
2. Calculate `effectiveSize = _getEffectiveSize(options)`
3. Create `new ParticleContainer()` and add it to `container`
4. Position at `(x, y)`
5. **Create Emitter** with radial burst config:
   ```js
   new Emitter(particleContainer, {
     emitterVersion: '1.2.0',
     minParticleLifetime: 0.4,
     maxParticleLifetime: 0.8,
     spawnInterval: 0.01,
     maxParticles: 50,
     particlesPerWave: 50,
     alphaBehavior: {
       mode: 'list',
       list: [options.opacity ?? 1, 0],
     },
     colorBehavior: {
       value: options.colour,
     },
     scaleBehavior: {
       mode: 'random',
       xList: [effectiveSize / 80, effectiveSize / 40],
       yList: [effectiveSize / 80, effectiveSize / 40],
     },
     movementBehavior: {
       minMoveSpeed: { x: -200, y: -200 },
       maxMoveSpeed: { x: 200, y: 200 },
       mode: 'linear',
       space: 'global',
     },
     spawnBehavior: {
       shape: 'point',
       direction: { x: 0, y: 0 },
     },
   })
   ```
6. **One-shot burst:** Call `emitter.play()`, then immediately `emitter.stop(false)` — all 50 particles spawn in a single wave, then fly outward and die. No continuous emission needed.
7. **Cleanup:** Same ticker-based `particleCount === 0` check as SmokeEffect.

**Key difference from Smoke:** Starburst spawns all particles in one wave (`particlesPerWave: 50`), speed is omnidirectional (`minMoveSpeed` negative, `maxMoveSpeed` positive on both axes), shorter lifetime.

---

### Step 6: EffectFactory.js
**File:** `src/effects/EffectFactory.js`  
**Depends on:** Steps 1–5  
**Parallel group:** C (must wait for all effect classes to exist)

Simple factory module:
1. Import all four effect classes
2. Export a map of name → class: `{ solid: SolidCircle, brush: SoftBrush, smoke: SmokeEffect, starburst: StarburstEffect }`
3. Export `createEffect(typeName)` function that returns `new EffectClass()` or throws for unknown types
4. Export `getEffectTypes()` that returns the array of valid type name strings

No singleton pattern needed — effects are stateless (each `spawn()` call is independent).

---

### Step 7: Modify main.js — Test Harness
**File:** `src/main.js`  
**Depends on:** Step 6 (EffectFactory)  
**Parallel group:** D (must wait for factory)

Modify the existing `init()` function:

1. **Import** `EffectFactory` / `createEffect` from `./effects/EffectFactory.js`
2. **Create an effects container** — `new Container()` added to `app.stage`, to hold all spawned effects (keeps them grouped, easy to clear later)
3. **Create effect instances** — one per type, stored in an array for cycling
4. **Track current effect index** — cycle through `['solid', 'brush', 'smoke', 'starburst']`
5. **Replace the existing `onKeyAction` callback** — currently just logs to console. New behaviour:
   - On `'press'` action: spawn the current effect type at screen center (or random position for visual variety)
   - Pass the switch profile's colour and impactMultiplier
   - Pass `app.ticker` in options so Graphics/Sprite effects can register fade callbacks
   - Log the spawn to console (keep some debug info)
6. **Effect cycling strategy** (choose one):
   - **Option A (recommended):** Cycle through effect types round-robin. Each press increments an index, wrapping at 4. This way you see all effects quickly.
   - **Option B:** Map specific keys to specific effects (e.g., Space/Enter → solid, arrows → brush, F7 → smoke, F8 → starburst). More deliberate control.
   - **Recommendation: Option A** for simplicity — this is a temporary harness.
7. **Position strategy:** Alternate between center `(app.screen.width/2, app.screen.height/2)` and random positions. Use random offset of ±200px from center for variety while keeping effects visible.
8. **Console overlay (optional):** Add a small text label in the corner showing current effect type name — helps with manual QA. Use PixiJS `Text` or a DOM element.

**What to remove:** The existing `console.log` in `onKeyAction` should be replaced (not just appended to).

---

## Parallelization Map

```
Step 1 (BaseEffect)           ─── Group A ───>
                                                \
Step 2 (SolidCircle)    ┐                        \
Step 3 (SoftBrush)      ├── Group B (parallel) ──>── Step 6 (Factory) ──> Step 7 (main.js)
Step 4 (SmokeEffect)    │                        /       Group C              Group D
Step 5 (StarburstEffect)┘                       /
```

- **Group A:** Step 1 runs first (no dependencies)
- **Group B:** Steps 2, 3, 4, 5 can all run in parallel (each in its own file, all depend only on BaseEffect)
- **Group C:** Step 6 runs after all of Group B (imports all effect classes)
- **Group D:** Step 7 runs last (modifies main.js, depends on factory)

---

## Edge Cases to Handle

1. **Rapid spawning:** Multiple effects spawned per second — each must independently manage its own lifecycle. No shared state between spawns. ParticleContainers will accumulate briefly; the cleanup poll ensures they're removed.

2. **Colour parsing for Canvas 2D gradient (SoftBrush):** Switch profile colours are hex strings (`#E69F00`). Canvas 2D `addColorStop` can accept hex directly for opaque stops, but for the transparent stop need `rgba()`. Implement a `hexToRgb(hex)` helper in BaseEffect.

3. **White switch colour (`#FFFFFF`):** F8's colour is white — on the default dark background (`#1a1a2e`) this will be visible, but test that the gradient/particle tinting looks correct with white. White particles with `Texture.WHITE` and `ColorBehavior { value: '#FFFFFF' }` should just appear white — no issue.

4. **Yellow switch colour (`#F0E442`):** Low contrast on light backgrounds. Not an issue on the dark `#1a1a2e` background.

5. **ParticleContainer cleanup timing:** The ticker poll for `particleCount === 0` could run before particles have actually been spawned (race condition if checked same frame). Add a `hasStarted` flag that flips to true after `emitter.play()` + at least one frame.

6. **Texture memory:** SoftBrush creates a new procedural texture per spawn. Over many spawns this could leak GPU memory if textures aren't destroyed. The cleanup must call `sprite.destroy({ texture: true, textureSource: true })` to free both the texture and its backing canvas.

7. **Multiple effects overlapping:** Effects are additive — they stack visually. This is the desired behaviour for painting. No z-ordering issues since later effects render on top.

8. **Browser compatibility for offscreen Canvas:** `document.createElement('canvas')` works everywhere. Do NOT use `OffscreenCanvas` — not available in all target browsers (especially older iPad Safari).

---

## Open Questions

1. **Ticker access pattern:** Effects need access to `app.ticker` for fade scheduling. Three options:
   - **(a)** Pass `ticker` in the options object to `spawn()` — simple, explicit
   - **(b)** Pass `app` reference in the options — gives access to ticker + screen dimensions
   - **(c)** Use PixiJS shared ticker `Ticker.shared` — no parameter needed
   
   **Recommendation:** Option (c) — `Ticker.shared` is the same ticker the `Application` uses by default, and `pixi-particle-system` already attaches to it. Avoids coupling effects to the app instance. Import as `import { Ticker } from 'pixi.js'`.

2. **Smoke texture quality:** The default `Texture.WHITE` (1×1 white pixel) scaled up will look blocky/sharp-edged. Should we create a procedural soft-circle texture for smoke particles?
   - **Recommendation:** Yes — create a shared utility function (in BaseEffect or a separate `src/effects/textures.js`) that generates a blurred circle canvas texture once, caches it, and reuses it for both SmokeEffect and StarburstEffect. This dramatically improves visual quality. **However**, this is a stretch goal — start with `Texture.WHITE` and confirm the emitter pipeline works end-to-end first.

3. **Effect duration tuning:** The proposed fade durations (1s for Graphics, 0.8–1.5s for smoke particles, 0.4–0.8s for starburst) are starting values. Will need manual tuning in the test harness.

4. **`emitterVersion` field:** The config requires `emitterVersion`. The docs show it as a string but the example uses `0` (number). Try string `'1.2.0'` first; if it errors, fall back to `0`.

---

## Verification Checklist (from TEST.md)

- [ ] Solid circle renders with correct colour
- [ ] Soft brush renders with feathered edge
- [ ] Smoke effect emits particles that drift and fade
- [ ] Starburst effect emits radial burst particles
- [ ] All effects fade over time
- [ ] Impact multiplier scales effect size
- [ ] Phase 1 checks still pass

---

## Todo List

| # | Task | File(s) | Assignee | Depends on |
|---|------|---------|----------|------------|
| 1 | Create BaseEffect class with `spawn()` interface, `_applyScatter()`, `_getEffectiveSize()`, `hexToRgb()` helper | `src/effects/BaseEffect.js` | Coder | — |
| 2 | Create SolidCircle effect — Graphics circle, ticker alpha fade, self-cleanup with `destroy()` | `src/effects/SolidCircle.js` | Coder | #1 |
| 3 | Create SoftBrush effect — offscreen Canvas 2D radial gradient → Texture → Sprite, ticker fade, destroy with texture cleanup | `src/effects/SoftBrush.js` | Coder | #1 |
| 4 | Create SmokeEffect — ParticleContainer + Emitter with upward drift config, one-shot emit window, particleCount poll cleanup | `src/effects/SmokeEffect.js` | Coder | #1 |
| 5 | Create StarburstEffect — ParticleContainer + Emitter with radial burst config, single-wave burst, particleCount poll cleanup | `src/effects/StarburstEffect.js` | Coder | #1 |
| 6 | Create EffectFactory — name→class map, `createEffect()`, `getEffectTypes()` | `src/effects/EffectFactory.js` | Coder | #2, #3, #4, #5 |
| 7 | Modify main.js — add effects Container to stage, wire onKeyAction to spawn effects, cycle effect type per press, optional corner label | `src/main.js` | Coder | #6 |
| 8 | Manual QA — run through Phase 2 verification checklist + Phase 1 regression | All | QA | #7 |
