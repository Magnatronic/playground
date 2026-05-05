import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import { BaseActivity } from '../BaseActivity.js';
import { audioManager } from '../../audio/AudioManager.js';
import { appState } from '../../app/AppState.js';

const SWITCH_LAYOUT = [
  { index: 0, label: 'Space' },
  { index: 1, label: 'Enter' },
  { index: 2, label: '\u2191' },
  { index: 3, label: '\u2193' },
  { index: 4, label: '\u2190' },
  { index: 5, label: '\u2192' },
];

const TILE_SIZE = 146;
const TILE_GAP = 16;
const TILE_RADIUS_RATIO = 0.18;
const PULSE_FRAMES = 16;
const DUST_MAX_PARTICLES = 2200;

const FREE_PLAY_FALLBACK = [
  { name: 'C', freq: 261.63 },
  { name: 'D', freq: 293.66 },
  { name: 'E', freq: 329.63 },
  { name: 'F', freq: 349.23 },
  { name: 'G', freq: 392.00 },
  { name: 'A', freq: 440.00 },
];

function hexToNumber(hex) {
  return parseInt((hex || '#888888').replace('#', '0x'));
}

function lerpColor(fromCol, toCol, t) {
  const fr = (fromCol >> 16) & 0xff;
  const fg = (fromCol >> 8) & 0xff;
  const fb = fromCol & 0xff;

  const tr = (toCol >> 16) & 0xff;
  const tg = (toCol >> 8) & 0xff;
  const tb = toCol & 0xff;

  const nr = Math.round(fr + (tr - fr) * t);
  const ng = Math.round(fg + (tg - fg) * t);
  const nb = Math.round(fb + (tb - fb) * t);

  return (nr << 16) | (ng << 8) | nb;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export class FreePlayActivity extends BaseActivity {
  constructor() {
    super();
    this._container = null;
    this._tiles = [];
    this._prevVoiceMode = null;
    this._debounceMs = 80;
    this._lastPress = new Map();
    this._profiles = [];
    this._freePlayNotes = FREE_PLAY_FALLBACK.slice();
    this._chords = false;
    this._octave = 0; // -2 to +2

    this._bgGfx = null;
    this._bgColorCurrent = 0x1a1a2e;
    this._bgColorTarget = 0x1a1a2e;
    this._bgPhase = Math.random() * Math.PI * 2;
    this._dustParticles = [];
    this._dustSpawnCarry = 0;
  }

  init(pixiApp) {
    super.init(pixiApp);
    this._prevVoiceMode = appState.get('musicVoiceMode');
    appState.set('musicVoiceMode', 'own');

    this._container = new Container();
    pixiApp.stage.addChild(this._container);

    this._profiles = appState.get('switchProfiles') || [];
    this._freePlayNotes = this._sanitizeNotes(appState.get('freePlayNotes'));
    this._chords = appState.get('freePlayChords') || false;
    this._octave = appState.get('freePlayOctave') || 0;

    this._rebuildVisuals();
  }

  _sanitizeNotes(notes) {
    if (!Array.isArray(notes) || notes.length !== SWITCH_LAYOUT.length) {
      return FREE_PLAY_FALLBACK.slice();
    }
    return notes.map((n, i) => {
      const fallback = FREE_PLAY_FALLBACK[i];
      if (!n || typeof n.name !== 'string' || typeof n.freq !== 'number') return fallback;
      return { name: n.name, freq: n.freq };
    });
  }

  _tileStartX() {
    const total = SWITCH_LAYOUT.length * TILE_SIZE + (SWITCH_LAYOUT.length - 1) * TILE_GAP;
    return (this.app.screen.width - total) / 2;
  }

  _tileY() {
    return (this.app.screen.height * 0.6) - (TILE_SIZE / 2);
  }

  _rebuildVisuals() {
    this._tiles.forEach((t) => {
      t.gfx?.destroy();
      t.noteText?.destroy();
      t.keyText?.destroy();
    });
    this._tiles = [];

    this._bgGfx?.destroy();
    this._bgGfx = null;
    this._dustParticles = [];
    this._dustSpawnCarry = 0;

    this._container.removeChildren();

    // Background layer
    this._bgGfx = new Graphics();
    this._container.addChild(this._bgGfx);

    // Tiles
    const startX = this._tileStartX();
    const tileY = this._tileY();

    for (let i = 0; i < SWITCH_LAYOUT.length; i++) {
      const layout = SWITCH_LAYOUT[i];
      const profile = this._profiles.find((p) => p.index === layout.index);
      const colour = profile?.colour || '#888888';
      const noteName = this._freePlayNotes[layout.index]?.name || '';

      const gfx = new Graphics();
      gfx.x = startX + i * (TILE_SIZE + TILE_GAP) - 8;
      gfx.y = tileY - 8;

      const noteStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: noteName ? Math.max(34, Math.floor(TILE_SIZE * 0.36)) : 0,
        fontWeight: 'bold',
        fill: 0xffffff,
      });
      const noteText = new Text({ text: noteName, style: noteStyle });
      noteText.anchor.set(0.5, 0.5);
      noteText.x = startX + i * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      noteText.y = tileY + TILE_SIZE / 2 - 8;

      const keyStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fill: 0xffffff,
      });
      const keyText = new Text({ text: layout.label, style: keyStyle });
      keyText.alpha = 0.62;
      keyText.anchor.set(0.5, 0.5);
      keyText.x = startX + i * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      keyText.y = tileY + TILE_SIZE - 14;

      this._container.addChild(gfx);
      this._container.addChild(noteText);
      this._container.addChild(keyText);

      this._tiles.push({ gfx, noteText, keyText, colour, pulseTimer: 0 });
    }

    this._refreshAll();
  }

  _drawTile(gfx, colour, alpha, pressed) {
    gfx.clear();
    const col = hexToNumber(colour);
    const radius = Math.round(TILE_SIZE * TILE_RADIUS_RATIO);
    const offset = 8;

    if (pressed) {
      gfx.roundRect(5, 5, TILE_SIZE + 6, TILE_SIZE + 6, radius + 3);
      gfx.fill({ color: 0xffffff, alpha: 0.24 });
    }

    gfx.roundRect(offset, offset, TILE_SIZE, TILE_SIZE, radius);
    gfx.fill({ color: col, alpha });

    if (alpha > 0.2) {
      gfx.roundRect(offset + 6, offset + 6, TILE_SIZE - 12, Math.max(20, TILE_SIZE * 0.22), radius - 6);
      gfx.fill({ color: 0xffffff, alpha: 0.14 });
    }

    if (pressed) {
      gfx.roundRect(offset + 4, offset + 4, TILE_SIZE - 8, TILE_SIZE - 8, radius - 2);
      gfx.fill({ color: 0xffffff, alpha: 0.2 });
    }
  }

  _refreshAll() {
    this._refreshBackground();
    this._refreshTiles();
  }

  _refreshBackground() {
    if (!this._bgGfx) return;
    this._bgGfx.clear();

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const particleDensity = clamp01(this._dustParticles.length / 140);

    this._bgGfx.rect(0, 0, w, h);
    this._bgGfx.fill({ color: lerpColor(0x161a34, this._bgColorCurrent, 0.44), alpha: 0.26 });

    this._bgGfx.rect(0, 0, w, h);
    this._bgGfx.fill({ color: lerpColor(0x1a1f3d, this._bgColorTarget, 0.28), alpha: 0.04 + particleDensity * 0.03 });

    for (const p of this._dustParticles) {
      this._drawDustParticle(p);
    }
  }

  _drawDustParticle(particle) {
    const lifeAlpha = clamp01(particle.life);
    if (lifeAlpha <= 0.01) return;
    const a = particle.alpha * lifeAlpha;
    if (a <= 0.004) return;

    const r = particle.size;
    this._bgGfx.ellipse(particle.x, particle.y, r, r * particle.squeeze);
    this._bgGfx.fill({ color: particle.color, alpha: a });
    this._bgGfx.ellipse(
      particle.x + particle.ox,
      particle.y + particle.oy,
      r * 0.65,
      r * 0.65 * particle.squeeze,
    );
    this._bgGfx.fill({ color: particle.color, alpha: a * 0.55 });
  }

  _spawnDustParticle({ x, y, color, boost = 0 }) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randRange(0.12, 0.45) * (1 + boost * 0.6);
    const smearAngle = Math.random() * Math.PI * 2;
    const smearDist = randRange(1, 3);

    this._dustParticles.push({
      x, y, color,
      size: randRange(1.5, 4.0 + boost * 1.5),
      squeeze: randRange(0.55, 1.0),
      ox: Math.cos(smearAngle) * smearDist,
      oy: Math.sin(smearAngle) * smearDist,
      alpha: randRange(0.18, 0.38 + boost * 0.08),
      life: randRange(1.0, 1.8),
      driftX: Math.cos(angle) * speed,
      driftY: Math.sin(angle) * speed,
      wobblePhase: randRange(0, Math.PI * 2),
      wobbleSpeed: randRange(0.15, 0.55),
      wobbleAmp: randRange(0.06, 0.22),
      fadeRate: randRange(0.00030, 0.00065),
    });
  }

  _spawnAmbientDust(count = 1) {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    for (let i = 0; i < count; i++) {
      const x = randRange(0, w);
      const y = randRange(h * 0.15, h * 0.95);
      const mix = 0.25 + 0.5 * Math.random();
      const color = lerpColor(this._bgColorCurrent, this._bgColorTarget, mix);
      this._spawnDustParticle({ x, y, color, boost: 0 });
    }
  }

  _refreshTiles() {
    for (const t of this._tiles) {
      if (t.pulseTimer > 0) continue;
      this._drawTile(t.gfx, t.colour, 1.0, false);
    }
  }

  handleInput(switchProfile, eventType) {
    if (eventType !== 'press') return;

    const now = Date.now();
    const last = this._lastPress.get(switchProfile.key) || 0;
    if (now - last < this._debounceMs) return;
    this._lastPress.set(switchProfile.key, now);

    const idx = switchProfile.index;
    if (idx < 0 || idx >= SWITCH_LAYOUT.length) return;

    const note = this._freePlayNotes[idx];
    if (note?.freq) {
      const octMult = Math.pow(2, this._octave);
      const root = note.freq * octMult;
      if (this._chords) {
        // Power chord: root + perfect fifth (×1.5)
        audioManager.playSongNote([root, root * 1.5]);
      } else {
        audioManager.playSongNote(root);
      }
    } else {
      audioManager.playPressSound(idx);
    }

    const tile = this._tiles[idx];
    if (tile) {
      this._bgColorTarget = hexToNumber(tile.colour);
      const tileStartX = this._tileStartX();
      const tileY = this._tileY();
      const tx = tileStartX + idx * (TILE_SIZE + TILE_GAP) + TILE_SIZE / 2;
      const ty = tileY + TILE_SIZE / 2;
      const load = clamp01(this._dustParticles.length / DUST_MAX_PARTICLES);
      const burstCount = Math.max(20, Math.round(90 * (1 - load * 0.5)));
      for (let i = 0; i < burstCount; i++) {
        this._spawnDustParticle({
          x: tx + randRange(-TILE_SIZE * 0.48, TILE_SIZE * 0.48),
          y: ty + randRange(-TILE_SIZE * 0.34, TILE_SIZE * 0.34),
          color: hexToNumber(tile.colour),
          boost: 1,
        });
      }
      tile.pulseTimer = PULSE_FRAMES;
      this._drawTile(tile.gfx, tile.colour, 1.0, true);
    }
  }

  update(delta) {
    const dt = Math.max(0.3, delta);
    this._bgPhase += (dt / 60) * 0.45;

    const t = Math.min(1, (dt / 60) * 0.045);
    this._bgColorCurrent = lerpColor(this._bgColorCurrent, this._bgColorTarget, t);

    const load = clamp01(this._dustParticles.length / DUST_MAX_PARTICLES);
    const ambientRate = 4.0 + (18.0 - 4.0) * (1 - load);
    this._dustSpawnCarry += (dt / 60) * ambientRate;
    while (this._dustSpawnCarry >= 1) {
      this._spawnAmbientDust(1);
      this._dustSpawnCarry -= 1;
    }

    const softCap = Math.round(DUST_MAX_PARTICLES * 0.92);
    if (this._dustParticles.length > softCap) {
      const excess = this._dustParticles.length - softCap;
      const nudge = Math.min(excess, 12);
      for (let i = 0; i < nudge; i++) {
        this._dustParticles[i].fadeRate *= 1.06;
      }
    }

    for (let i = this._dustParticles.length - 1; i >= 0; i--) {
      const dust = this._dustParticles[i];
      dust.wobblePhase += dust.wobbleSpeed * (dt / 60);
      dust.x += dust.driftX * dt + Math.sin(dust.wobblePhase) * dust.wobbleAmp * dt;
      dust.y += dust.driftY * dt;
      dust.life -= dust.fadeRate * dt;

      const sh = this.app.screen.height;
      if (dust.life <= 0 || dust.y < -80 || dust.y > sh + 80 || dust.x < -80 || dust.x > this.app.screen.width + 80) {
        this._dustParticles.splice(i, 1);
      }
    }

    this._refreshBackground();

    let needRefresh = false;
    for (const t of this._tiles) {
      if (t.pulseTimer > 0) {
        t.pulseTimer -= delta;
        if (t.pulseTimer <= 0) {
          t.pulseTimer = 0;
          needRefresh = true;
        } else {
          this._drawTile(t.gfx, t.colour, 1.0, true);
        }
      }
    }
    if (needRefresh) this._refreshTiles();
  }

  setFreePlayNotes(notes) {
    this._freePlayNotes = this._sanitizeNotes(notes);
    this._rebuildVisuals();
  }

  setChords(val) {
    this._chords = !!val;
  }

  setOctave(val) {
    this._octave = Math.max(-2, Math.min(2, Number(val) || 0));
  }

  destroy() {
    if (this._prevVoiceMode !== null) {
      appState.set('musicVoiceMode', this._prevVoiceMode);
    }
    if (this._container) {
      this._container.destroy({ children: true });
      this._container = null;
    }
    this._tiles = [];
    this._bgGfx = null;
    super.destroy();
  }
}
