import { Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import { hexToNumber } from '../utils/colour.js';
import { drawShape } from '../activities/screen-fill/fill-modes/ShapeStamper.js';

const BLEND_MODES = ['normal', 'add', 'multiply', 'screen'];

export class PaintLayer {
  constructor(app) {
    this.app = app;

    // Create render texture at screen resolution
    this.renderTexture = RenderTexture.create({
      width: app.screen.width,
      height: app.screen.height,
      antialias: true,
    });

    // Sprite that displays the accumulated paint
    this.sprite = new Sprite(this.renderTexture);
    this.sprite.anchor.set(0, 0);

    // Temp container for stamping — reused each frame
    this.stampContainer = new Container();

    this.blendMode = 'normal';
  }

  /**
   * Get the display sprite to add to the stage.
   */
  getDisplayObject() {
    return this.sprite;
  }

  ensureTextureSize() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    if (w > 0 && h > 0 && (this.renderTexture.width !== w || this.renderTexture.height !== h)) {
      const oldTexture = this.renderTexture;
      this.renderTexture = RenderTexture.create({
        width: w,
        height: h,
        antialias: true,
      });
      this.sprite.texture = this.renderTexture;
      oldTexture.destroy(true);
    }
  }

  /**
   * Stamp a circle onto the paint layer.
   * @param {Object} options - { x, y, colour, size, opacity, impactMultiplier }
   */
  stamp(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 30, opacity = 0.9, impactMultiplier = 1, shape = 'circle' } = options;
    const radius = size * impactMultiplier;

    const mark = new Graphics();
    drawShape(mark, shape, radius);
    mark.fill({ color: hexToNumber(colour), alpha: opacity });
    mark.position.set(x, y);

    if (this.blendMode === 'add') {
      mark.blendMode = 'add';
    } else if (this.blendMode === 'multiply') {
      mark.blendMode = 'multiply';
    } else if (this.blendMode === 'screen') {
      mark.blendMode = 'screen';
    }

    this.stampContainer.addChild(mark);
    this.app.renderer.render({
      container: this.stampContainer,
      target: this.renderTexture,
      clear: false,
    });
    this.stampContainer.removeChild(mark);
    mark.destroy();
  }

  /**
   * Stamp a soft (gradient) circle onto the paint layer.
   * @param {Object} options - { x, y, colour, size, opacity, impactMultiplier }
   */
  stampSoft(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 40, opacity = 0.7, impactMultiplier = 1 } = options;
    const diameter = Math.round(size * impactMultiplier * 2);

    // Create gradient texture via offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = diameter;
    canvas.height = diameter;
    const ctx = canvas.getContext('2d');
    const r = diameter / 2;

    const hex = colour.replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);

    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${opacity})`);
    gradient.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, ${opacity * 0.4})`);
    gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, diameter, diameter);

    const texture = RenderTexture.from({ resource: canvas });
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    if (this.blendMode === 'add') {
      sprite.blendMode = 'add';
    } else if (this.blendMode === 'multiply') {
      sprite.blendMode = 'multiply';
    } else if (this.blendMode === 'screen') {
      sprite.blendMode = 'screen';
    }

    this.stampContainer.addChild(sprite);
    this.app.renderer.render({
      container: this.stampContainer,
      target: this.renderTexture,
      clear: false,
    });
    this.stampContainer.removeChild(sprite);
    sprite.destroy();
    texture.destroy();
  }

  /**
   * Stamp a splat (irregular blob + droplets) onto the paint layer.
   * Uses an offscreen canvas to draw an irregular shape and a handful of
   * permanent droplet marks, then stamps the resulting texture into the
   * render texture so the splat becomes permanent paint.
   */
  stampSplat(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 40, opacity = 0.95, impactMultiplier = 1 } = options;
    const diameter = Math.round(size * impactMultiplier * 2.4);

    const canvas = document.createElement('canvas');
    canvas.width = diameter;
    canvas.height = diameter;
    const ctx = canvas.getContext('2d');
    const cx = diameter / 2;
    const cy = diameter / 2;
    const baseR = diameter * 0.4;

    // central irregular blob
    ctx.beginPath();
    const pts = 12;
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      const jitter = (0.85 + Math.random() * 0.4);
      const r = baseR * jitter;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const hex = colour.replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.2);
    grad.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${opacity})`);
    grad.addColorStop(0.6, `rgba(${cr}, ${cg}, ${cb}, ${opacity * 0.9})`);
    grad.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fill();

    // permanent droplets
    const dropletCount = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < dropletCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = baseR * (0.5 + Math.random() * 1.4);
      const dx = cx + Math.cos(a) * dist;
      const dy = cy + Math.sin(a) * dist;
      const rr = Math.max(1, Math.round(diameter * (0.02 + Math.random() * 0.06)));
      ctx.beginPath();
      ctx.arc(dx, dy, rr, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.9 - Math.random() * 0.6})`;
      ctx.fill();
    }

    const texture = RenderTexture.from({ resource: canvas });
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    if (this.blendMode === 'add') sprite.blendMode = 'add';
    else if (this.blendMode === 'multiply') sprite.blendMode = 'multiply';
    else if (this.blendMode === 'screen') sprite.blendMode = 'screen';

    this.stampContainer.addChild(sprite);
    this.app.renderer.render({ container: this.stampContainer, target: this.renderTexture, clear: false });
    this.stampContainer.removeChild(sprite);
    sprite.destroy();
    texture.destroy();
  }

  /**
   * Clear the entire paint layer.
   */
  clear() {
    // Render an empty container with clear=true to wipe the texture
    this.app.renderer.render({
      container: this.stampContainer,
      target: this.renderTexture,
      clear: true,
    });
    console.log('Paint layer cleared');
  }

  /**
   * Set the blend mode for new stamps.
   */
  setBlendMode(mode) {
    if (!BLEND_MODES.includes(mode)) {
      console.warn(`Unknown blend mode: ${mode}`);
      return;
    }
    this.blendMode = mode;
    console.log(`Blend mode: ${mode}`);
  }

  static getBlendModes() {
    return [...BLEND_MODES];
  }

  resize(width, height) {
    const w = width || this.app.screen.width;
    const h = height || this.app.screen.height;
    if (this.renderTexture.width !== w || this.renderTexture.height !== h) {
      const oldTexture = this.renderTexture;
      this.renderTexture = RenderTexture.create({
        width: w,
        height: h,
        antialias: true,
      });
      this.sprite.texture = this.renderTexture;
      oldTexture.destroy(true);
    }
  }

  destroy() {
    if (this.sprite && this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
    }
    this.sprite.destroy();
    this.renderTexture.destroy();
    this.stampContainer.destroy({ children: true });
    this.app = null;
  }
}
