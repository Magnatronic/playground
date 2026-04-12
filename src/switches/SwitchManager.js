import { SwitchProfile } from './SwitchProfile.js';

export class SwitchManager {
  constructor() {
    this.profiles = this._createDefaultProfiles();
  }

  _createDefaultProfiles() {
    return new Map([
      ['Space', new SwitchProfile({ key: 'Space', label: 'Space', colour: '#3366FF', index: 0 })],
      ['Enter', new SwitchProfile({ key: 'Enter', label: 'Enter', colour: '#00CC66', index: 1 })],
      ['ArrowUp', new SwitchProfile({ key: 'ArrowUp', label: '↑', colour: '#CCCC00', index: 2 })],
      ['ArrowDown', new SwitchProfile({ key: 'ArrowDown', label: '↓', colour: '#FF8800', index: 3 })],
      ['ArrowLeft', new SwitchProfile({ key: 'ArrowLeft', label: '←', colour: '#CC33CC', index: 4 })],
      ['ArrowRight', new SwitchProfile({ key: 'ArrowRight', label: '→', colour: '#EE1166', index: 5 })],
      ['F7', new SwitchProfile({ key: 'F7', label: 'F7', colour: '#9933CC', index: 6 })],
      ['F8', new SwitchProfile({ key: 'F8', label: 'F8', colour: '#00CCCC', index: 7 })],
    ]);
  }

  resetProfiles() {
    this.profiles = this._createDefaultProfiles();
  }

  getProfile(code) {
    return this.profiles.get(code) || null;
  }

  getAllProfiles() {
    return Array.from(this.profiles.values());
  }

  isSwitch(code) {
    return this.profiles.has(code);
  }

  updateProfile(key, changes) {
    const profile = this.profiles.get(key);
    if (!profile) return;
    if (changes.colour !== undefined) profile.colour = changes.colour;
    if (changes.impactMultiplier !== undefined) profile.impactMultiplier = changes.impactMultiplier;
  }
}
