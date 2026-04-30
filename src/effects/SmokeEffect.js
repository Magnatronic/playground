import { Container, Sprite, Texture, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';

// Cache soft radial-gradient textures by diameter
const puffTextureCache = new Map();

function hexToRgb(hex) {
  const h = (hex || '#ffffff').replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/**
 * Creates a soft, slightly irregular radial-gradient canvas for one smoke puff.
 * Using canvas blur for the feathered edge avoids PixiJS Graphics' hard circle outline.
 */
function createPuffTexture(colour, diameter) {
  const key = `${colour}-${diameter}`;
  if (puffTextureCache.has(key)) return puffTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d');
  const { r, g, b } = hexToRgb(colour);
  const cx = diameter / 2;
  const cy = diameter / 2;
  const radius = diameter / 2;

  // Outer glow (very soft)
  ctx.save();
  ctx.filter = `blur(${Math.round(radius * 0.35)}px)`;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.85);
  grad.addColorStop(0,    `rgba(${r},${g},${b},1.0)`);
  grad.addColorStop(0.45, `rgba(${r},${g},${b},0.72)`);
  grad.addColorStop(0.80, `rgba(${r},${g},${b},0.25)`);
  grad.addColorStop(1,    `rgba(${r},${g},${b},0.00)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, diameter, diameter);
  ctx.restore();

  const tex = Texture.from(canvas);
  puffTextureCache.set(key, tex);
  return tex;
}

export class SmokeEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 20, opacity = 0.65, impactMultiplier = 1 } = options;
    const scale = Math.max(0.5, impactMultiplier);

    const group = new Container();
    container.addChild(group);

    // Emit several puffs at staggered delays so they don't all appear at once
    const puffCount = 5 + Math.floor(Math.random() * 5);
    const puffs = [];

    for (let i = 0; i < puffCount; i++) {
      const diameter = Math.round((size * 1.0 + Math.random() * size * 1.2) * scale * 2);
      const tex = createPuffTexture(colour, diameter);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);

      // Stagger spawn: puffs born at slightly different times
      const delay = i * (80 + Math.random() * 60); // ms
      sprite.position.set(
        x + (Math.random() - 0.5) * size * 0.8 * scale,
        y + (Math.random() - 0.5) * size * 0.5 * scale
      );
      sprite.alpha = 0; // start invisible, fade in
      sprite.scale.set(0.3 + Math.random() * 0.3);

      // Drift: mostly upward, slight horizontal wander
      sprite._vx    = (Math.random() - 0.5) * 0.9 * scale;
      sprite._vy    = -(0.6 + Math.random() * 1.2) * scale;
      sprite._rot   = (Math.random() - 0.5) * 0.008; // slow rotation
      sprite._born  = performance.now() + delay;       // delayed born
      sprite._life  = 1400 + Math.random() * 1000;
      sprite._peak  = opacity * (0.28 + Math.random() * 0.38); // max alpha
      sprite._scaleEnd = 1.3 + Math.random() * 1.1;           // grow as it rises

      puffs.push(sprite);
      group.addChild(sprite);
    }

    const tick = () => {
      const now = performance.now();
      let alive = false;

      for (const p of puffs) {
        const age = now - p._born;
        if (age < 0) { alive = true; continue; } // not yet spawned

        const progress = Math.min(age / p._life, 1);

        // Alpha: ease-in then ease-out (smoke billows then dissipates)
        const fadeIn  = Math.min(age / 220, 1);
        const fadeOut = 1 - progress;
        p.alpha = p._peak * fadeIn * fadeOut;

        // Drift and grow
        p.x += p._vx;
        p.y += p._vy;
        p.rotation += p._rot;
        p.scale.set(0.3 + (p._scaleEnd - 0.3) * easeOut(progress));

        // Turbulence: add slight wavering to x
        p._vx += (Math.random() - 0.5) * 0.04 * Math.max(0.5, impactMultiplier);

        if (progress < 1) alive = true;
      }

      if (!alive) {
        Ticker.shared.remove(tick);
        if (group.parent) group.parent.removeChild(group);
        group.destroy({ children: true });
      }
    };

    Ticker.shared.add(tick);
  }
}

function easeOut(t) {
  return 1 - Math.pow(1 - t, 2);
}
