# Phase 5: Audio System — Implementation Plan

## Summary

Phase 5 adds procedural audio feedback to the Playground app using the Web Audio API's `OscillatorNode` and `GainNode` — zero external sound files. A singleton `AudioManager` lazily initialises the `AudioContext` on first user interaction (satisfying browser autoplay policy), then exposes simple methods for each sound event: paint press, sweep tick, fill milestones (25/50/75%), and completion fanfare. Each switch produces a pitch derived from its array index for musical variety. A session-scoped mute toggle (Ctrl+M) gates all output via a master `GainNode`. Integration points are narrow: `PaintingActivity.handleInput()`, `SweepMode.update()`, `ScreenFillActivity.handleInput()`, and `main.js` (keyboard shortcut + AudioManager wiring). No changes to the effects system, PaintLayer, or fill modes.

---

## Critical Design Decisions

### 1. Procedural Synthesis Only (No Sound Files)

All sounds are generated at runtime with `OscillatorNode` → `GainNode` → `AudioContext.destination`. This avoids:
- Asset loading / fetch failures
- `public/sounds/` directory and file management
- Licensing concerns
- Deployment complexity

Trade-off: sounds will be simple tonal beeps/arpeggios rather than rich samples. Acceptable for the classroom use case where "pleasant and not annoying" matters more than realism.

### 2. Singleton AudioManager (Global Import)

`AudioManager` is a module-level singleton (not a class you instantiate). Activities and modes import it directly rather than receiving it via constructor injection. This matches the project's lightweight vanilla JS style (no DI framework, no global event bus). The singleton pattern keeps integration simple — any file can `import { audioManager } from '../../audio/AudioManager.js'` and call methods.

### 3. Lazy AudioContext Init

The `AudioContext` is created on the first call to any sound method, guaranteeing it happens inside a user gesture (keydown handler → `handleInput()` → `audioManager.playPressSound()`). If the context is `suspended`, it calls `resume()`. This satisfies Chrome, Safari, and Firefox autoplay policies without a separate "click to enable audio" prompt.

### 4. Switch Pitch Mapping

Each switch gets a pitch from a pentatonic scale (C major pentatonic: C5, D5, E5, G5, A5, C6, D6, E6) mapped by switch index 0–7. Pentatonic intervals always sound consonant together, so simultaneous presses from multiple students are pleasant. The `SwitchProfile` doesn't currently have an explicit `index` property — `ScreenFillActivity` already uses `switchProfile.index || 0`. We need to add an `index` field to `SwitchProfile` and set it during `SwitchManager` construction.

### 5. Sweep Tick Throttling

`SweepMode.update()` runs every frame (~60fps). Playing a sound every frame would be overwhelming. Instead, the sweep tick fires when the cursor has moved ≥ 40px since the last tick (configurable). This produces a subtle rhythmic ticking that accelerates in bounce/diagonal patterns (more distance per frame) and stays calm during horizontal/vertical sweeps.

### 6. Milestone Sound Tracking

`ScreenFillActivity` already computes `percentage` after each stamp. The AudioManager doesn't track milestones itself — instead, `ScreenFillActivity.handleInput()` checks if percentage just crossed 25/50/75 thresholds (was below, now at or above) and calls `audioManager.playMilestone(level)`. The activity owns the threshold logic; AudioManager just plays the requested sound.

### 7. Mute State: Session-Scoped, No Persistence

Mute state lives in `AudioManager.muted` (boolean). Toggled via `audioManager.toggleMute()`. Not persisted to localStorage — resets to unmuted on page reload. Matches the "settings reset each session" design principle from SPEC.md §8.

---

## New Files

### `src/audio/AudioManager.js`

**Responsibility:** Singleton audio engine. Manages `AudioContext` lifecycle, mute state, and all sound synthesis.

**Public API:**
```
audioManager.playPressSound(switchIndex)    // Paint stamp / fill press — pitched by switch
audioManager.playSweepTick(switchIndex?)     // Subtle tick for sweep cursor movement (optional pitch)
audioManager.playMilestone(level)            // level: 1 (25%), 2 (50%), 3 (75%) — ascending tones
audioManager.playFanfare()                   // Completion — ascending arpeggio
audioManager.toggleMute()                    // Toggle mute, returns new mute state
audioManager.isMuted()                       // Query mute state
```

**Internal structure:**
- `_ctx` — `AudioContext`, created lazily
- `_masterGain` — `GainNode` at end of chain, value 0 when muted / 1 when unmuted
- `_ensureContext()` — creates `AudioContext` if null, resumes if suspended
- `_playTone(frequency, duration, type, envelope)` — low-level: creates `OscillatorNode` + `GainNode`, applies ADSR-like envelope via `gain.setValueAtTime` / `linearRampToValueAtTime`, connects to `_masterGain`, starts, schedules stop
- `_playSequence(notes, interval)` — plays array of `{freq, duration}` with staggered start times (for milestones and fanfare)

**Sound designs:**
| Sound | Waveform | Frequency | Duration | Envelope |
|---|---|---|---|---|
| Press | `sine` | Pentatonic scale by switch index (C5=523 → E6=1319 Hz) | 80ms | Quick attack (5ms), short decay |
| Sweep tick | `sine` | 880 Hz (A5), quiet | 30ms | Instant attack, fast fade |
| Milestone 1 (25%) | `triangle` | C5→E5 two-note | 150ms each | Gentle attack/decay |
| Milestone 2 (50%) | `triangle` | C5→E5→G5 three-note | 150ms each | Gentle attack/decay |
| Milestone 3 (75%) | `triangle` | C5→E5→G5→C6 four-note | 150ms each | Gentle attack/decay |
| Fanfare | `triangle` | C5→E5→G5→C6→E6 ascending arpeggio | 120ms each, slight overlap | Bright attack, lingering decay |

**Concurrency:** Each `playTone` / `playSequence` call creates fresh `OscillatorNode` + `GainNode` nodes that self-disconnect after playback (via `oscillator.onended`). No pooling needed — Web Audio API handles garbage collection of completed nodes efficiently. Multiple simultaneous sounds just layer.

---

## Modified Files

### `src/switches/SwitchProfile.js`

**Change:** Add `index` property to constructor.

```js
constructor({ key, label, colour, impactMultiplier = 1.0, index = 0 })
```

**Why:** Needed for pitch mapping. Currently `switchProfile.index` is referenced in `ScreenFillActivity` but never set, always falling back to 0.

**File assignment:** `src/switches/SwitchProfile.js`

---

### `src/switches/SwitchManager.js`

**Change:** Pass `index: N` to each `SwitchProfile` constructor (0–7 in declaration order).

**File assignment:** `src/switches/SwitchManager.js`

---

### `src/activities/painting/PaintingActivity.js`

**Change:** Import `audioManager`, call `audioManager.playPressSound(switchProfile.index)` inside `handleInput()` after the debounce check passes (right before or after the stamp).

**Lines affected:** ~1 import line, ~1 line in `handleInput()`.

**File assignment:** `src/activities/painting/PaintingActivity.js`

---

### `src/activities/painting/modes/SweepMode.js`

**Change:** Import `audioManager`. Add distance-tracking state (`_lastTickX`, `_lastTickY`, `_tickThreshold = 40`). In `update()`, after position updates, check if distance from last tick position exceeds threshold. If so, call `audioManager.playSweepTick()` and reset last tick position.

**Lines affected:** ~1 import, ~3 fields in constructor, ~6 lines in `update()`.

**File assignment:** `src/activities/painting/modes/SweepMode.js`

---

### `src/activities/screen-fill/ScreenFillActivity.js`

**Changes:**
1. Import `audioManager`
2. Add `_lastMilestone = 0` field in constructor
3. In `handleInput()`, after computing `percentage`:
   - Call `audioManager.playPressSound(switchProfile.index)` for the stamp sound
   - Check milestone crossings: if `percentage >= 25 && _lastMilestone < 1` → `audioManager.playMilestone(1)`, set `_lastMilestone = 1`. Same for 50→2, 75→3.
4. In the completion block (where `this.completed = true`), call `audioManager.playFanfare()`
5. In `clear()` / `setFillMode()`, reset `_lastMilestone = 0`

**Lines affected:** ~1 import, ~1 field, ~12 lines in `handleInput()`, ~2 lines in reset paths.

**File assignment:** `src/activities/screen-fill/ScreenFillActivity.js`

---

### `src/main.js`

**Changes:**
1. Import `audioManager` from `./audio/AudioManager.js`
2. Add `Ctrl+M` handler in the `keydown` listener (alongside existing `Ctrl+R`):
   ```js
   if (event.code === 'KeyM' && (event.ctrlKey || event.metaKey)) {
     event.preventDefault();
     const muted = audioManager.toggleMute();
     console.log(`Sound: ${muted ? 'muted' : 'unmuted'}`);
     return;
   }
   ```
3. Add console.log line for the new shortcut

**Lines affected:** ~1 import, ~6 lines in keydown handler, ~1 console.log.

**File assignment:** `src/main.js`

---

## Dependency Graph

```
                    ┌──────────────────────┐
                    │  src/audio/           │
           ┌───────│  AudioManager.js      │───────┐
           │        │  (NEW — standalone)   │       │
           │        └──────────────────────┘       │
           │                    │                    │
     Can build in              │               Can build in
      parallel                 │                parallel
           │                    │                    │
           ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ SwitchProfile.js │  │ SwitchManager.js │  │ (no dependency on  │
│ (add index)      │  │ (add index args) │  │  other new code)   │
└─────────────────┘  └──────────────────┘  └────────────────────┘
         │                    │
         └────────┬───────────┘
                  │
            Sequential
          (Manager depends
           on Profile)
                  │
                  ▼
    ┌─────────────────────────────────────────┐
    │         Integration Wave (sequential)    │
    │                                          │
    │  1. PaintingActivity.js  (import + call) │
    │  2. SweepMode.js         (import + call) │
    │  3. ScreenFillActivity.js(import + call) │
    │  4. main.js              (Ctrl+M)        │
    │                                          │
    │  (These can be done in parallel since    │
    │   they only depend on AudioManager,      │
    │   not on each other)                     │
    └─────────────────────────────────────────┘
```

### Build Order

**Wave 1 (parallel — no dependencies between them):**
- `src/audio/AudioManager.js` (new file)
- `src/switches/SwitchProfile.js` (add `index` param)

**Wave 2 (depends on Wave 1):**
- `src/switches/SwitchManager.js` (depends on SwitchProfile having `index`)

**Wave 3 (all depend on AudioManager existing; independent of each other):**
- `src/activities/painting/PaintingActivity.js`
- `src/activities/painting/modes/SweepMode.js`
- `src/activities/screen-fill/ScreenFillActivity.js`
- `src/main.js`

---

## Implementation Steps

### Step 1: Create `src/audio/AudioManager.js`
**File:** `src/audio/AudioManager.js`

- Define pentatonic frequency array: `[523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51]` (C5 through E6)
- Implement `_ensureContext()`: create `AudioContext` if null, call `resume()` if suspended, create `_masterGain` connected to `destination`
- Implement `_playTone(freq, duration, waveType, volume, attackMs, decayMs)`: create `OscillatorNode` + `GainNode`, shape envelope, connect to `_masterGain`, schedule start/stop, clean up on `onended`
- Implement `_playSequence(notes, intervalMs)`: iterate notes array with staggered `setTimeout` offsets calling `_playTone`
- Implement `playPressSound(switchIndex)`: map index to pentatonic freq, play short sine tone (80ms)
- Implement `playSweepTick()`: play very quiet, very short sine at 880Hz (30ms, volume 0.15)
- Implement `playMilestone(level)`: ascending note sequence — level 1 = 2 notes, level 2 = 3 notes, level 3 = 4 notes from C major pentatonic
- Implement `playFanfare()`: 5-note ascending arpeggio (C5→E5→G5→C6→E6) with triangle wave, bright envelope
- Implement `toggleMute()`: flip `_muted`, set `_masterGain.gain.value` to 0 or 1, return new state
- Implement `isMuted()`: return `_muted`
- Export singleton instance: `export const audioManager = new AudioManager()`

### Step 2: Add `index` to `SwitchProfile`
**File:** `src/switches/SwitchProfile.js`

- Add `index` to destructured constructor params with default `0`
- Assign `this.index = index`

### Step 3: Pass `index` values in `SwitchManager`
**File:** `src/switches/SwitchManager.js`

- Add `index: 0` through `index: 7` to each of the 8 `SwitchProfile` constructor calls, in declaration order

### Step 4: Wire press sound into `PaintingActivity`
**File:** `src/activities/painting/PaintingActivity.js`

- Add import: `import { audioManager } from '../../audio/AudioManager.js'`
- In `handleInput()`, after debounce passes and before/after stamp logic, add: `audioManager.playPressSound(switchProfile.index)`

### Step 5: Wire sweep tick into `SweepMode`
**File:** `src/activities/painting/modes/SweepMode.js`

- Add import: `import { audioManager } from '../../../audio/AudioManager.js'`
- In constructor, add: `this._lastTickX = 0`, `this._lastTickY = 0`, `this._tickThreshold = 40`
- At end of `update()`, compute distance from `(_lastTickX, _lastTickY)` to `(this.x, this.y)`. If ≥ `_tickThreshold`:
  - Call `audioManager.playSweepTick()`
  - Update `_lastTickX = this.x`, `_lastTickY = this.y`
- In `applyPattern()` (which resets position), also reset `_lastTickX`/`_lastTickY` to new position

### Step 6: Wire press, milestone, and fanfare sounds into `ScreenFillActivity`
**File:** `src/activities/screen-fill/ScreenFillActivity.js`

- Add import: `import { audioManager } from '../../audio/AudioManager.js'`
- Add field: `this._lastMilestone = 0` in constructor
- In `handleInput()`, after `this.fillMode.stamp(...)`:
  - Call `audioManager.playPressSound(switchProfile.index)`
  - After percentage is computed, check milestones:
    ```
    if (percentage >= 25 && this._lastMilestone < 1) { audioManager.playMilestone(1); this._lastMilestone = 1; }
    if (percentage >= 50 && this._lastMilestone < 2) { audioManager.playMilestone(2); this._lastMilestone = 2; }
    if (percentage >= 75 && this._lastMilestone < 3) { audioManager.playMilestone(3); this._lastMilestone = 3; }
    ```
  - In completion block, add: `audioManager.playFanfare()`
- In `clear()` method, add: `this._lastMilestone = 0`
- In `setFillMode()` method (which calls `clear()`), ensure milestone resets (already covered if `clear()` resets it)

### Step 7: Add `Ctrl+M` mute shortcut to `main.js`
**File:** `src/main.js`

- Add import: `import { audioManager } from './audio/AudioManager.js'`
- In the `keydown` handler, add a `Ctrl+M` / `Cmd+M` check (same pattern as existing `Ctrl+R`) that calls `audioManager.toggleMute()` and logs the result
- Add `console.log('Mute toggle: Ctrl+M')` to the startup help output

---

## Edge Cases to Handle

1. **AudioContext resume race:** `_ensureContext()` calls `resume()` which returns a Promise. Don't `await` it — the context typically resumes synchronously on user gesture, and if it doesn't, the tone just silently fails on that first press and works on the next. No error to handle.

2. **Rapid presses:** Multiple `playPressSound()` calls in quick succession (e.g., 8 students pressing simultaneously). Each creates independent oscillator nodes — Web Audio mixes them. At 8 simultaneous tones the output might clip. Apply a conservative base volume (0.2–0.3) to leave headroom for concurrent sounds.

3. **Sweep tick at init:** When `SweepMode.init()` sets position to screen center, `_lastTickX/Y` should also be set to that position to avoid an immediate tick on the first frame.

4. **Milestone sound during fanfare:** If the 75% milestone and 100% completion happen on the same press (e.g., big stamp jumps from 74% to 100%), both milestone(3) and fanfare would play. This is fine — the fanfare will dominate and the milestone adds a subtle layer. No special handling needed.

5. **Activity switching while sound plays:** Oscillator nodes are scheduled to stop after their duration. Switching activities mid-tone is harmless — the node finishes and self-disconnects via `onended`. No cleanup needed in `destroy()`.

6. **Mute toggle before any sound:** If the user presses `Ctrl+M` before any sound has played, `_ensureContext()` will be called (the keydown is a user gesture), creating the AudioContext. This is fine.

7. **Browser tab backgrounding:** Chrome throttles timers in background tabs, but `AudioContext` scheduling uses its own clock (`currentTime`) which is independent. Sounds scheduled via `oscillator.start(ctx.currentTime + offset)` will still fire correctly. No issue.

8. **SweepMode used in ScreenFillActivity:** `ScreenFillActivity` creates its own `SweepMode` instance. The tick sound will play from `SweepMode.update()` regardless of which activity owns it. This is correct — the sweep cursor ticks in both activities.

---

## Open Questions

1. **Sweep tick in Screen Fill:** Should the sweep tick sound play when using sweep mode inside Screen Fill, or only in Painting? Current plan: it plays in both (SweepMode owns the tick logic). If it's annoying in Screen Fill, the threshold can be increased.

2. **Volume levels:** The exact gain values (0.2 for press, 0.15 for tick, 0.3 for milestones, 0.4 for fanfare) may need tuning during testing. Consider extracting these as constants at the top of AudioManager for easy adjustment.

3. **Mute visual indicator:** Currently mute state is only logged to console. Phase 6 will add a settings panel with a mute toggle — should Phase 5 add a minimal visual indicator (e.g., a small muted-speaker icon)? Current plan: no — keep Phase 5 audio-only, Phase 6 adds UI.

---

## Task Checklist

- [ ] **Task 1:** Create `src/audio/AudioManager.js` — full implementation with all sound methods
- [ ] **Task 2:** Add `index` property to `src/switches/SwitchProfile.js` constructor  
- [ ] **Task 3:** Pass `index: 0–7` to all 8 profiles in `src/switches/SwitchManager.js`
- [ ] **Task 4:** Wire `audioManager.playPressSound()` into `src/activities/painting/PaintingActivity.js`
- [ ] **Task 5:** Wire `audioManager.playSweepTick()` into `src/activities/painting/modes/SweepMode.js` with 40px distance threshold
- [ ] **Task 6:** Wire press sound, milestone sounds, and fanfare into `src/activities/screen-fill/ScreenFillActivity.js`
- [ ] **Task 7:** Add `Ctrl+M` mute toggle shortcut to `src/main.js`
- [ ] **Task 8:** Manual QA — run through all TEST.md Phase 5 checks
- [ ] **Task 9:** Verify all Phase 1–4b regression checks still pass

---

## Files Changed Summary

| File | Action | Depends On |
|---|---|---|
| `src/audio/AudioManager.js` | **CREATE** | Nothing |
| `src/switches/SwitchProfile.js` | MODIFY (add `index` param) | Nothing |
| `src/switches/SwitchManager.js` | MODIFY (pass `index` values) | SwitchProfile change |
| `src/activities/painting/PaintingActivity.js` | MODIFY (import + 1 call) | AudioManager |
| `src/activities/painting/modes/SweepMode.js` | MODIFY (import + tick logic) | AudioManager |
| `src/activities/screen-fill/ScreenFillActivity.js` | MODIFY (import + press/milestone/fanfare) | AudioManager |
| `src/main.js` | MODIFY (import + Ctrl+M handler) | AudioManager |
