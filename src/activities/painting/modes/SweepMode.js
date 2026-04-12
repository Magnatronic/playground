import { Graphics } from 'pixi.js';

const PATTERNS = ['horizontal', 'vertical', 'bounce', 'systematic'];

export class SweepMode {
  constructor() {
    this.app = null;
    this.cursor = null;
    this.x = 0;
    this.y = 0;
    this.speed = 3;
    this.pattern = 'horizontal';
    this.vx = 0;
    this.vy = 0;
    // For systematic pattern
    this.rowHeight = 60;
    this.systematicDir = 1; // 1 = right, -1 = left
  }

  init(pixiApp) {
    this.app = pixiApp;
    this.x = pixiApp.screen.width / 2;
    this.y = pixiApp.screen.height / 2;

    this.cursor = new Graphics();
    this.drawCursor();
    pixiApp.stage.addChild(this.cursor);

    this.applyPattern();
  }

  applyPattern() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    switch (this.pattern) {
      case 'horizontal':
        this.vx = this.speed;
        this.vy = 0;
        break;
      case 'vertical':
        this.vx = 0;
        this.vy = this.speed;
        break;
      case 'bounce': {
        // Random diagonal angle
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        // Ensure reasonable velocity on both axes
        if (Math.abs(this.vx) < 0.5) this.vx = this.speed * 0.7;
        if (Math.abs(this.vy) < 0.5) this.vy = this.speed * 0.7;
        break;
      }
      case 'systematic':
        this.x = 0;
        this.y = this.rowHeight / 2;
        this.systematicDir = 1;
        this.vx = this.speed;
        this.vy = 0;
        break;
    }
  }

  drawCursor() {
    const size = 20;
    this.cursor.clear();
    this.cursor.moveTo(0, -size);
    this.cursor.lineTo(0, size);
    this.cursor.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    this.cursor.moveTo(-size, 0);
    this.cursor.lineTo(size, 0);
    this.cursor.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
    this.cursor.circle(0, 0, 4);
    this.cursor.fill({ color: 0xffffff, alpha: 0.9 });
  }

  update(delta) {
    if (!this.app) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    switch (this.pattern) {
      case 'horizontal':
        this.x += this.vx * delta;
        if (this.x >= w) {
          this.x = w;
          this.vx = -this.speed;
        } else if (this.x <= 0) {
          this.x = 0;
          this.vx = this.speed;
        }
        break;

      case 'vertical':
        this.y += this.vy * delta;
        if (this.y >= h) {
          this.y = h;
          this.vy = -this.speed;
        } else if (this.y <= 0) {
          this.y = 0;
          this.vy = this.speed;
        }
        break;

      case 'bounce':
        this.x += this.vx * delta;
        this.y += this.vy * delta;
        if (this.x >= w || this.x <= 0) {
          this.vx = -this.vx;
          this.x = Math.max(0, Math.min(w, this.x));
        }
        if (this.y >= h || this.y <= 0) {
          this.vy = -this.vy;
          this.y = Math.max(0, Math.min(h, this.y));
        }
        break;

      case 'systematic':
        this.x += this.vx * this.systematicDir * delta;
        if (this.x >= w) {
          this.x = w;
          this.y += this.rowHeight;
          this.systematicDir = -1;
        } else if (this.x <= 0) {
          this.x = 0;
          this.y += this.rowHeight;
          this.systematicDir = 1;
        }
        // Wrap back to top when reaching bottom
        if (this.y >= h) {
          this.y = this.rowHeight / 2;
        }
        break;
    }

    if (this.cursor) {
      this.cursor.position.set(this.x, this.y);
    }
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  setSpeed(speed) {
    this.speed = speed;
    this.applyPattern();
  }

  setPattern(pattern) {
    if (!PATTERNS.includes(pattern)) {
      console.warn(`Unknown sweep pattern: ${pattern}`);
      return;
    }
    this.pattern = pattern;
    this.applyPattern();
    console.log(`Sweep pattern: ${pattern}`);
  }

  static getPatterns() {
    return [...PATTERNS];
  }

  destroy() {
    if (this.cursor && this.cursor.parent) {
      this.cursor.parent.removeChild(this.cursor);
      this.cursor.destroy();
    }
    this.cursor = null;
    this.app = null;
  }
}
