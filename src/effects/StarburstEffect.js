import { Container, Graphics, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

export class StarburstEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 20, opacity = 0.9, impactMultiplier = 1 } = options;
    const particleCount = Math.round(16 * impactMultiplier);
    const group = new Container();
    container.addChild(group);

    for (let i = 0; i < particleCount; i++) {
      const p = new Graphics();
      const radius = (size * 0.2 + Math.random() * size * 0.3) * impactMultiplier;
      p.circle(0, 0, radius);
      p.fill(hexToNumber(colour));
      p.alpha = opacity;
      p.position.set(x, y);

      // Radial velocity: shoot outward in all directions
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.3;
      const speed = 2 + Math.random() * 4;
      p._vx = Math.cos(angle) * speed;
      p._vy = Math.sin(angle) * speed;
      p._life = 600 + Math.random() * 600; // 0.6-1.2 seconds (faster than smoke)
      p._born = performance.now();

      group.addChild(p);
    }

    const tick = () => {
      const now = performance.now();
      let alive = false;
      for (const p of group.children) {
        const age = now - p._born;
        const progress = Math.min(age / p._life, 1);
        p.alpha = opacity * (1 - progress);
        p.x += p._vx;
        p.y += p._vy;
        // Slow down over time
        p._vx *= 0.98;
        p._vy *= 0.98;
        p.scale.set(1 - progress * 0.5); // shrink as they fly out
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
