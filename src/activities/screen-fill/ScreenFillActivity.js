import { BaseActivity } from '../BaseActivity.js';
import { SweepMode } from '../painting/modes/SweepMode.js';
import { CursorMode } from '../painting/modes/CursorMode.js';
import { BiasedRandomMode } from './BiasedRandomMode.js';
import { BarsFillMode } from './fill-modes/BarsFillMode.js';
import { MosaicFillMode } from './fill-modes/MosaicFillMode.js';
import ProgressBar from '../../ui/ProgressBar.js';
import { Timer } from '../../ui/Timer.js';
import { Celebration } from '../../ui/Celebration.js';
import { audioManager } from '../../audio/AudioManager.js';
import { appState } from '../../app/AppState.js';

const FILL_MODE_NAMES = ['bars', 'mosaic'];

export class ScreenFillActivity extends BaseActivity {
  constructor() {
    super();

    this.fillMode = null;
    this.fillModeName = 'standard';
    this.fillModeIndex = 0;
    this.progressBar = null;
    this.timer = null;
    this.celebration = null;

    this.currentMode = null;
    this.currentModeName = 'random';
    this.sweepModeReference = null;

    this.debounceMs = 150;
    this.lastPressTime = 0;

    this.completed = false;
    this.started = false;

    this.handleResize = this.handleResize.bind(this);
    this.resizeTimeout = null;
  }

  init(pixiApp) {
    super.init(pixiApp);

    this.setFillMode('bars');
    pixiApp.stage.addChild(this.fillMode.getDisplayObject());

    const coverageGrid = this.fillMode.getCoverageGrid();
    this.currentMode = new BiasedRandomMode(coverageGrid);
    this.currentMode.init(pixiApp);

    this.sweepModeReference = new SweepMode();
    this.currentModeName = 'random';

    this.progressBar = new ProgressBar();
    this.progressBar.show();
    this.progressBar.update(0);

    this.timer = new Timer();
    this.timer.show();

    this.celebration = new Celebration();

    window.addEventListener('resize', this.handleResize);

    console.log('Screen Fill activity started');
  }

  update(delta) {
    if (this.currentMode && this.currentMode.update) {
      this.currentMode.update(delta);
    }

    if (this.fillMode) {
      this.fillMode.update(delta);
    }

    if (this.timer) {
      this.timer.update();
    }
  }

  handleInput(switchProfile, eventType) {
    if (eventType !== 'press' || this.completed) {
      return;
    }

    const now = performance.now();
    const debounce = (this.fillModeName === 'mosaic' || this.fillModeName === 'bars') ? 50 : this.debounceMs;
    if (now - this.lastPressTime < debounce) {
      return;
    }
    this.lastPressTime = now;

    if (!this.currentMode || !this.fillMode) {
      return;
    }

    if (!this.started && this.timer) {
      this.started = true;
      this.timer.start();
    }

    const pos = this.currentMode.getPosition();
    let scatter = this.currentModeName === 'sweep' ? 10 : 30;
    if (this.fillModeName === 'mosaic' || this.fillModeName === 'bars') {
      scatter = 0;
    }

    const x = pos.x + (Math.random() - 0.5) * scatter * 2;
    const y = pos.y + (Math.random() - 0.5) * scatter * 2;

    const colour = switchProfile.colour;
    const impactMultiplier = switchProfile.impactMultiplier;
    const switchIndex = switchProfile.index || 0;

    this.fillMode.stamp({
      x,
      y,
      colour,
      size: 30,
      impactMultiplier,
      switchIndex,
    });
    audioManager.playPressSound(switchIndex);

    const percentage = this.fillMode.getPercentage();
    if (this.progressBar) {
      this.progressBar.update(percentage);
    }

    if (Math.round(percentage) >= 100 && !this.completed) {
      this.completed = true;

      if (this.timer) {
        this.timer.stop();
      }

      if (this.celebration) {
        this.celebration.play(this.app, () => {});
      }

      audioManager.playFanfare();

      const elapsedMs = this.timer && this.timer.getElapsed ? this.timer.getElapsed() : 0;
      const elapsedSeconds = (elapsedMs / 1000).toFixed(2);
      console.log(`Screen Fill completed in ${elapsedSeconds}s`);
    }
  }

  setFillMode(name) {
    if (!FILL_MODE_NAMES.includes(name)) {
      console.warn(`Unknown fill mode: ${name}`);
      return;
    }

    const displayObj = this.fillMode ? this.fillMode.getDisplayObject() : null;

    if (this.fillMode) {
      if (displayObj && displayObj.parent) {
        displayObj.parent.removeChild(displayObj);
      }
      this.fillMode.destroy();
      this.fillMode = null;
    }

    if (name === 'bars') {
      this.fillMode = new BarsFillMode();
      this.fillMode.init(this.app, {
        barThickness: appState.get('barThickness'),
        orientation: appState.get('barOrientation'),
      });
    } else {
      this.fillMode = new MosaicFillMode();
      this.fillMode.init(this.app, {
        tileSize: appState.get('tileSize'),
        patternName: appState.get('tilePattern'),
      });
    }

    this.fillModeName = name;
    this.fillModeIndex = FILL_MODE_NAMES.indexOf(name);

    if (this.app) {
      this.app.stage.addChildAt(this.fillMode.getDisplayObject(), 0);
    }

    // Re-init position mode with new coverage grid adapter
    if (this.currentModeName === 'random') {
      if (this.currentMode) {
        this.currentMode.destroy();
      }
      const coverageGrid = this.fillMode.getCoverageGrid();
      this.currentMode = new BiasedRandomMode(coverageGrid);
      this.currentMode.init(this.app);
    }

    console.log(`Fill mode: ${name}`);
  }

  cycleFillMode() {
    this.fillModeIndex = (this.fillModeIndex + 1) % FILL_MODE_NAMES.length;
    const nextName = FILL_MODE_NAMES[this.fillModeIndex];
    this.clear();
    this.setFillMode(nextName);
  }

  cycleFillModeOption() {
    if (this.fillModeName === 'mosaic' && this.fillMode) {
      this.fillMode.cyclePattern();
    }
  }

  increaseStampSize() {
    if (!this.fillMode) return;
    if (this.fillModeName === 'bars') {
      this.fillMode.increaseBarThickness();
      this.reInitPositionMode();
    } else if (this.fillModeName === 'mosaic') {
      this.fillMode.increaseTileSize();
      this.reInitPositionMode();
    }
  }

  decreaseStampSize() {
    if (!this.fillMode) return;
    if (this.fillModeName === 'bars') {
      this.fillMode.decreaseBarThickness();
      this.reInitPositionMode();
    } else if (this.fillModeName === 'mosaic') {
      this.fillMode.decreaseTileSize();
      this.reInitPositionMode();
    }
  }

  reInitPositionMode() {
    if (this.currentModeName === 'random' && this.fillMode) {
      if (this.currentMode) {
        this.currentMode.destroy();
      }
      const coverageGrid = this.fillMode.getCoverageGrid();
      this.currentMode = new BiasedRandomMode(coverageGrid);
      this.currentMode.init(this.app);
    }
  }

  setMode(modeName) {
    if (modeName !== 'random' && modeName !== 'cursor' && modeName !== 'sweep') {
      console.warn(`Unknown mode: ${modeName}`);
      return;
    }

    if (this.currentMode) {
      this.currentMode.destroy();
      this.currentMode = null;
    }

    if (modeName === 'random') {
      const coverageGrid = this.fillMode ? this.fillMode.getCoverageGrid() : null;
      this.currentMode = new BiasedRandomMode(coverageGrid);
      this.currentMode.init(this.app);
    } else if (modeName === 'cursor') {
      this.currentMode = new CursorMode();
      this.currentMode.init(this.app);
    } else {
      this.currentMode = new SweepMode();
      this.currentMode.init(this.app);
      this.currentMode.setPattern('systematic');
    }

    this.currentModeName = modeName;
    console.log(`Mode changed to: ${modeName}`);
  }

  clear() {
    if (this.fillMode) {
      this.fillMode.reset();
    }

    if (this.timer) {
      this.timer.reset();
    }

    if (this.progressBar) {
      this.progressBar.update(0);
    }

    if (this.celebration) {
      this.celebration.destroy();
    }
    this.celebration = new Celebration();

    this.completed = false;
    this.started = false;

    console.log('Screen Fill activity reset');
  }

  getInputConfig() {
    return { debounce: 150 };
  }

  handleResize() {
    if (!this.app || !this.fillMode) {
      return;
    }

    // Defer to next frame so PixiJS has updated app.screen dimensions
    if (this.resizeTimeout) {
      cancelAnimationFrame(this.resizeTimeout);
    }

    this.resizeTimeout = requestAnimationFrame(() => {
      this.resizeTimeout = null;
      if (!this.app || !this.fillMode) {
        return;
      }

      this.fillMode.resize(this.app.screen.width, this.app.screen.height);
      this.clear();
      this.reInitPositionMode();
      this.lastPressTime = 0;
      console.log('Screen Fill resized and reset');
    });
  }

  destroy() {
    if (this.resizeTimeout) {
      cancelAnimationFrame(this.resizeTimeout);
      this.resizeTimeout = null;
    }

    window.removeEventListener('resize', this.handleResize);

    if (this.currentMode) {
      this.currentMode.destroy();
      this.currentMode = null;
    }

    if (this.sweepModeReference) {
      this.sweepModeReference.destroy();
      this.sweepModeReference = null;
    }

    if (this.fillMode) {
      const displayObj = this.fillMode.getDisplayObject();
      if (displayObj && displayObj.parent) {
        displayObj.parent.removeChild(displayObj);
      }
      this.fillMode.destroy();
      this.fillMode = null;
    }

    if (this.progressBar) {
      this.progressBar.destroy();
      this.progressBar = null;
    }

    if (this.timer) {
      this.timer.destroy();
      this.timer = null;
    }

    if (this.celebration) {
      this.celebration.destroy();
      this.celebration = null;
    }

    super.destroy();
  }
}
