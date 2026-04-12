import { SolidCircle } from './SolidCircle.js';
import { SoftBrush } from './SoftBrush.js';
import { SmokeEffect } from './SmokeEffect.js';
import { StarburstEffect } from './StarburstEffect.js';

const EFFECT_TYPES = {
  solid: SolidCircle,
  brush: SoftBrush,
  smoke: SmokeEffect,
  starburst: StarburstEffect,
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
