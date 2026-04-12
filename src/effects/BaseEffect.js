import { Ticker } from 'pixi.js';

export class BaseEffect {
  constructor() {
    this.displayObjects = [];
    this.tickerCallback = null;
  }

  /**
   * Spawn the effect into a container.
   * @param {Container} container - PixiJS container to add display objects to
   * @param {Object} options - { x, y, colour, size, opacity, scatter, impactMultiplier }
   */
  spawn(container, options) {
    // Apply scatter: randomize position offset
    const scatter = options.scatter || 0;
    const x = options.x + (Math.random() - 0.5) * scatter * 2;
    const y = options.y + (Math.random() - 0.5) * scatter * 2;

    const resolvedOptions = { ...options, x, y };

    this.createEffect(container, resolvedOptions);
  }

  /**
   * Override in subclasses to create the actual visual.
   */
  createEffect(container, options) {
    throw new Error('Subclasses must implement createEffect');
  }

  /**
   * Helper: fade out a display object over `duration` ms, then remove and destroy it.
   */
  fadeAndRemove(displayObject, duration = 1000) {
    const startAlpha = displayObject.alpha;
    const startTime = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      displayObject.alpha = startAlpha * (1 - progress);

      if (progress >= 1) {
        Ticker.shared.remove(tick);
        if (displayObject.parent) {
          displayObject.parent.removeChild(displayObject);
        }
        displayObject.destroy({ children: true, texture: false });
      }
    };

    Ticker.shared.add(tick);
  }
}
