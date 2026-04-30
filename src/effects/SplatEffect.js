import { Container, Sprite, Graphics, Ticker, Texture } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';
import { createSplatCanvas } from './splatGenerator.js';

export class SplatEffect extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 40, opacity = 0.95, impactMultiplier = 1 } = options;
    // blobDiameter is the central blob — canvas will be 5× this internally
    const diameter = Math.round(size * impactMultiplier * 1.2);

    // Don't cache — each splat should look unique (generator uses Math.random)
    const canvas = createSplatCanvas(colour, diameter);
    const sprite = new Sprite(Texture.from(canvas));
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = opacity;
    container.addChild(sprite);

    // transient droplets animation on top
    const dropletGroup = new Container();
    container.addChild(dropletGroup);

    const dropletCount = 6 + Math.floor(Math.random() * 10);
    for (let i = 0; i < dropletCount; i++) {
      const g = new Graphics();
      const rr = (Math.random() * 0.4 + 0.12) * size * 0.6 * Math.max(0.4, impactMultiplier);
      g.circle(0, 0, rr);
      g.fill(hexToNumber(colour));
      g.alpha = 0.95;
      g.x = x + (Math.random() - 0.5) * size * 0.25;
      g.y = y + (Math.random() - 0.5) * size * 0.25;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * (size * 0.08);
      g._vx = Math.cos(angle) * speed;
      g._vy = Math.sin(angle) * speed;
      g._born = performance.now();
      g._life = 500 + Math.random() * 900;

      dropletGroup.addChild(g);
    }

    const tick = () => {
      const now = performance.now();
      let alive = false;
      for (const d of dropletGroup.children) {
        const age = now - d._born;
        const progress = Math.min(age / d._life, 1);
        d.alpha = 0.95 * (1 - progress);
        d.x += d._vx;
        d.y += d._vy;
        d.scale.set(1 - progress * 0.6);
        if (progress < 1) alive = true;
      }
      if (!alive) {
        Ticker.shared.remove(tick);
        if (dropletGroup.parent) dropletGroup.parent.removeChild(dropletGroup);
        dropletGroup.destroy({ children: true });
      }
    };

    Ticker.shared.add(tick);

    this.fadeAndRemove(sprite, 1200);
  }
}
