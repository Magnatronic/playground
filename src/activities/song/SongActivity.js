import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import { BaseActivity } from '../BaseActivity.js';
import { audioManager } from '../../audio/AudioManager.js';
import { appState } from '../../app/AppState.js';
import { getSongById } from './songs.js';

const SWITCH_LAYOUT = [
  { index: 0, label: 'Space' },
  { index: 1, label: 'Enter' },
  { index: 2, label: '\u2191' },
  { index: 3, label: '\u2193' },
  { index: 4, label: '\u2190' },
  { index: 5, label: '\u2192' },
];

const TILE_GAP = 16;
const TILE_RADIUS_RATIO = 0.18;
const PULSE_FRAMES = 16;
const HINT_FRAMES = 22;

const SONG_MAP_PER_ROW = 8;
const SONG_MAP_GAP = 8;
const DUST_MAX_PARTICLES = 1400;

const FREE_PLAY_FALLBACK = [
  { name: 'C', freq: 261.63 },
  { name: 'D', freq: 293.66 },
  { name: 'E', freq: 329.63 },
  { name: 'F', freq: 349.23 },
  { name: 'G', freq: 392.0 },
  { name: 'A', freq: 440.0 },
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

export class SongActivity extends BaseActivity {
  constructor() {
    super();
    this._container = null;
    this._tiles = [];
    this._song = null;
    this._stepIndex = 0;
    this._songMode = 'rhythm';
    this._prevVoiceMode = null;
    this._debounceMs = 80;
    this._lastPress = new Map();
    this._profiles = [];
    this._freePlayNotes = FREE_PLAY_FALLBACK;

    this._bgGfx = null;
    this._bgColorCurrent = 0x1a1a2e;
    this._bgColorTarget = 0x1a1a2e;
    this._bgPhase = Math.random() * Math.PI * 2;
    this._dustParticles = [];
    this._dustSpawnCarry = 0;

    this._songMapCells = [];
  }

  init(pixiApp) {
    super.init(pixiApp);
    this._prevVoiceMode = appState.get('musicVoiceMode');
    appState.set('musicVoiceMode', 'own');

    this._container = new Container();
    pixiApp.stage.addChild(this._container);

    this._profiles = appState.get('switchProfiles') || [];
    this._song = getSongById(appState.get('songId') || 'twinkle');
    this._songMode = appState.get('songMode') || 'rhythm';
    this._stepIndex = 0;
    this._freePlayNotes = this._sanitizeFreePlayNotes(appState.get('freePlayNotes'));

    this._rebuildVisuals();
  }

  _sanitizeFreePlayNotes(notes) {
    if (!Array.isArray(notes) || notes.length !== SWITCH_LAYOUT.length) {
      return FREE_PLAY_FALLBACK.slice();
    }

    return notes.map((n, i) => {
      const fallback = FREE_PLAY_FALLBACK[i];
      if (!n || typeof n.name !== 'string' || typeof n.freq !== 'number') {
        return fallback;
      }
      return { name: n.name, freq: n.freq };
    });
  }

  _tileSize() {
    return this._songMode === 'free' ? 146 : 108;
  }

  _tileStartX() {
    const size = this._tileSize();
    const total = SWITCH_LAYOUT.length * size + (SWITCH_LAYOUT.length - 1) * TILE_GAP;
    return (this.app.screen.width - total) / 2;
  }

  _tileY() {
    const size = this._tileSize();
    if (this._songMode === 'free') {
      return (this.app.screen.height * 0.6) - (size / 2);
    }

    if (this._songMode === 'rhythm') {
      // Rhythm tap does not show the bottom tile row, so use this only as map layout anchor.
      return this.app.screen.height * 0.84;
    }

    const fromBottom = this.app.screen.height - size - 84;
    return Math.max(this.app.screen.height * 0.48, fromBottom);
  }

  _songMapMetrics() {
    const total = this._song?.steps?.length ?? 0;
    const rows = Math.max(1, Math.ceil(total / SONG_MAP_PER_ROW));

    const availableWidth = Math.max(320, this.app.screen.width - 80);
    const availableHeight = Math.max(180, this._tileY() - 44);

    const blockByWidth = Math.floor((availableWidth - SONG_MAP_GAP * (SONG_MAP_PER_ROW - 1)) / SONG_MAP_PER_ROW);
    const blockByHeight = Math.floor((availableHeight - SONG_MAP_GAP * (rows - 1)) / rows);

    const block = Math.max(34, Math.min(74, Math.min(blockByWidth, blockByHeight)));
    const mapWidth = SONG_MAP_PER_ROW * block + (SONG_MAP_PER_ROW - 1) * SONG_MAP_GAP;
    const mapHeight = rows * block + (rows - 1) * SONG_MAP_GAP;

    const startX = (this.app.screen.width - mapWidth) / 2;
    const startY = Math.max(22, Math.floor((availableHeight - mapHeight) / 2) + 22);

    return { rows, block, startX, startY };
  }

  _rebuildVisuals() {
    this._tiles.forEach((t) => {
      t.gfx?.destroy();
      t.noteText?.destroy();
      t.keyText?.destroy();
    });
    this._tiles = [];

    this._songMapCells.forEach((c) => {
      c.gfx?.destroy();
      c.text?.destroy();
    });
    this._songMapCells = [];

    this._bgGfx?.destroy();
    this._bgGfx = null;
    this._dustParticles = [];
    this._dustSpawnCarry = 0;

    this._container.removeChildren();

    this._buildBackgroundLayer();
    this._buildSongMap();
    this._buildTiles();
    this._refreshAll();
  }

  _buildBackgroundLayer() {
    this._bgGfx = new Graphics();
    this._container.addChild(this._bgGfx);
  }

  _buildSongMap() {
    const show = this._songMode !== 'free' && !!this._song;
    if (!show) {
      return;
    }

    const total = this._song.steps.length;
    const { block } = this._songMapMetrics();

    const textStyle = new TextStyle({
      fontFamily: 'Arial, sans-serif',
      fontSize: Math.max(18, Math.floor(block * 0.42)),
      fontWeight: 'bold',
      fill: 0xffffff,
    });

    for (let i = 0; i < total; i++) {
      const gfx = new Graphics();
      const text = new Text({ text: '', style: textStyle });
      text.anchor.set(0.5, 0.5);
      this._container.addChild(gfx);
      this._container.addChild(text);
      this._songMapCells.push({ gfx, text });
    }
  }

  _buildTiles() {
    if (this._songMode === 'rhythm') {
      return;
    }

    const song = this._song;
    const startX = this._tileStartX();
    const tileY = this._tileY();
    const tileSize = this._tileSize();

    for (let i = 0; i < SWITCH_LAYOUT.length; i++) {
      const layout = SWITCH_LAYOUT[i];
      const profile = this._profiles.find((p) => p.index === layout.index);
      const colour = profile?.colour || '#888888';

      const inSong = song.noteMap[layout.index] != null;
      const hasNote = this._songMode === 'free' ? true : inSong;
      const noteName = this._songMode === 'free'
        ? (this._freePlayNotes[layout.index]?.name || '')
        : (song.noteNames[layout.index] || '');

      const gfx = new Graphics();
      gfx.x = startX + i * (tileSize + TILE_GAP) - 8;
      gfx.y = tileY - 8;

      const noteStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: noteName ? Math.max(34, Math.floor(tileSize * 0.36)) : 0,
        fontWeight: 'bold',
        fill: 0xffffff,
      });
      const noteText = new Text({ text: noteName, style: noteStyle });
      noteText.anchor.set(0.5, 0.5);
      noteText.x = startX + i * (tileSize + TILE_GAP) + tileSize / 2;
      noteText.y = tileY + tileSize / 2 - 8;

      const keyStyle = new TextStyle({
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fill: 0xffffff,
      });
      const keyText = new Text({ text: layout.label, style: keyStyle });
      keyText.alpha = 0.62;
      keyText.anchor.set(0.5, 0.5);
      keyText.x = startX + i * (tileSize + TILE_GAP) + tileSize / 2;
      keyText.y = tileY + tileSize - 14;

      this._container.addChild(gfx);
      this._container.addChild(noteText);
      this._container.addChild(keyText);

      this._tiles.push({
        gfx,
        noteText,
        keyText,
        colour,
        hasNote,
        pulseTimer: 0,
        hintTimer: 0,
      });
    }
  }

  _drawTile(gfx, colour, tileSize, alpha, pressed, hinting, isTarget) {
    gfx.clear();
    const col = hexToNumber(colour);
    const radius = Math.round(tileSize * TILE_RADIUS_RATIO);
    const offset = 8;

    if (isTarget) {
      gfx.roundRect(0, 0, tileSize + offset * 2, tileSize + offset * 2, radius + offset);
      gfx.fill({ color: 0xffffff, alpha: 0.32 });
      gfx.roundRect(4, 4, tileSize + offset * 2 - 8, tileSize + offset * 2 - 8, radius + 4);
      gfx.fill({ color: col, alpha: 0.58 });
    }

    if (pressed || hinting) {
      gfx.roundRect(5, 5, tileSize + 6, tileSize + 6, radius + 3);
      gfx.fill({ color: 0xffffff, alpha: hinting ? 0.46 : 0.24 });
    }

    gfx.roundRect(offset, offset, tileSize, tileSize, radius);
    gfx.fill({ color: col, alpha });

    if (alpha > 0.2) {
      gfx.roundRect(offset + 6, offset + 6, tileSize - 12, Math.max(20, tileSize * 0.22), radius - 6);
      gfx.fill({ color: 0xffffff, alpha: 0.14 });
    }

    if (pressed) {
      gfx.roundRect(offset + 4, offset + 4, tileSize - 8, tileSize - 8, radius - 2);
      gfx.fill({ color: 0xffffff, alpha: 0.2 });
    }
  }

  _refreshAll() {
    this._refreshBackgroundLayer();
    this._refreshSongMap();
    this._refreshTiles();
  }

  _refreshBackgroundLayer() {
    if (!this._bgGfx) {
      return;
    }

    const show = this._songMode === 'free';
    this._bgGfx.visible = show;
    if (!show) {
      return;
    }

    this._bgGfx.clear();
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const particleDensity = clamp01(this._dustParticles.length / 140);

    // Base wash stays stable so the field feels calm while particles carry movement.
    this._bgGfx.rect(0, 0, w, h);
    this._bgGfx.fill({ color: lerpColor(0x161a34, this._bgColorCurrent, 0.44), alpha: 0.26 });

    // Very subtle full-screen tint lift as dust density grows.
    this._bgGfx.rect(0, 0, w, h);
    this._bgGfx.fill({ color: lerpColor(0x1a1f3d, this._bgColorTarget, 0.28), alpha: 0.04 + particleDensity * 0.03 });

    for (let i = 0; i < this._dustParticles.length; i++) {
      this._drawDustParticle(this._dustParticles[i]);
    }
  }

  _drawDustParticle(particle) {
    const lifeAlpha = clamp01(particle.life);
    if (lifeAlpha <= 0.01) return;

    const a = particle.alpha * lifeAlpha;
    if (a <= 0.004) return;

    const r = particle.size;
    // Two overlapping soft ellipses, slightly offset, give a tiny organic smear
    // without any recognisable shape.
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
    // Full-circle drift so particles spread in every direction.
    const angle = Math.random() * Math.PI * 2;
    const speed = randRange(0.12, 0.45) * (1 + boost * 0.6);
    // Tiny random offset for the secondary smear ellipse.
    const smearAngle = Math.random() * Math.PI * 2;
    const smearDist = randRange(1, 3);

    this._dustParticles.push({
      x,
      y,
      color,
      // radius: tiny so they read as individual mist particles, not blobs
      size: randRange(1.5, 4.0 + boost * 1.5),
      // squeeze gives an irregular ellipse instead of a perfect circle
      squeeze: randRange(0.55, 1.0),
      // secondary smear offset
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

  _refreshSongMap() {
    const show = this._songMode !== 'free' && !!this._song;
    if (!show) {
      this._songMapCells.forEach((c) => {
        c.gfx.visible = false;
        c.text.visible = false;
      });
      return;
    }

    const total = this._song.steps.length;
    const { block, startX, startY } = this._songMapMetrics();
    const radius = Math.max(8, Math.round(block * 0.2));

    for (let i = 0; i < this._songMapCells.length; i++) {
      const cell = this._songMapCells[i];
      const swIdx = this._song.steps[i];
      const profile = this._profiles.find((p) => p.index === swIdx);
      const col = hexToNumber(profile?.colour || '#888888');
      const noteName = this._song.noteNames[swIdx] || '';

      const row = Math.floor(i / SONG_MAP_PER_ROW);
      const colIdx = i % SONG_MAP_PER_ROW;
      const x = startX + colIdx * (block + SONG_MAP_GAP);
      const y = startY + row * (block + SONG_MAP_GAP);

      const isCurrent = i === this._stepIndex;
      const isDone = i < this._stepIndex;
      const alpha = isCurrent ? 1.0 : (isDone ? 0.45 : 0.88);

      cell.gfx.visible = true;
      cell.text.visible = true;

      cell.gfx.clear();
      if (isCurrent) {
        cell.gfx.roundRect(x - 6, y - 6, block + 12, block + 12, radius + 6);
        cell.gfx.fill({ color: 0xffffff, alpha: 1.0 });
      }
      cell.gfx.roundRect(x, y, block, block, radius);
      cell.gfx.fill({ color: col, alpha });

      cell.text.text = noteName;
      cell.text.alpha = isCurrent ? 1.0 : 0.72;
      cell.text.x = x + block / 2;
      cell.text.y = y + block / 2;
    }
  }

  _baseTileAlpha(tile) {
    if (this._songMode === 'free') {
      return 1.0;
    }
    return tile.hasNote ? 1.0 : 0.18;
  }

  _refreshTiles() {
    const guidedTarget = this._songMode === 'guided'
      ? (this._song?.steps[this._stepIndex] ?? -1)
      : -1;
    const tileSize = this._tileSize();

    for (let i = 0; i < this._tiles.length; i++) {
      const t = this._tiles[i];
      if (t.pulseTimer > 0 || t.hintTimer > 0) {
        continue;
      }

      const alpha = this._baseTileAlpha(t);
      const isTarget = guidedTarget === i;
      this._drawTile(t.gfx, t.colour, tileSize, alpha, false, false, isTarget);
    }
  }

  handleInput(switchProfile, eventType) {
    if (eventType !== 'press') {
      return;
    }

    const now = Date.now();
    const last = this._lastPress.get(switchProfile.key) || 0;
    if (now - last < this._debounceMs) {
      return;
    }
    this._lastPress.set(switchProfile.key, now);

    const idx = switchProfile.index;
    if (idx < 0 || idx >= SWITCH_LAYOUT.length) {
      return;
    }

    if (this._songMode === 'free') {
      const note = this._freePlayNotes[idx];
      if (note?.freq) {
        audioManager.playSongNote(note.freq);
      } else {
        audioManager.playPressSound(idx);
      }

      const tile = this._tiles[idx];
      if (tile) {
        this._bgColorTarget = hexToNumber(tile.colour);
        const tileSize = this._tileSize();
        const tx = this._tileStartX() + idx * (tileSize + TILE_GAP) + tileSize / 2;
        const ty = this._tileY() + tileSize / 2;
        const load = clamp01(this._dustParticles.length / DUST_MAX_PARTICLES);
        const burstCount = Math.round(90 * (1 - load));
        if (burstCount > 0) {
          for (let i = 0; i < burstCount; i++) {
            this._spawnDustParticle({
              x: tx + randRange(-tileSize * 0.48, tileSize * 0.48),
              y: ty + randRange(-tileSize * 0.34, tileSize * 0.34),
              color: hexToNumber(tile.colour),
              boost: 1,
            });
          }
        }
      }

      this._triggerPulse(idx);
      return;
    }

    if (this._songMode === 'rhythm') {
      const si = this._stepIndex % this._song.steps.length;
      const swIdx = this._song.steps[si];
      const freq = this._song.noteMap[swIdx];
      if (freq) {
        audioManager.playSongNote(freq);
      }

      this._triggerPulse(idx);
      this._stepIndex++;
      if (this._stepIndex >= this._song.steps.length) {
        this._stepIndex = 0;
        audioManager.playFanfare();
      }

      this._refreshSongMap();
      return;
    }

    const expected = this._song.steps[this._stepIndex];
    if (idx === expected) {
      const freq = this._song.noteMap[expected];
      if (freq) {
        audioManager.playSongNote(freq);
      }

      this._triggerPulse(idx);
      this._stepIndex++;
      if (this._stepIndex >= this._song.steps.length) {
        this._stepIndex = 0;
        audioManager.playFanfare();
      }

      this._refreshSongMap();
      this._refreshTiles();
    } else {
      this._triggerHint(expected);
    }
  }

  _triggerPulse(tileIndex) {
    if (tileIndex >= this._tiles.length) {
      return;
    }

    const tileSize = this._tileSize();
    const t = this._tiles[tileIndex];
    t.pulseTimer = PULSE_FRAMES;
    this._drawTile(t.gfx, t.colour, tileSize, this._baseTileAlpha(t), true, false, false);
  }

  _triggerHint(tileIndex) {
    if (tileIndex >= this._tiles.length) {
      return;
    }

    const tileSize = this._tileSize();
    const t = this._tiles[tileIndex];
    t.hintTimer = HINT_FRAMES;
    this._drawTile(t.gfx, t.colour, tileSize, 1.0, false, true, false);
  }

  update(delta) {
    if (this._songMode === 'free') {
      const dt = Math.max(0.3, delta);
      this._bgPhase += (dt / 60) * 0.45;

      const t = Math.min(1, (dt / 60) * 0.045);
      this._bgColorCurrent = lerpColor(this._bgColorCurrent, this._bgColorTarget, t);

      // Only spawn when below cap — no overflow culling needed, natural fade cleans up.
      const load = clamp01(this._dustParticles.length / DUST_MAX_PARTICLES);
      if (load < 1) {
        const ambientRate = 8.0 + (18.0 - 8.0) * (1 - load);
        this._dustSpawnCarry += (dt / 60) * ambientRate;
        while (this._dustSpawnCarry >= 1 && this._dustParticles.length < DUST_MAX_PARTICLES) {
          this._spawnAmbientDust(1);
          this._dustSpawnCarry -= 1;
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

      this._refreshBackgroundLayer();
    }

    if (!this._tiles.length) {
      return;
    }

    let needRefresh = false;
    const tileSize = this._tileSize();

    for (let i = 0; i < this._tiles.length; i++) {
      const t = this._tiles[i];
      if (t.pulseTimer > 0) {
        t.pulseTimer -= delta;
        if (t.pulseTimer <= 0) {
          t.pulseTimer = 0;
          needRefresh = true;
        } else {
          this._drawTile(t.gfx, t.colour, tileSize, this._baseTileAlpha(t), true, false, false);
        }
      } else if (t.hintTimer > 0) {
        t.hintTimer -= delta;
        if (t.hintTimer <= 0) {
          t.hintTimer = 0;
          needRefresh = true;
        } else {
          this._drawTile(t.gfx, t.colour, tileSize, 1.0, false, true, false);
        }
      }
    }

    if (needRefresh) {
      this._refreshTiles();
      this._refreshSongMap();
    }
  }

  setSong(id) {
    this._song = getSongById(id);
    this._stepIndex = 0;
    this._rebuildVisuals();
  }

  setSongMode(mode) {
    this._songMode = mode;
    this._stepIndex = 0;
    this._rebuildVisuals();
  }

  setFreePlayNotes(notes) {
    this._freePlayNotes = this._sanitizeFreePlayNotes(notes);
    if (this._songMode === 'free') {
      this._rebuildVisuals();
    }
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
    this._songMapCells = [];
    this._bgGfx = null;
    super.destroy();
  }
}
