
# Playground – Web App Specification

> This document defines the requirements for Playground.  
> For implementation details and phased build plan, see PLAN.md.

---

## 1. Overview

Playground is a browser-based, accessibility-first web application designed for students with physical and learning disabilities.

It supports Bluetooth switch inputs (mapped to keyboard keys) and enables inclusive, collaborative, and creative interaction.

- Hosted via GitHub Pages
- Runs entirely client-side
- No backend required
- Single shared screen (projector, TV, or interactive whiteboard)
- Teacher operates the host device; students interact via switches only

---

## 2. Core Design Principles

- Accessibility-first
- Supports up to 8 simultaneous inputs
- No penalties for slow interaction
- Immediate visual feedback
- Low cognitive load
- Modular activity system
- Inclusive by design (adaptive per user)
- Flexible input handling per activity

---

## 3. Input System

### 3.1 Key Mapping

Each switch maps to a keyboard key.

Supported keys:
- Space, Enter
- Arrow keys
- Function keys (F7, F8)

---

### 3.2 Core Input System

The system must:

- Listen to `keydown` and `keyup`
- Track key states (pressed / released)
- Detect:
  - Initial press
  - Hold state
  - Release
- Support multiple simultaneous inputs

The system must NOT:

- Apply global debounce
- Block key repeat globally

---

### 3.3 Activity-Level Input Control

Each activity defines how input behaves.

Possible behaviors:
- Debounce (cooldown)
- Hold-to-repeat
- Single press only
- Rapid input

---

## 4. Switch Profiles

Each switch includes:

- Key binding
- Colour
- Impact multiplier (default: 1.0)

Profiles:
- Defined at startup with sensible defaults
- Editable in settings
- Reset each session (no persistence between sessions)

---

## 5. App Structure

### 5.1 Main Page

- Single-page application
- Activity selection menu
- Large, simple UI
- Minimal text
- Activities load dynamically

---

## 6. Activity: Collaborative Painting

### 6.1 Description

Students press switches to create visual effects on a shared canvas.

---

### 6.2 Modes

#### Random
- Paint appears at random positions

#### Cursor
- Teacher controls the mouse/touch cursor position
- Students press switches to paint at the current cursor location

#### Sweep
- Cursor moves continuously
- Pressing paints at cursor

---

### 6.3 Sweep Settings

- Speed (adjustable)
- Pattern:
  - Horizontal
  - Vertical
  - Bounce (diagonal, bouncing off edges)
  - Systematic (row-by-row zigzag covering the screen)

---

### 6.4 Effects (Global)

- Solid circle
- Soft brush
- Smoke / particles
- Starburst

---

### 6.5 Per-Switch Variation

Each switch can modify:
- Size
- Intensity

Effect type is global.

---

### 6.6 Effect Settings

- Size
- Opacity
- Scatter
- Motion
- Fade over time

---

### 6.7 Assist Scaling

Each switch has an impact multiplier.

Purpose:
- Balance interaction across ability levels

---

## 7. Activity: Screen Fill Challenge

### 7.1 Description

Fill the entire screen collaboratively.

---

### 7.2 Rules

- Target = 100% coverage
- Uses painting system

---

### 7.3 Position Modes

#### Random Fill
- Paint appears randomly
- Biased toward unfilled areas

#### Cursor Fill
- Teacher controls mouse/touch cursor position
- Students press switches to paint at cursor location

#### Sweep Fill
- Cursor moves
- Players must time presses

---

### 7.4 Timer

- Optional
- Counts up
- Used for best times
- No failure state

---

### 7.5 Feedback

- Visual progress indicator
- Completion celebration

---

### 7.6 Fill Modes

Two visual modes that change how the screen is filled:

#### Standard
- Freeform stamps on canvas (default)
- Configurable stamp size (affects fill speed / session pacing)
  - Configurable stamp shape: circle, square, triangle, rectangle, diamond, pentagon, hexagon, star, parallelogram, trapezoid
- Shape assignment options:
  - Per-switch (each switch uses a different shape)
  - Global (teacher picks one shape for all)
  - Random (each press picks a random shape)
- Stamp size adjustable via +/- keys (10–80px range, 10px steps)
- Stamp shape library extensible for future additions

#### Mosaic Tiles
- Screen divided into a tile grid
- Press fills the nearest unfilled tile with switch colour
- Pop animation on fill
- Tile patterns:
  - Squares (regular grid)
  - Hexagons (honeycomb)
  - Triangles (tessellating)
  - Bricks (offset rows)

---

## 8. Settings System

Accessible anytime via settings panel overlay or keyboard shortcuts:

- Switch profiles (colour, impact multiplier)
- Effect type selector (global)
- Effect settings (size, opacity, scatter)
- Sweep settings (speed, pattern)
- Mode selector for current activity
- Toggle sound

Keyboard shortcuts:
- `Escape` — toggle settings panel / return to menu
- `Ctrl+R` — reset/clear canvas
- `Ctrl+M` — mute toggle

All controls must be touch-friendly for iPad/whiteboard use (large tap targets, no hover-only interactions).

Settings reset each session — no persistence between sessions.

---

## 9. Sound

- Procedural audio via Web Audio API (no sound files)
- Paint press sound: pentatonic-pitched sine tone per switch (C5-E6 scale mapped to switch index 0-7)
- Completion fanfare: dramatic ascending arpeggio with sustained chord (~1.8s)
- Mute toggle via Ctrl+M (session only, resets to unmuted on reload)
- Lazy AudioContext init on first user gesture (browser autoplay policy)
- Conservative volumes to support 8 simultaneous inputs without clipping

---

## 10. Performance

- Must run on low-spec hardware
- Target ~60fps
- Use WebGL (via PixiJS)

---

## 11. Tech Stack

- HTML5, CSS, JavaScript (vanilla)
- PixiJS v8 (WebGL 2D renderer)
- Manual particle systems (PixiJS Graphics + Ticker)
- Vite (build tooling, dev server)
- Web Audio API (native, no library)
- Deployed to GitHub Pages

---

## 12. Target Devices

- Laptop + projector
- Interactive whiteboard
- iPad / tablet (Safari)

---

## 13. Constraints

The system MUST:

- Work with very slow input (10+ seconds)
- Work with rapid input
- Never penalize slow users
- Always give immediate feedback
- Allow per-activity input behavior

---

## 14. Success Criteria

- Clear cause-and-effect
- Multi-user interaction
- Engaging but not overwhelming
- Easy for staff to use

---

## 15. Future Extensions

- Shape Targets / Mystery Paint (separate app): paint inside silhouettes (colouring) or reveal hidden pictures (mystery mode)
- MIDI input
- Music interactions
- Rhythm games
- Audio-visual feedback

---