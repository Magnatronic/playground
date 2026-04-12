export class BaseActivity {
  constructor() {
    this.app = null;
  }

  /**
   * Initialize the activity with the PixiJS app.
   * @param {Application} pixiApp
   */
  init(pixiApp) {
    this.app = pixiApp;
  }

  /**
   * Called each frame.
   * @param {number} delta - frame delta from ticker
   */
  update(delta) {}

  /**
   * Handle a switch input event.
   * @param {SwitchProfile} switchProfile
   * @param {string} eventType - 'press' or 'release'
   */
  handleInput(switchProfile, eventType) {}

  /**
   * Return input behavior config for this activity.
   * @returns {Object} e.g. { debounce: 150 }
   */
  getInputConfig() {
    return {};
  }

  /**
   * Cleanup: remove display objects, listeners, etc.
   */
  destroy() {
    this.app = null;
  }
}
