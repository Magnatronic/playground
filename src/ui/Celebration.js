import { Container, Graphics, Ticker } from 'pixi.js';
import { hexToNumber } from '../utils/colour.js';

const CELEBRATION_PALETTE = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#FFFFFF',
];

export class Celebration {
  constructor() {
    this.container = null;
    this.particles = [];
    this.burstTimeouts = [];
    this.completeTimeout = null;
    this.tickerCallback = null;
    this.onComplete = null;
    this.active = false;
  }

  play(pixiApp, onComplete) {
    if (!pixiApp || !pixiApp.stage || !pixiApp.renderer) {
      return;
    }

    this.destroy();

    this.active = true;
    this.onComplete = typeof onComplete === 'function' ? onComplete : null;

    this.container = new Container();
    this.container.zIndex = 9999;
    pixiApp.stage.addChild(this.container);

    const width = pixiApp.renderer.width;
    const height = pixiApp.renderer.height;
    const burstPositions = [
      { x: width * 0.5, y: height * 0.5 },
      { x: width * 0.15, y: height * 0.15 },
      { x: width * 0.85, y: height * 0.15 },
      { x: width * 0.15, y: height * 0.85 },
      { x: width * 0.85, y: height * 0.85 },
      { x: width * 0.5, y: height * 0.15 },
      { x: width * 0.5, y: height * 0.85 },
      { x: width * 0.15, y: height * 0.5 },
      { x: width * 0.85, y: height * 0.5 },
    ];

    burstPositions.forEach((position, index) => {
      const timeout = setTimeout(() => {
        if (!this.active) {
          return;
        }
        this.spawnBurst(position.x, position.y);
      }, index * 120);

      this.burstTimeouts.push(timeout);
    });

    this.tickerCallback = () => {
      const now = performance.now();

      for (let i = this.particles.length - 1; i >= 0; i--) {
        const particle = this.particles[i];
        const age = now - particle._born;
        const progress = Math.min(age / particle._life, 1);

        particle.x += particle._vx;
        particle.y += particle._vy;
        particle._vx *= 0.98;
        particle._vy *= 0.98;

        particle.alpha = 1 - progress;
        particle.scale.set(Math.max(0.1, 1 - progress));

        if (progress >= 1) {
          if (particle.parent) {
            particle.parent.removeChild(particle);
          }
          particle.destroy();
          this.particles.splice(i, 1);
        }
      }
    };

    Ticker.shared.add(this.tickerCallback);

    this.completeTimeout = setTimeout(() => {
      this.cleanup(true);
    }, 6000);
  }

  spawnBurst(x, y) {
    if (!this.container) {
      return;
    }

    const particleCount = 50 + Math.floor(Math.random() * 21);

    for (let i = 0; i < particleCount; i++) {
      const particle = new Graphics();
      const radius = 5 + Math.random() * 12;
      const colour = CELEBRATION_PALETTE[Math.floor(Math.random() * CELEBRATION_PALETTE.length)];

      particle.circle(0, 0, radius);
      particle.fill(hexToNumber(colour));
      particle.position.set(x, y);
      particle.alpha = 1;

      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.35;
  const speed = 7 + Math.random() * 12;
      particle._vx = Math.cos(angle) * speed;
      particle._vy = Math.sin(angle) * speed;
  particle._life = 2500 + Math.random() * 1500;
      particle._born = performance.now();

      this.container.addChild(particle);
      this.particles.push(particle);
    }
  }

  cleanup(callComplete) {
    if (!this.active && !this.container && this.particles.length === 0) {
      return;
    }

    this.active = false;

    for (const timeout of this.burstTimeouts) {
      clearTimeout(timeout);
    }
    this.burstTimeouts = [];

    if (this.completeTimeout) {
      clearTimeout(this.completeTimeout);
      this.completeTimeout = null;
    }

    if (this.tickerCallback) {
      Ticker.shared.remove(this.tickerCallback);
      this.tickerCallback = null;
    }

    this.particles.length = 0;

    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
      this.container = null;
    }

    if (callComplete && this.onComplete) {
      const complete = this.onComplete;
      this.onComplete = null;
      complete();
    } else {
      this.onComplete = null;
    }
  }

  destroy() {
    this.cleanup(false);
  }
}

export default Celebration;
