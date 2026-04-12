export class SwitchProfile {
  constructor({ key, label, colour, impactMultiplier = 1.0, index = 0 }) {
    this.key = key;
    this.label = label;
    this.colour = colour;
    this.impactMultiplier = impactMultiplier;
    this.index = index;
  }
}
