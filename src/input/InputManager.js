const MAPPED_KEYS = new Set([
  'Space',
  'Enter',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'F7',
  'F8',
]);

export class InputManager {
  constructor() {
    this.keyStates = new Map();
    this.onKeyAction = null;
    this._enabled = true;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
  }

  getOrCreateState(code) {
    let state = this.keyStates.get(code);

    if (!state) {
      state = {
        pressed: false,
        justPressed: false,
        justReleased: false,
      };

      this.keyStates.set(code, state);
    }

    return state;
  }

  handleKeyDown(event) {
    const code = event.code;

    if (MAPPED_KEYS.has(code)) {
      event.preventDefault();
    }

    const state = this.getOrCreateState(code);

    if (!state.pressed) {
      state.pressed = true;
      state.justPressed = true;

      if (this._enabled && typeof this.onKeyAction === 'function') {
        this.onKeyAction(code, 'press');
      }
      return;
    }

    state.pressed = true;
  }

  handleKeyUp(event) {
    const code = event.code;
    const state = this.getOrCreateState(code);

    state.pressed = false;
    state.justReleased = true;

    if (this._enabled && typeof this.onKeyAction === 'function') {
      this.onKeyAction(code, 'release');
    }
  }

  update() {
    for (const state of this.keyStates.values()) {
      state.justPressed = false;
      state.justReleased = false;
    }
  }

  isPressed(code) {
    return this.keyStates.get(code)?.pressed === true;
  }

  isJustPressed(code) {
    return this.keyStates.get(code)?.justPressed === true;
  }

  isJustReleased(code) {
    return this.keyStates.get(code)?.justReleased === true;
  }

  getActiveKeys() {
    const active = [];

    for (const [code, state] of this.keyStates.entries()) {
      if (state.pressed) {
        active.push(code);
      }
    }

    return active;
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }
}
