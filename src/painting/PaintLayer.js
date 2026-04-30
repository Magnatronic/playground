import { Container, Graphics, RenderTexture, Sprite, Texture } from 'pixi.js';
import { hexToNumber } from '../utils/colour.js';
import { createSplatCanvas } from '../effects/splatGenerator.js';
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

    const sprite = new Sprite(Texture.from(canvas));
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
  }

  /**
   * Stamp a smoke wisp onto the paint layer.
   * Draws an overlapping cluster of blurred, semi-transparent blobs to leave
   * a soft, airy permanent mark that looks like scorched/smudged smoke residue.
   */
  stampSmoke(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 40, opacity = 0.55, impactMultiplier = 1 } = options;
    const scale = Math.max(0.5, impactMultiplier);
    const spread = size * scale;

    const hex = (colour || '#ffffff').replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);

    // Canvas large enough to hold the whole cloud + blur headroom
    const canvasSize = Math.ceil(spread * 4.5);
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    const cx2 = canvasSize / 2;
    const cy2 = canvasSize / 2;

    // Draw 5–8 overlapping blurred blobs at random offsets
    const blobCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < blobCount; i++) {
      const bx = cx2 + (Math.random() - 0.5) * spread * 1.1;
      const by = cy2 + (Math.random() - 0.5) * spread * 0.7;
      const br = spread * (0.35 + Math.random() * 0.45);
      const ba = opacity * (0.18 + Math.random() * 0.28);

      ctx.save();
      ctx.filter = `blur(${Math.round(br * 0.5)}px)`;
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${ba.toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(ba * 0.5).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, br * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const sprite = new Sprite(Texture.from(canvas));
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    if (this.blendMode === 'add') sprite.blendMode = 'add';
    else if (this.blendMode === 'multiply') sprite.blendMode = 'multiply';
    else if (this.blendMode === 'screen') sprite.blendMode = 'screen';

    this.stampContainer.addChild(sprite);
    this.app.renderer.render({ container: this.stampContainer, target: this.renderTexture, clear: false });
    this.stampContainer.removeChild(sprite);
    sprite.destroy();
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
    // blobDiameter drives R inside the generator; canvas will be 5× this
    const diameter = Math.round(size * impactMultiplier * 1.2);

    // Use the shared splat generator to create a richer splat canvas
    const canvas = createSplatCanvas(colour, diameter);
    const sprite = new Sprite(Texture.from(canvas));
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);

    if (this.blendMode === 'add') sprite.blendMode = 'add';
    else if (this.blendMode === 'multiply') sprite.blendMode = 'multiply';
    else if (this.blendMode === 'screen') sprite.blendMode = 'screen';

    this.stampContainer.addChild(sprite);
    this.app.renderer.render({ container: this.stampContainer, target: this.renderTexture, clear: false });
    this.stampContainer.removeChild(sprite);
    sprite.destroy();
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
