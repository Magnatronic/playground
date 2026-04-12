const PRESS_FREQUENCIES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class AudioManager {
  constructor() {
    this._audioContext = null;
    this._masterGain = null;
    this._muted = false;
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

    gainNode.gain.setValueAtTime(0, startAt);
    if (attackSec > 0) {
      gainNode.gain.linearRampToValueAtTime(volume, peakTime);
    } else {
      gainNode.gain.setValueAtTime(volume, startAt);
    }
    gainNode.gain.linearRampToValueAtTime(0.0001, decayEnd);
    gainNode.gain.setValueAtTime(0.0001, stopAt);

    osc.connect(gainNode);
    gainNode.connect(this._masterGain);

    osc.onended = () => {
      osc.disconnect();
      gainNode.disconnect();
    };

    osc.start(startAt);
    osc.stop(stopAt);
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

    const safeIndex = Number.isFinite(switchIndex) ? Math.max(0, Math.min(7, switchIndex | 0)) : 0;
    const freq = PRESS_FREQUENCIES[safeIndex];
    this._playTone(freq, 80, 'sine', 0.2, 5, 65);
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
