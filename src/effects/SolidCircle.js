import { Graphics } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';
import { hexToNumber } from '../utils/colour.js';

export class SolidCircle extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 30, opacity = 1, impactMultiplier = 1 } = options;
    const radius = size * impactMultiplier;

    const circle = new Graphics();
    circle.circle(0, 0, radius);
    circle.fill(hexToNumber(colour));
    circle.position.set(x, y);
    circle.alpha = opacity;

    container.addChild(circle);
    this.fadeAndRemove(circle, 1000);
  }
}
