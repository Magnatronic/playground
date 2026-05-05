const DEFAULTS = {
  // Global
  muted: false,

  // Position Mode
  positionMode: 'random',
  sweepSpeed: 3,
  sweepPattern: 'horizontal',

  // Painting
  effectType: 'solid',
  effectSize: 30,
  effectOpacity: 0.7,
  effectScatter: 30,
  blendMode: 'normal',

  // Screen Fill
  fillMode: 'bars',
  barOrientation: 'horizontal',
  barThickness: 30,
  tilePattern: 'squares',
  tileSize: 50,

  // Switch Profiles — initialized empty, populated by AppShell from SwitchManager
  switchProfiles: [],

  // Song
  songId: 'twinkle',
  songMode: 'rhythm',
  freePlayNotes: [
    { name: 'C', freq: 261.63 },
    { name: 'D', freq: 293.66 },
    { name: 'E', freq: 329.63 },
    { name: 'F', freq: 349.23 },
    { name: 'G', freq: 392.00 },
    { name: 'A', freq: 440.00 },
  ],
  freePlayChords: false,
  freePlayOctave: 0, // -2 to +2 octave shift applied at play time

  // Music
  musicScale: 'pentatonic',
  musicInstrument: 'bells',
  musicVoiceMode: 'together',
  musicNoteLength: 'medium',
};

class AppState {
  constructor(defaults = {}) {
    this._defaults = { ...defaults };
    this._state = { ...defaults };
    this._listeners = new Map();
  }

  get(key) {
    return this._state[key];
  }

  set(key, value) {
    if (this._state[key] === value) {
      return;
    }

    this._state[key] = value;
    this._notify(key, value);
  }

  subscribe(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }

    const listeners = this._listeners.get(key);
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this._listeners.delete(key);
      }
    };
  }

  subscribeMany(keys, callback) {
    const unsubscribers = keys.map((key) => this.subscribe(key, callback));
    let isActive = true;

    return () => {
      if (!isActive) {
        return;
      }

      isActive = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }

  getAll() {
    return { ...this._state };
  }

  reset() {
    const previousState = this._state;
    const nextState = { ...this._defaults };
    this._state = nextState;

    const allKeys = new Set([
      ...Object.keys(previousState),
      ...Object.keys(nextState),
    ]);

    allKeys.forEach((key) => {
      if (previousState[key] !== nextState[key]) {
        this._notify(key, nextState[key]);
      }
    });
  }

  _notify(key, value) {
    const listeners = this._listeners.get(key);
    if (!listeners || listeners.size === 0) {
      return;
    }

    listeners.forEach((callback) => {
      callback(value, key);
    });
  }
}

export const appState = new AppState(DEFAULTS);
export { AppState };
