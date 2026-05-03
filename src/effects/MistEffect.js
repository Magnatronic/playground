import { Graphics, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

/**
 * Mist Effect — mirrors the free-play music particle style.
 * Tiny soft ellipses drift outward in all directions, then stamp
 * their colour permanently onto the paint layer when they settle.
 * Opacity controls how strongly the permanent marks show.
 */
export class MistEffect extends BaseEffect {
  createEffect(container, options) {
    const {
      x, y, colour, size = 20, opacity = 0.7,
      cloudSpread = 30, impactMultiplier = 1, paintLayer,
    } = options;

    const scale = Math.max(0.5, impactMultiplier);
    const colNum = hexToNumber(colour);
    // Size = particle count only (10→~35 particles, 80→~140 particles)
    const count = Math.round((20 + size * 1.5 + Math.random() * 10) * scale);
    // Scatter = how far particles travel before stamping (0→tight cluster, 60→wide spread)
    const travelBase = 20 + cloudSpread * 2;

    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (0.35 + Math.random() * 0.80) * scale;
      const smearAngle = Math.random() * Math.PI * 2;
      const smearDist  = 0.8 + Math.random() * 2.0;

      particles.push({
        // All particles spawn at the tap point — scatter only affects travel distance
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.05 + Math.random() * 0.12,
        wobbleAmp:   0.10 + Math.random() * 0.22,
        // Radius FIXED small — never grows with size slider
        r:       1.5 + Math.random() * Math.random() * 3.5,
        squeeze: 0.55 + Math.random() * 0.45,
        ox: Math.cos(smearAngle) * smearDist,
        oy: Math.sin(smearAngle) * smearDist,
        // Flight alpha is always vivid — opacity does NOT affect animation
        alpha:       0.45 + Math.random() * 0.40,
        travelDist:  (travelBase * (0.5 + Math.random())) * scale,
        distTravelled: 0,
        // Opacity ONLY controls permanent stamp strength
        stampAlpha:  (0.55 + Math.random() * 0.45) * opacity,
        settled: false,
      });
    }

    const gfx = new Graphics();
    container.addChild(gfx);

    const stamps = [];

    const tick = () => {
      // If the canvas was cleared, gfx has no parent — stop and don't stamp
      if (!gfx.parent) {
        Ticker.shared.remove(tick);
        return;
      }

      gfx.clear();
      let anyAlive = false;

      for (const p of particles) {
        if (p.settled) continue;

        p.wobblePhase += p.wobbleSpeed;
        const dx = p.vx + Math.sin(p.wobblePhase) * p.wobbleAmp;
        const dy = p.vy;
        p.x += dx;
        p.y += dy;
        p.distTravelled += Math.sqrt(dx * dx + dy * dy);

        const progress = Math.min(p.distTravelled / p.travelDist, 1);

        let a;
        if (progress < 0.25) {
          a = p.alpha * (progress / 0.25);
        } else if (progress < 0.65) {
          a = p.alpha;
        } else {
          a = p.alpha * (1 - (progress - 0.65) / 0.35);
        }

        if (progress >= 1) {
          p.settled = true;
          stamps.push({ sx: p.x, sy: p.y, sr: p.r, sa: p.stampAlpha });
          continue;
        }

        anyAlive = true;
        if (a <= 0.005) continue;

        // Primary soft ellipse
        gfx.ellipse(p.x, p.y, p.r, p.r * p.squeeze);
        gfx.fill({ color: colNum, alpha: a });
        // Secondary offset smear for organic feel
        gfx.ellipse(p.x + p.ox, p.y + p.oy, p.r * 0.6, p.r * 0.6 * p.squeeze);
        gfx.fill({ color: colNum, alpha: a * 0.5 });
      }

      // Flush stamps
      if (paintLayer) {
        for (const s of stamps) {
          paintLayer.stampSoft({
            x: s.sx, y: s.sy, colour,
            size: s.sr * 2.2,   // stamp slightly larger than flight dot but stays small
            opacity: s.sa,
            impactMultiplier: 1,
          });
        }
      }
      stamps.length = 0;

      if (!anyAlive) {
        Ticker.shared.remove(tick);
        if (gfx.parent) gfx.parent.removeChild(gfx);
        gfx.destroy();
      }
    };

    Ticker.shared.add(tick);
  }
}
