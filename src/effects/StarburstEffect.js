import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

// Build a short glowing streak texture for trail particles
const trailTextureCache = new Map();
function getTrailTexture(colour, len, w) {
  const key = `${colour}-${len}-${w}`;
  if (trailTextureCache.has(key)) return trailTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width  = len;
  canvas.height = w * 2;
  const ctx = canvas.getContext('2d');
  const cx = canvas.height / 2;
  const g = ctx.createLinearGradient(0, 0, len, 0);

  const hex = (colour || '#ffffff').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const cg = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  g.addColorStop(0,    `rgba(255,255,255,0.95)`);
  g.addColorStop(0.15, `rgba(${r},${cg},${b},0.9)`);
  g.addColorStop(1,    `rgba(${r},${cg},${b},0)`);
  ctx.save();
  ctx.filter = `blur(${Math.max(1, Math.round(w * 0.6))}px)`;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, len, canvas.height);
  ctx.restore();

  const tex = Texture.from(canvas);
  trailTextureCache.set(key, tex);
  return tex;
}

export class StarburstEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 20, opacity = 0.95, impactMultiplier = 1 } = options;
    const sc = Math.max(0.6, impactMultiplier);
    const colorNum = hexToNumber(colour);
    const group = new Container();
    container.addChild(group);

    // ── Phase 1: rocket launch ──────────────────────────────────────────────
    // The rocket flies upward for ~400 ms, leaving a bright streak.
    const launchDist = size * sc * 2.5 + Math.random() * size * sc;
    const burstX     = x + (Math.random() - 0.5) * size * sc * 0.6;
    const burstY     = y - launchDist;
    const launchMs   = 280 + Math.random() * 180;

    // Rocket head — small bright dot
    const rocket = new Graphics();
    rocket.circle(0, 0, Math.max(1.5, size * sc * 0.08));
    rocket.fill(0xffffff);
    rocket.position.set(x, y);
    rocket.alpha = opacity;
    group.addChild(rocket);

    // Trail sprites accumulated in an array
    const trailSprites = [];
    const trailTex = getTrailTexture(colour, Math.round(size * sc * 1.8), Math.max(2, size * sc * 0.12));

    // Phase 2 state — populated when rocket arrives
    let phase2Started = false;

    // Ticker for rocket phase
    const launchStart = performance.now();
    const launchTick = () => {
      const now = performance.now();
      const t   = Math.min((now - launchStart) / launchMs, 1);
      // Ease in-out upward
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      rocket.x = x  + (burstX - x)  * ease;
      rocket.y = y  + (burstY - y)  * ease;

      // Spawn trail particle every few ticks
      if (Math.random() < 0.55) {
        const ts = new Sprite(trailTex);
        ts.anchor.set(1, 0.5); // tip of trail follows rocket
        ts.position.set(rocket.x, rocket.y);
        // Rotate trail to point downward (away from direction of travel)
        ts.rotation = Math.PI / 2 + Math.PI / 2; // point down (angle = π)
        ts.alpha    = opacity * 0.7;
        ts._born    = now;
        ts._life    = 200 + Math.random() * 180;
        group.addChild(ts);
        trailSprites.push(ts);
      }

      // Age out old trail particles
      for (const ts of trailSprites) {
        const age = now - ts._born;
        ts.alpha = opacity * 0.7 * Math.max(0, 1 - age / ts._life);
      }

      if (t >= 1 && !phase2Started) {
        phase2Started = true;
        Ticker.shared.remove(launchTick);
        // Remove rocket and trail
        if (rocket.parent) rocket.parent.removeChild(rocket);
        rocket.destroy();
        for (const ts of trailSprites) {
          if (ts.parent) ts.parent.removeChild(ts);
          ts.destroy();
        }
        startBurst(burstX, burstY);
      }
    };
    Ticker.shared.add(launchTick);

    // ── Phase 2: explosion burst ────────────────────────────────────────────
    const startBurst = (bx, by) => {
      const streakCount = Math.round((20 + Math.random() * 20) * sc);
      const streakLen   = size * sc * (1.4 + Math.random() * 1.2);
      const streakW     = Math.max(2, size * sc * 0.10);
      const burstTex    = getTrailTexture(colour, Math.round(streakLen), streakW);
      const burstMs     = 700 + Math.random() * 400;

      const streaks = [];
      const flash   = new Graphics();
      flash.circle(0, 0, size * sc * 0.55);
      flash.fill(0xffffff);
      flash.position.set(bx, by);
      flash.alpha = opacity * 0.9;
      group.addChild(flash);

      for (let i = 0; i < streakCount; i++) {
        const angle = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = size * sc * (0.055 + Math.random() * 0.055);
        const s = new Sprite(burstTex);
        s.anchor.set(0, 0.5);     // tail end anchored at burst center
        s.position.set(bx, by);
        s.rotation = angle;
        s.alpha    = opacity;
        s._vx  = Math.cos(angle) * speed;
        s._vy  = Math.sin(angle) * speed;
        s._born = performance.now();
        group.addChild(s);
        streaks.push(s);
      }

      // Small secondary sparks (embers)
      const emberCount = Math.round(30 * sc);
      const embers = [];
      for (let i = 0; i < emberCount; i++) {
        const e = new Graphics();
        const er = Math.max(0.8, size * sc * (0.02 + Math.random() * 0.04));
        e.circle(0, 0, er);
        e.fill(colorNum);
        e.position.set(bx + (Math.random() - 0.5) * 4, by + (Math.random() - 0.5) * 4);
        e.alpha = opacity;
        const ang = Math.random() * Math.PI * 2;
        const spd = size * sc * (0.03 + Math.random() * 0.07);
        e._vx   = Math.cos(ang) * spd;
        e._vy   = Math.sin(ang) * spd;
        e._born = performance.now();
        e._life = 600 + Math.random() * 600;
        group.addChild(e);
        embers.push(e);
      }

      const burstStart = performance.now();
      const burstTick = () => {
        const now = performance.now();
        const t   = Math.min((now - burstStart) / burstMs, 1);

        // Flash fades quickly
        flash.alpha = opacity * 0.9 * Math.max(0, 1 - t * 6);

        // Streaks travel outward and fade
        for (const s of streaks) {
          s.x += s._vx;
          s.y += s._vy;
          s._vy += 0.04 * sc; // gravity droop
          s._vx *= 0.978;
          s._vy *= 0.978;
          s.alpha = opacity * (1 - t * t); // quadratic fade
        }

        // Embers arc and fade
        for (const e of embers) {
          const age = now - e._born;
          const ep  = Math.min(age / e._life, 1);
          e.alpha = opacity * (1 - ep);
          e.x += e._vx;
          e.y += e._vy;
          e._vy += 0.06 * sc; // gravity
        }

        if (t >= 1) {
          Ticker.shared.remove(burstTick);
          if (group.parent) group.parent.removeChild(group);
          group.destroy({ children: true });
        }
      };
      Ticker.shared.add(burstTick);
    };
  }
}

