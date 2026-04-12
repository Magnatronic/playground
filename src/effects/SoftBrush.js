import { Sprite, Texture } from 'pixi.js';
import { BaseEffect } from './BaseEffect.js';

// Cache generated textures by colour+size to avoid recreating them
const textureCache = new Map();

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

function createGradientTexture(colour, diameter) {
  const key = `${colour}-${diameter}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d');
  const radius = diameter / 2;
  const { r, g, b } = hexToRgb(colour);

  const gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
  gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.5)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, diameter, diameter);

  const texture = Texture.from(canvas);
  textureCache.set(key, texture);
  return texture;
}

export class SoftBrush extends BaseEffect {
  createEffect(container, options) {
    const { x, y, colour, size = 40, opacity = 0.8, impactMultiplier = 1 } = options;
    const diameter = Math.round(size * impactMultiplier * 2);

    const texture = createGradientTexture(colour, diameter);
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.alpha = opacity;

    container.addChild(sprite);
    this.fadeAndRemove(sprite, 1500);
  }
}
