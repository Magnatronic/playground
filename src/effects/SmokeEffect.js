import { Container, Graphics, Ticker } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

export class SmokeEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 20, opacity = 0.6, impactMultiplier = 1 } = options;

    const particleCount = 10 + Math.floor(Math.random() * 6);
    const group = new Container();
    container.addChild(group);

    for (let i = 0; i < particleCount; i++) {
      const particle = new Graphics();
      const radius = (size * 0.35 + Math.random() * size * 0.45) * Math.max(0.5, impactMultiplier);
      particle.circle(0, 0, radius);
      particle.fill(hexToNumber(colour));

      const startAlpha = opacity * (0.2 + Math.random() * 0.45);
      particle.alpha = startAlpha;
      particle.position.set(
        x + (Math.random() - 0.5) * size * 1.5,
        y + (Math.random() - 0.5) * size * 1.2
      );

      // Drift mostly upward with slight outward spread.
      particle._vx = (Math.random() - 0.5) * (1.2 + impactMultiplier * 0.5);
      particle._vy = -(0.5 + Math.random() * (1.0 + impactMultiplier * 0.5));
      particle._life = 1000 + Math.random() * 1000;
      particle._born = performance.now();
      particle._startAlpha = startAlpha;

      group.addChild(particle);
    }

    const tick = () => {
      const now = performance.now();
      let alive = false;

      for (const particle of group.children) {
        const age = now - particle._born;
        const progress = Math.min(age / particle._life, 1);

        particle.alpha = particle._startAlpha * (1 - progress);
        particle.x += particle._vx;
        particle.y += particle._vy;
        particle.scale.set(1 + progress * 0.55);

        if (progress < 1) {
          alive = true;
        }
      }

      if (!alive) {
        Ticker.shared.remove(tick);
        if (group.parent) {
          group.parent.removeChild(group);
        }
        group.destroy({ children: true });
      }
    };

    Ticker.shared.add(tick);
  }
}
