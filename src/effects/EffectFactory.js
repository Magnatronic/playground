import { SolidCircle } from './SolidCircle.js';
import { SoftBrush } from './SoftBrush.js';
import { SmokeEffect } from './SmokeEffect.js';
import { StarburstEffect } from './StarburstEffect.js';
import { SplatEffect } from './SplatEffect.js';
import { MistEffect } from './MistEffect.js';

const EFFECT_TYPES = {
  solid: SolidCircle,
  brush: SoftBrush,
  smoke: SmokeEffect,
  firework: StarburstEffect,
  splat: SplatEffect,
  mist: MistEffect,
};

export function createEffect(type) {
  const EffectClass = EFFECT_TYPES[type];
  if (!EffectClass) {
    throw new Error(`Unknown effect type: ${type}`);
  }
  return new EffectClass();
}

export function getEffectTypes() {
  return Object.keys(EFFECT_TYPES);
}
