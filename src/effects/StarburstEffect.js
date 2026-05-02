import { Container, Graphics, Sprite, Texture, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

// ── Burst streak texture (soft multi-pass glow, stroke-based, no fillRect) ───
const streakTexCache = new Map();
if (import.meta.hot) import.meta.hot.accept(() => streakTexCache.clear());

function hexToRgb(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Creates a soft glowing streak texture using canvas strokes.
 * Using stroke + lineCap:'round' gives natural soft edges without fillRect clipping.
 */
function getBurstStreakTex(colour, len, w) {
  const key = `${colour}-${Math.round(len)}-${Math.round(w)}`;
  if (streakTexCache.has(key)) return streakTexCache.get(key);

  const pad = Math.ceil(w * 5);   // tail-end blur overflow room
  const cw  = Math.ceil(len + pad);
  const ch  = Math.ceil(w * 10); // tall so vertical blur doesn't clip
  const canvas = document.createElement('canvas');
  canvas.width  = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  const cy = ch / 2;
  const { r, g, b } = hexToRgb(colour);

  const drawPass = (lw, blur, aHead) => {
    ctx.save();
    if (blur > 0) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    const gr = ctx.createLinearGradient(0, 0, len, 0);
    gr.addColorStop(0,    `rgba(255,255,255,0)`);                                    // transparent at burst centre
    gr.addColorStop(0.07, `rgba(255,255,255,${aHead.toFixed(2)})`);                  // peak near inner end
    gr.addColorStop(0.2,  `rgba(${r},${g},${b},${(aHead * 0.92).toFixed(2)})`);
    gr.addColorStop(1,    `rgba(${r},${g},${b},0)`);
    ctx.strokeStyle = gr;
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(1, cy);
    ctx.lineTo(len, cy);
    ctx.stroke();
    ctx.restore();
  };

  drawPass(w * 7,   Math.max(2, w * 2.2), 0.25); // wide outer glow
  drawPass(w * 2.2, Math.max(1, w * 0.8), 0.65); // mid layer
  drawPass(w * 0.5, 0,                    1.00); // bright core
  const tex = Texture.from(canvas);
  streakTexCache.set(key, tex);
  return tex;
}

export class StarburstEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 20, opacity = 0.95, impactMultiplier = 1, onBurstStart = null } = options;
    const sc       = Math.max(0.6, impactMultiplier);
    const colorNum = hexToNumber(colour);
    const group    = new Container();
    container.addChild(group);

    // ── Phase 1: rocket launch ──────────────────────────────────────────────
    const burstX     = x;
    const burstY     = y - size * sc * 2.0;
    const launchMs   = 280 + Math.random() * 180;
    const maxW       = Math.max(2, size * sc * 0.18);

    // Rocket head — small bright dot
    const rocket = new Graphics();
    rocket.circle(0, 0, Math.max(1.5, size * sc * 0.10));
    rocket.fill(0xffffff);
    rocket.position.set(x, y);
    rocket.alpha = opacity;
    group.addChild(rocket);

    // Trail drawn as a smooth continuous Graphics line — redraw each tick.
    // This avoids sprite-blob artefacts, wrong rotation, and solid edges entirely.
    const trail      = new Graphics();
    const posHistory = [{ x, y }];
    const maxPts     = 30;
    group.addChild(trail);

    let phase2Started = false;
    const launchStart = performance.now();

    const launchTick = () => {
      const now  = performance.now();
      const t    = Math.min((now - launchStart) / launchMs, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      rocket.x = x  + (burstX - x) * ease;
      rocket.y = y  + (burstY - y) * ease;

      posHistory.push({ x: rocket.x, y: rocket.y });
      if (posHistory.length > maxPts) posHistory.shift();

      // Redraw the full trail from positions — 3 passes: glow, mid, core
      trail.clear();
      const n = posHistory.length;
      if (n >= 2) {
        for (let pass = 0; pass < 3; pass++) {
          for (let i = 1; i < n; i++) {
            // p=0 at oldest tail, p=1 at newest head (rocket tip)
            const p    = i / (n - 1);
            const prev = posHistory[i - 1];
            const curr = posHistory[i];
            trail.moveTo(prev.x, prev.y);
            trail.lineTo(curr.x, curr.y);
            if (pass === 0) {
              // Wide outer glow
              trail.stroke({ color: colorNum, alpha: p * opacity * 0.18, width: maxW * 5 * p });
            } else if (pass === 1) {
              // Mid layer
              trail.stroke({ color: colorNum, alpha: p * opacity * 0.55, width: maxW * 1.8 * p });
            } else {
              // Bright white core
              trail.stroke({ color: 0xffffff, alpha: p * opacity * 0.95, width: maxW * 0.45 * p });
            }
          }
        }
      }

      if (t >= 1 && !phase2Started) {
        phase2Started = true;
        Ticker.shared.remove(launchTick);
        if (rocket.parent) rocket.parent.removeChild(rocket);
        rocket.destroy();
        if (trail.parent)  trail.parent.removeChild(trail);
        trail.destroy();
        if (typeof onBurstStart === 'function') {
          onBurstStart({ burstX, burstY });
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
      const burstTex    = getBurstStreakTex(colour, Math.round(streakLen), streakW);
      const burstMs     = 700 + Math.random() * 400;

      const streaks = [];
      const flash = new Graphics();
      flash.circle(0, 0, size * sc * 0.55);
      flash.fill(0xffffff);
      flash.position.set(bx, by);
      flash.alpha = opacity * 0.9;
      group.addChild(flash);

      for (let i = 0; i < streakCount; i++) {
        const angle = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const speed = size * sc * (0.055 + Math.random() * 0.055);
        const s = new Sprite(burstTex);
        s.anchor.set(0, 0.5); // bright left end at burst centre
        s.position.set(bx, by);
        s.rotation = angle;
        s.alpha    = opacity;
        s._vx  = Math.cos(angle) * speed;
        s._vy  = Math.sin(angle) * speed;
        s._born = performance.now();
        group.addChild(s);
        streaks.push(s);
      }

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

        flash.alpha = opacity * 0.9 * Math.max(0, 1 - t * 6);

        for (const s of streaks) {
          s.x    += s._vx;
          s.y    += s._vy;
          s._vy  += 0.04 * sc; // gravity droop
          s._vx  *= 0.978;
          s._vy  *= 0.978;
          s.alpha = opacity * (1 - t * t);
        }

        for (const e of embers) {
          const age = now - e._born;
          const ep  = Math.min(age / e._life, 1);
          e.alpha = opacity * (1 - ep);
          e.x    += e._vx;
          e.y    += e._vy;
          e._vy  += 0.06 * sc;
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

