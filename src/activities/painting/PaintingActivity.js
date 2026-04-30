import { Container } from 'pixi.js';
import { BaseActivity } from '../BaseActivity.js';
import { createEffect, getEffectTypes } from '../../effects/EffectFactory.js';
import { PaintLayer } from '../../painting/PaintLayer.js';
import { RandomMode } from './modes/RandomMode.js';
import { CursorMode } from './modes/CursorMode.js';
import { SweepMode } from './modes/SweepMode.js';
import { audioManager } from '../../audio/AudioManager.js';

const MODES = {
  random: RandomMode,
  cursor: CursorMode,
  sweep: SweepMode,
};

export class PaintingActivity extends BaseActivity {
  constructor() {
    super();
    this.paintLayer = null;
    this.effectsContainer = null;
    this.currentMode = null;
    this.currentModeName = 'random';
    this.effectType = 'solid';
    this._effectSize = 30;
    this._effectOpacity = 0.7;
    this._effectScatter = 30;
    this.debounceMs = 150;
    this.lastPressTime = 0;
    this.resizeTimeout = null;
    this.handleResize = this.handleResize.bind(this);
  }

  init(pixiApp) {
    super.init(pixiApp);

    // Persistent paint layer (renders underneath effects)
    this.paintLayer = new PaintLayer(pixiApp);
    pixiApp.stage.addChild(this.paintLayer.getDisplayObject());

    this.effectsContainer = new Container();
    pixiApp.stage.addChild(this.effectsContainer);
    this.setMode('random');
    window.addEventListener('resize', this.handleResize);
    console.log(`Painting activity started — mode: ${this.currentModeName}, effect: ${this.effectType}`);
  }

  update(delta) {
    if (this.currentMode && this.currentMode.update) {
      this.currentMode.update(delta);
    }
  }

  handleResize() {
    if (this.resizeTimeout) {
      cancelAnimationFrame(this.resizeTimeout);
    }

    this.resizeTimeout = requestAnimationFrame(() => {
      this.resizeTimeout = null;
      if (this.paintLayer && this.app) {
        this.paintLayer.resize(this.app.screen.width, this.app.screen.height);
      }
    });
  }

  handleInput(switchProfile, eventType) {
    if (eventType !== 'press') return;

    const now = performance.now();
    if (now - this.lastPressTime < this.debounceMs) return;
    this.lastPressTime = now;

    if (!this.currentMode) return;

    const pos = this.currentMode.getPosition();
    const scatter = this.currentModeName === 'cursor' ? 0 : this.currentModeName === 'sweep' ? 10 : this._effectScatter;

    // Apply scatter once so paint mark and effect animation share the same position
    const x = pos.x + (Math.random() - 0.5) * scatter * 2;
    const y = pos.y + (Math.random() - 0.5) * scatter * 2;

    // Stamp permanent mark on paint layer
    const stampOptions = {
      x,
      y,
      colour: switchProfile.colour,
      size: this._effectSize,
      opacity: this._effectOpacity,
      impactMultiplier: switchProfile.impactMultiplier,
    };

    if (this.effectType === 'splat') {
      this.paintLayer.stampSplat(stampOptions);
    } else if (this.effectType === 'smoke') {
      this.paintLayer.stampSmoke(stampOptions);
    } else if (this.effectType === 'firework') {
      this.paintLayer.stampFirework(stampOptions);
    } else if (this.effectType === 'brush') {
      this.paintLayer.stampSoft(stampOptions);
    } else {
      this.paintLayer.stamp(stampOptions);
    }

    audioManager.playPressSound(switchProfile.index);

    // Play animated effect on top for visual feedback
    const effect = createEffect(this.effectType);

    effect.spawn(this.effectsContainer, {
      x,
      y,
      colour: switchProfile.colour,
      size: this._effectSize,
      opacity: Math.min(1, this._effectOpacity + 0.2),
      scatter: 0, // scatter already applied above
      impactMultiplier: switchProfile.impactMultiplier,
    });
  }

  getInputConfig() {
    return { debounce: this.debounceMs };
  }

  setMode(modeName) {
    if (!MODES[modeName]) {
      console.warn(`Unknown mode: ${modeName}`);
      return;
    }

    // Destroy current mode
    if (this.currentMode) {
      this.currentMode.destroy();
    }

    // Create and init new mode
    const ModeClass = MODES[modeName];
    this.currentMode = new ModeClass();
    this.currentMode.init(this.app);
    this.currentModeName = modeName;
    console.log(`Mode changed to: ${modeName}`);
  }

  setEffectType(type) {
    const validTypes = getEffectTypes();
    if (!validTypes.includes(type)) {
      console.warn(`Unknown effect type: ${type}`);
      return;
    }
    this.effectType = type;
    console.log(`Effect type changed to: ${type}`);
  }

  getModeNames() {
    return Object.keys(MODES);
  }

  clear() {
    if (this.paintLayer) {
      this.paintLayer.clear();
    }
    // Also clear any lingering effects
    if (this.effectsContainer) {
      this.effectsContainer.removeChildren();
    }
    console.log('Canvas cleared');
  }

  setBlendMode(mode) {
    if (this.paintLayer) {
      this.paintLayer.setBlendMode(mode);
    }
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
    if (this.paintLayer) {
      this.paintLayer.destroy();
      this.paintLayer = null;
    }
    if (this.effectsContainer && this.effectsContainer.parent) {
      this.effectsContainer.parent.removeChild(this.effectsContainer);
      this.effectsContainer.destroy({ children: true });
    }
    this.effectsContainer = null;
    super.destroy();
  }
}
