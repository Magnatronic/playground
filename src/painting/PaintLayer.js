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
   * Draws a dense irregular core + curling tendrils + scattered micro-particles
   * to leave an organic, asymmetric smoke-stain mark.
   */
  stampSmoke(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 40, opacity = 0.85, impactMultiplier = 1 } = options;
    const scale = Math.max(0.5, impactMultiplier);
    const R = size * scale;

    const hex = (colour || '#ffffff').replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);
    const col = (a) => `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;

    // Canvas big enough for tendrils reaching upward
    const canvasW = Math.ceil(R * 5);
    const canvasH = Math.ceil(R * 7); // taller — smoke rises
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    const cx2 = canvasW / 2;
    const cy2 = canvasH * 0.62; // origin sits in lower half

    // ── 1. Dense irregular impact core ─────────────────────────────────────
    ctx.save();
    ctx.filter = `blur(${Math.round(R * 0.22)}px)`;
    const pts = 28;
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const noise =
        Math.sin(a * 3.2) * 0.13 +
        Math.sin(a * 7.1) * 0.07 +
        (Math.random() * 0.22 - 0.11);
      const rad = R * (0.55 + noise);
      const px = cx2 + Math.cos(a) * rad;
      const py = cy2 + Math.sin(a) * rad * 0.78; // slightly squashed vertically
      if (i === 0) ctx.moveTo(px, py);
      else         ctx.lineTo(px, py);
    }
    ctx.closePath();
    const coreGrad = ctx.createRadialGradient(cx2, cy2 - R * 0.1, 0, cx2, cy2, R * 0.75);
    coreGrad.addColorStop(0,    col(opacity * 0.95));
    coreGrad.addColorStop(0.45, col(opacity * 0.78));
    coreGrad.addColorStop(0.85, col(opacity * 0.35));
    coreGrad.addColorStop(1,    col(0));
    ctx.fillStyle = coreGrad;
    ctx.fill();
    ctx.restore();

    // ── 2. Wispy tendrils curling upward ────────────────────────────────────
    const tendrilCount = 4 + Math.floor(Math.random() * 5);
    for (let t = 0; t < tendrilCount; t++) {
      const startX = cx2 + (Math.random() - 0.5) * R * 0.9;
      const startY = cy2 - R * (0.3 + Math.random() * 0.3);
      const height  = R * (1.2 + Math.random() * 2.2);
      const curl    = (Math.random() - 0.5) * R * 1.8; // horizontal curl at top
      const midCurl = (Math.random() - 0.5) * R * 0.9;
      const baseW   = Math.max(1.5, R * (0.04 + Math.random() * 0.11));

      ctx.save();
      ctx.filter = `blur(${Math.round(baseW * 1.8 + 1)}px)`;

      // Build a tapered bezier strip: wide at base, pointed at tip
      const cp1x = startX + midCurl * 0.4;
      const cp1y = startY - height * 0.4;
      const cp2x = startX + curl  * 0.7;
      const cp2y = startY - height * 0.75;
      const endX  = startX + curl;
      const endY  = startY - height;

      // Left edge (offset perpendicular to curve direction)
      ctx.beginPath();
      ctx.moveTo(startX - baseW, startY);
      ctx.bezierCurveTo(cp1x - baseW * 0.6, cp1y, cp2x - baseW * 0.2, cp2y, endX, endY);
      ctx.bezierCurveTo(cp2x + baseW * 0.2, cp2y, cp1x + baseW * 0.6, cp1y, startX + baseW, startY);
      ctx.closePath();

      const tg = ctx.createLinearGradient(startX, startY, endX, endY);
      tg.addColorStop(0,   col(opacity * (0.55 + Math.random() * 0.30)));
      tg.addColorStop(0.5, col(opacity * (0.25 + Math.random() * 0.20)));
      tg.addColorStop(1,   col(0));
      ctx.fillStyle = tg;
      ctx.fill();
      ctx.restore();
    }

    // ── 3. Scattered micro-particles (ash / ember dots) ─────────────────────
    const particleCount = 18 + Math.floor(Math.random() * 20);
    for (let p = 0; p < particleCount; p++) {
      const ang  = Math.random() * Math.PI * 2;
      const dist = R * (0.5 + Math.pow(Math.random(), 0.6) * 1.8);
      const px   = cx2 + Math.cos(ang) * dist;
      const py   = cy2 + Math.sin(ang) * dist * 0.7 - dist * 0.15; // bias upward
      const pr   = Math.max(0.8, R * (0.015 + Math.random() * 0.055));
      if (px < 1 || px > canvasW - 1 || py < 1 || py > canvasH - 1) continue;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = col(opacity * (0.25 + Math.random() * 0.55));
      ctx.fill();
    }

    // ── 4. Final soft-glow halo (makes core look hot/luminous) ──────────────
    ctx.save();
    ctx.filter = `blur(${Math.round(R * 0.55)}px)`;
    const haloGrad = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, R * 1.1);
    haloGrad.addColorStop(0,   col(opacity * 0.38));
    haloGrad.addColorStop(0.6, col(opacity * 0.12));
    haloGrad.addColorStop(1,   col(0));
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx2, cy2, R * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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
   * Stamp a firework burst mark — radiating streak lines + bright glowing centre.
   * Placed at the burst position (above the launch point).
   */
  stampFirework(options) {
    this.ensureTextureSize();
    const { x, y, colour, size = 40, opacity = 0.9, impactMultiplier = 1 } = options;
    const sc  = Math.max(0.6, impactMultiplier);
    const R   = size * sc;

    const hex = (colour || '#ffffff').replace('#', '');
    const cr = parseInt(hex.substring(0, 2), 16);
    const cg = parseInt(hex.substring(2, 4), 16);
    const cb = parseInt(hex.substring(4, 6), 16);
    const col = (a) => `rgba(${cr},${cg},${cb},${a.toFixed(3)})`;

    // Burst position is above the press point (where the rocket exploded)
    const burstX = x;
    const burstY = y - R * 2.0;

    const canvasSize = Math.ceil(R * 7);
    const canvas = document.createElement('canvas');
    canvas.width  = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    const cx2 = canvasSize / 2;
    const cy2 = canvasSize / 2;

    // ── Radiating streak lines ───────────────────────────────────────────────
    const streakCount = 20 + Math.floor(Math.random() * 16);
    for (let i = 0; i < streakCount; i++) {
      const ang  = (i / streakCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const len  = R * (1.2 + Math.random() * 1.8);
      const w    = Math.max(0.8, R * (0.012 + Math.random() * 0.022));

      ctx.save();
      ctx.translate(cx2, cy2);
      ctx.rotate(ang);
      const sg = ctx.createLinearGradient(0, 0, len, 0);
      sg.addColorStop(0,    `rgba(255,255,255,${(opacity * 0.95).toFixed(3)})`);
      sg.addColorStop(0.12, col(opacity * 0.88));
      sg.addColorStop(1,    col(0));
      ctx.strokeStyle = sg;
      ctx.lineWidth   = w;
      ctx.lineCap     = 'round';
      // Slight droop gravity curve
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.55, (Math.random() - 0.5) * R * 0.18, len, R * 0.12);
      ctx.stroke();
      ctx.restore();
    }

    // ── Burst glow centre ────────────────────────────────────────────────────
    ctx.save();
    ctx.filter = `blur(${Math.round(R * 0.25)}px)`;
    const cg2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, R * 0.55);
    cg2.addColorStop(0,    `rgba(255,255,255,${opacity.toFixed(3)})`);
    cg2.addColorStop(0.35, col(opacity * 0.90));
    cg2.addColorStop(0.75, col(opacity * 0.35));
    cg2.addColorStop(1,    col(0));
    ctx.fillStyle = cg2;
    ctx.beginPath();
    ctx.arc(cx2, cy2, R * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Falling ember dots ───────────────────────────────────────────────────
    const emberCount = 20 + Math.floor(Math.random() * 20);
    for (let i = 0; i < emberCount; i++) {
      const ang  = Math.random() * Math.PI * 2;
      const dist = R * (0.6 + Math.pow(Math.random(), 0.5) * 2.2);
      const ex   = cx2 + Math.cos(ang) * dist;
      const ey   = cy2 + Math.sin(ang) * dist + dist * 0.15; // slight downward bias
      if (ex < 1 || ex > canvasSize - 1 || ey < 1 || ey > canvasSize - 1) continue;
      const er   = Math.max(0.5, R * (0.01 + Math.random() * 0.04));
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, Math.PI * 2);
      ctx.fillStyle = col(opacity * (0.3 + Math.random() * 0.65));
      ctx.fill();
    }

    // Stamp is centred on burstY (above press point)
    const sprite = new Sprite(Texture.from(canvas));
    sprite.anchor.set(0.5);
    sprite.position.set(burstX, burstY);

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
