import { Container, Sprite, Texture, Graphics, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

// Cache splat textures by colour+size
const splatTextureCache = new Map();

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function createSplatTexture(colour, diameter) {
  const key = `${colour}-${diameter}`;
  if (splatTextureCache.has(key)) return splatTextureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d');
  const cx = diameter / 2;
  const cy = diameter / 2;
  const baseRadius = diameter * 0.4;
  const { r, g, b } = hexToRgb(colour);

  // draw irregular central blob using radial jitter
  ctx.beginPath();
  const points = 12;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = (Math.random() * 0.4 + 0.8); // 0.8 - 1.2
    const rad = baseRadius * jitter;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // fill with soft gradient
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.2);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, 0.85)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Add a few random droplet stains onto the texture for depth
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const dist = baseRadius * (0.6 + Math.random() * 0.9);
    const dx = cx + Math.cos(a) * dist;
    const dy = cy + Math.sin(a) * dist;
    const rr = Math.max(1, Math.round(diameter * (0.02 + Math.random() * 0.06)));
    ctx.beginPath();
    ctx.arc(dx, dy, rr, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.9 - Math.random() * 0.6})`;
    ctx.fill();
  }

  const texture = Texture.from(canvas);
  splatTextureCache.set(key, texture);
  return texture;
}

export class SplatEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 40, opacity = 0.95, impactMultiplier = 1 } = options;
    const diameter = Math.round(size * impactMultiplier * 2.4);

    const spriteTex = createSplatTexture(colour, diameter);
    const sprite = new Sprite(spriteTex);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = opacity;
    container.addChild(sprite);

    // Small radial droplets as Graphics moving outward
    const dropletGroup = new Container();
    container.addChild(dropletGroup);

    const dropletCount = 6 + Math.floor(Math.random() * 6);
    for (let i = 0; i < dropletCount; i++) {
      const g = new Graphics();
      const rr = (Math.random() * 0.4 + 0.15) * size * 0.5 * Math.max(0.4, impactMultiplier);
      g.beginFill(hexToNumber(colour));
      g.drawCircle(0, 0, rr);
      g.endFill();
      g.alpha = 0.9;
      g.x = x + (Math.random() - 0.5) * size * 0.2;
      g.y = y + (Math.random() - 0.5) * size * 0.2;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * (size * 0.06);
      g._vx = Math.cos(angle) * speed;
      g._vy = Math.sin(angle) * speed;
      g._born = performance.now();
      g._life = 600 + Math.random() * 600;

      dropletGroup.addChild(g);
    }

    // Animate droplets and remove when finished
    const tick = () => {
      const now = performance.now();
      let alive = false;
      for (const d of dropletGroup.children) {
        const age = now - d._born;
        const progress = Math.min(age / d._life, 1);
        d.alpha = 0.9 * (1 - progress);
        d.x += d._vx;
        d.y += d._vy;
        d.scale.set(1 - progress * 0.5);
        if (progress < 1) alive = true;
      }
      if (!alive) {
        Ticker.shared.remove(tick);
        if (dropletGroup.parent) dropletGroup.parent.removeChild(dropletGroup);
        dropletGroup.destroy({ children: true });
      }
    };

    Ticker.shared.add(tick);

    // Fade and remove the main sprite
    this.fadeAndRemove(sprite, 1200);
  }
}
