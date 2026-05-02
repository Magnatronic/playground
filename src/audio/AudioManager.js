import { appState } from '../app/AppState.js';

// ── Musical scales — each in a distinct pitch register for clear mood contrast ─
const SCALES = {
  // Pentatonic: comfortable middle range — always safe, no wrong notes
  pentatonic: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00],
  // Blues: low/dark bass range — deep and soulful
  blues:      [110.00, 130.81, 146.83, 155.56, 164.81, 196.00, 220.00, 261.63, 293.66, 311.13, 329.63, 392.00, 440.00],
  // Bright (Major): upper mid range — happy and cheerful
  major:      [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51],
  // Heroic (Dorian): wide bass-to-mid range — dramatic and bold
  dorian:     [130.81, 146.83, 155.56, 174.61, 196.00, 220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 466.16, 523.25],
  // Dreamy (Lydian): high ethereal range — floaty and magical
  lydian:     [349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51],
};

// ── Instrument presets ────────────────────────────────────────────────────────
const INSTRUMENTS = {
  bells:     { waveType: 'sine',     attackMs: 5,  decayMs: 1200, durationMs: 1400, volume: 0.25 },
  piano:     { waveType: 'triangle', attackMs: 8,  decayMs: 500,  durationMs: 600,  volume: 0.30 },
  marimba:   { waveType: 'triangle', attackMs: 3,  decayMs: 280,  durationMs: 350,  volume: 0.30 },
  xylophone: { waveType: 'sine',     attackMs: 2,  decayMs: 180,  durationMs: 220,  volume: 0.28 },
  synth:     { waveType: 'sawtooth', attackMs: 10, decayMs: 300,  durationMs: 380,  volume: 0.22 },
};

export class AudioManager {
  constructor() {
    this._audioContext = null;
    this._masterGain = null;
    this._muted = false;
    this._lastNoteIndex = -1; // tracks last played index to avoid immediate repeats
  }

  _ensureContext() {
    if (!this._audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }

      this._audioContext = new AudioContextClass();
      this._masterGain = this._audioContext.createGain();
      this._masterGain.gain.value = this._muted ? 0 : 1;
      this._masterGain.connect(this._audioContext.destination);
    }

    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume().catch(() => {});
    }

    return this._audioContext;
  }

  _playTone(freq, duration, waveType, volume, attackMs, decayMs, startTime = null) {
    const context = this._audioContext;
    if (!context || !this._masterGain) {
      return;
    }

    const osc = context.createOscillator();
    const gainNode = context.createGain();

    const startAt = startTime ?? context.currentTime;
    const durationSec = duration / 1000;
    const attackSec = Math.max(0, attackMs / 1000);
    const decaySec = Math.max(0, decayMs / 1000);
    const peakTime = startAt + attackSec;
    const stopAt = startAt + durationSec;
    const decayEnd = Math.min(stopAt, peakTime + decaySec);

    osc.type = waveType;
    osc.frequency.setValueAtTime(freq, startAt);

    // Small release tail added after decayEnd to prevent click on note cutoff
    const releaseSec = 0.025; // 25 ms soft tail
    const releaseEnd = stopAt + releaseSec;

    gainNode.gain.setValueAtTime(0, startAt);
    if (attackSec > 0) {
      gainNode.gain.linearRampToValueAtTime(volume, peakTime);
    } else {
      gainNode.gain.setValueAtTime(volume, startAt);
    }
    gainNode.gain.linearRampToValueAtTime(0.0001, decayEnd);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, releaseEnd);

    osc.connect(gainNode);
    gainNode.connect(this._masterGain);

    osc.onended = () => {
      osc.disconnect();
      gainNode.disconnect();
    };

    osc.start(startAt);
    osc.stop(releaseEnd);
  }

  _playSequence(notes, intervalMs) {
    const context = this._audioContext;
    if (!context) {
      return;
    }

    const sequenceStart = context.currentTime;

    notes.forEach((note, index) => {
      const startAt = sequenceStart + (index * intervalMs) / 1000;
      this._playTone(
        note.freq,
        note.duration,
        note.waveType,
        note.volume,
        note.attackMs ?? 10,
        note.decayMs ?? Math.max(20, note.duration - 20),
        startAt
      );
    });
  }

  playPressSound(switchIndex) {
    if (this._muted) {
      return;
    }

    const context = this._ensureContext();
    if (!context) {
      return;
    }

    const scaleName      = appState.get('musicScale')      || 'pentatonic';
    const instrumentName = appState.get('musicInstrument') || 'bells';
    const voiceMode      = appState.get('musicVoiceMode')  || 'together';

    const scale      = SCALES[scaleName]      ?? SCALES.pentatonic;
    const instrument = INSTRUMENTS[instrumentName] ?? INSTRUMENTS.bells;
    const noteLengthName = appState.get('musicNoteLength') || 'medium';
    const noteLengthMult = noteLengthName === 'short' ? 0.45 : noteLengthName === 'long' ? 3.0 : 1.0;

    let freq;
    if (voiceMode === 'own') {
      // Each switch maps to a fixed position spread evenly across the scale
      const safeIndex = Number.isFinite(switchIndex) ? Math.max(0, Math.min(7, switchIndex | 0)) : 0;
      freq = scale[Math.round(safeIndex * (scale.length - 1) / 7)];
    } else {
      // Random pick from scale — never repeat the immediately previous note
      let idx = Math.floor(Math.random() * scale.length);
      if (scale.length > 1 && idx === this._lastNoteIndex) {
        idx = (idx + 1 + Math.floor(Math.random() * (scale.length - 1))) % scale.length;
      }
      this._lastNoteIndex = idx;
      freq = scale[idx];
    }

    this._playTone(
      freq,
      instrument.durationMs * noteLengthMult,
      instrument.waveType,
      instrument.volume,
      instrument.attackMs,
      instrument.decayMs * noteLengthMult,
    );
  }

  playFanfare() {
    if (this._muted) {
      return;
    }

    const context = this._ensureContext();
    if (!context) {
      return;
    }

    // Grand ascending arpeggio: C5->E5->G5->C6->E6->G6, with a held final chord
    const arpeggio = [
      { freq: 523.25, duration: 200, waveType: 'triangle', volume: 0.35, attackMs: 10, decayMs: 180 },
      { freq: 659.25, duration: 200, waveType: 'triangle', volume: 0.38, attackMs: 10, decayMs: 180 },
      { freq: 783.99, duration: 200, waveType: 'triangle', volume: 0.40, attackMs: 10, decayMs: 180 },
      { freq: 1046.50, duration: 250, waveType: 'triangle', volume: 0.42, attackMs: 10, decayMs: 230 },
      { freq: 1318.51, duration: 300, waveType: 'triangle', volume: 0.45, attackMs: 10, decayMs: 280 },
      { freq: 1567.98, duration: 500, waveType: 'triangle', volume: 0.45, attackMs: 10, decayMs: 480 },
    ];

    this._playSequence(arpeggio, 160);

    // Layer a sustained chord on top for richness (starts after arpeggio)
    const chordDelay = (arpeggio.length * 160) / 1000;
    const chordStart = context.currentTime + chordDelay;
    const chordNotes = [523.25, 783.99, 1318.51]; // C5, G5, E6 open voicing
    chordNotes.forEach((freq) => {
      this._playTone(freq, 800, 'sine', 0.2, 20, 750, chordStart);
    });
  }

  resetMelody() {
    this._lastNoteIndex = -1;
  }

  // Play a specific frequency directly — used by Song Mode to play exact song pitches
  // regardless of the current scale setting.
  playSongNote(freq) {
    if (this._muted || !freq) return;
    const context = this._ensureContext();
    if (!context) return;
    const instrumentName = appState.get('musicInstrument') || 'bells';
    const noteLengthName = appState.get('musicNoteLength') || 'medium';
    const instrument     = INSTRUMENTS[instrumentName] ?? INSTRUMENTS.bells;
    const mult = noteLengthName === 'short' ? 0.45 : noteLengthName === 'long' ? 3.0 : 1.0;
    this._playTone(freq, instrument.durationMs * mult, instrument.waveType, instrument.volume, instrument.attackMs, instrument.decayMs * mult);
  }

  toggleMute() {
    this._muted = !this._muted;

    if (this._masterGain) {
      this._masterGain.gain.value = this._muted ? 0 : 1;
    }

    return this._muted;
  }

  isMuted() {
    return this._muted;
  }
}

export const audioManager = new AudioManager();
