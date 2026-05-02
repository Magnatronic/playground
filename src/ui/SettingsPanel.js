import { appState } from '../app/AppState.js';
import { iconClose, iconChevronDown, iconChevronUp } from './icons.js';
import { createToggle } from './components/ToggleButton.js';
import { createSlider } from './components/SliderControl.js';
import { createOptionGroup } from './components/OptionGroup.js';
import { createColourSwatch } from './components/ColourSwatch.js';
import { SONGS } from '../activities/song/songs.js';

const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);
const FREE_PLAY_SWITCH_LABELS = ['Space', 'Enter', '\u2191', '\u2193', '\u2190', '\u2192'];
const FREE_PLAY_NOTE_OPTIONS = [
  { name: 'C', freq: 261.63 },
  { name: 'C#', freq: 277.18 },
  { name: 'D', freq: 293.66 },
  { name: 'D#', freq: 311.13 },
  { name: 'E', freq: 329.63 },
  { name: 'F', freq: 349.23 },
  { name: 'F#', freq: 369.99 },
  { name: 'G', freq: 392.0 },
  { name: 'G#', freq: 415.3 },
  { name: 'A', freq: 440.0 },
  { name: 'A#', freq: 466.16 },
  { name: 'B', freq: 493.88 },
];

function findFreePlayNoteByName(name) {
  return FREE_PLAY_NOTE_OPTIONS.find((n) => n.name === name) || FREE_PLAY_NOTE_OPTIONS[0];
}

export class SettingsPanel {
  constructor({ onClose }) {
    this.onClose = onClose;
    this.el = null;
    this.backdrop = null;
    this._sections = {};
    this._visibleSections = [];
    this._unsubscribers = [];
    this._activeColourPicker = null;
    this._freePlayNoteSelects = [];
    this._freePlayNoteSwatches = [];
  }

  mount(parent) {
    // Backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'pg-settings-backdrop';
    this.backdrop.addEventListener('click', () => this._close());
    parent.appendChild(this.backdrop);

    // Panel
    this.el = document.createElement('div');
    this.el.className = 'pg-settings';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Settings');

    // Switch safety
    this.el.addEventListener('keydown', (e) => {
      if (SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Header
    const header = document.createElement('div');
    header.className = 'pg-settings__header';

    const title = document.createElement('h2');
    title.className = 'pg-settings__title';
    title.textContent = 'Settings';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pg-settings__close';
    closeBtn.setAttribute('aria-label', 'Close settings');
    closeBtn.setAttribute('tabindex', '-1');
    closeBtn.innerHTML = iconClose();
    closeBtn.querySelector('svg').setAttribute('aria-hidden', 'true');
    closeBtn.addEventListener('click', () => this._close());

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.el.appendChild(header);

    // Scrollable body
    this._body = document.createElement('div');
    this._body.className = 'pg-settings__body';
    this.el.appendChild(this._body);

    // Build all sections
    this._buildSections();

    parent.appendChild(this.el);
  }

  _buildSections() {
    this._sections.sound = this._createSection('Sound', this._buildSoundContent(), true);
    this._sections.soundSong = this._createSection('Sound', this._buildSongSoundContent(), true);
    this._sections.positionMode = this._createSection('Position Mode', this._buildPositionModeContent(), true);
    this._sections.effectType = this._createSection('Effect Type', this._buildEffectTypeContent(), true);
    this._sections.effectSettings = this._createSection('Effect Settings', this._buildEffectSettingsContent(), true);
    this._sections.blendMode = this._createSection('Blend Mode', this._buildBlendModeContent(), true);
    this._sections.fillMode = this._createSection('Fill Mode', this._buildFillModeContent(), true);
    this._sections.songSelect = this._createSection('Song', this._buildSongSelectContent(), true);
    this._sections.songMode = this._createSection('Play Mode', this._buildSongModeContent(), true);
    this._sections.freePlayNotes = this._createSection('Free Play Notes', this._buildFreePlayNotesContent(), true);
    this._sections.switches = this._createSection('Switches', this._buildSwitchesContent(), false);
    this._sections.actions = this._createSection('Actions', this._buildActionsContent(), true);

    Object.values(this._sections).forEach((section) => {
      this._body.appendChild(section.el);
    });
  }

  _createSection(title, contentEl, expandedByDefault) {
    const section = document.createElement('div');
    section.className = 'pg-section';

    const toggle = document.createElement('button');
    toggle.className = 'pg-section__toggle';
    toggle.setAttribute('tabindex', '-1');
    toggle.setAttribute('aria-expanded', String(expandedByDefault));

    const titleSpan = document.createElement('span');
    titleSpan.textContent = title;

    const chevron = document.createElement('span');
    chevron.innerHTML = expandedByDefault ? iconChevronUp() : iconChevronDown();

    toggle.appendChild(titleSpan);
    toggle.appendChild(chevron);

    const content = document.createElement('div');
    content.className = 'pg-section__content' + (expandedByDefault ? '' : ' pg-section__content--collapsed');

    if (contentEl) content.appendChild(contentEl);

    toggle.addEventListener('click', () => {
      const expanded = content.classList.contains('pg-section__content--collapsed');
      content.classList.toggle('pg-section__content--collapsed', !expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      chevron.innerHTML = expanded ? iconChevronUp() : iconChevronDown();
    });

    section.appendChild(toggle);
    section.appendChild(content);

    return { el: section, content };
  }

  _buildSoundContent() {
    const container = document.createElement('div');

    this._muteToggle = createToggle({
      label: 'Mute',
      value: appState.get('muted'),
      onChange: (v) => appState.set('muted', v),
    });
    container.appendChild(this._muteToggle);

    const sep = () => { const d = document.createElement('div'); d.style.marginTop = '14px'; return d; };

    this._musicScaleGroup = createOptionGroup({
      label: 'Scale / Mood',
      options: [
        { value: 'pentatonic', label: 'Pentatonic' },
        { value: 'blues',      label: 'Blues' },
        { value: 'major',      label: 'Bright (Major)' },
        { value: 'dorian',     label: 'Heroic (Dorian)' },
        { value: 'lydian',     label: 'Dreamy (Lydian)' },
      ],
      selected: appState.get('musicScale'),
      onChange: (v) => appState.set('musicScale', v),
    });
    const scaleWrap = sep();
    scaleWrap.appendChild(this._musicScaleGroup);
    container.appendChild(scaleWrap);

    this._musicInstrumentGroup = createOptionGroup({
      label: 'Instrument',
      options: [
        { value: 'bells',     label: 'Bells' },
        { value: 'piano',     label: 'Piano' },
        { value: 'marimba',   label: 'Marimba' },
        { value: 'xylophone', label: 'Xylophone' },
        { value: 'synth',     label: 'Synth' },
      ],
      selected: appState.get('musicInstrument'),
      onChange: (v) => appState.set('musicInstrument', v),
    });
    const instrWrap = sep();
    instrWrap.appendChild(this._musicInstrumentGroup);
    container.appendChild(instrWrap);

    this._musicVoiceModeGroup = createOptionGroup({
      label: 'How sounds work',
      options: [
        { value: 'together', label: 'Together (shared melody)' },
        { value: 'own',      label: 'Own Note (per switch)' },
      ],
      selected: appState.get('musicVoiceMode'),
      onChange: (v) => appState.set('musicVoiceMode', v),
    });
    const voiceWrap = sep();
    voiceWrap.appendChild(this._musicVoiceModeGroup);
    container.appendChild(voiceWrap);

    this._musicNoteLengthGroup = createOptionGroup({
      label: 'Note length',
      options: [
        { value: 'short',  label: 'Short' },
        { value: 'medium', label: 'Medium' },
        { value: 'long',   label: 'Long' },
      ],
      selected: appState.get('musicNoteLength'),
      onChange: (v) => appState.set('musicNoteLength', v),
    });
    const noteLenWrap = sep();
    noteLenWrap.appendChild(this._musicNoteLengthGroup);
    container.appendChild(noteLenWrap);

    // Keep UI in sync when defaults are reset
    this._unsubscribers.push(
      appState.subscribe('musicScale',      (v) => this._musicScaleGroup.setValue(v)),
      appState.subscribe('musicInstrument', (v) => this._musicInstrumentGroup.setValue(v)),
      appState.subscribe('musicVoiceMode',  (v) => this._musicVoiceModeGroup.setValue(v)),
      appState.subscribe('musicNoteLength', (v) => this._musicNoteLengthGroup.setValue(v)),
    );

    return container;
  }

  _buildPositionModeContent() {
    const container = document.createElement('div');

    this._positionModeGroup = createOptionGroup({
      label: 'Mode',
      options: [
        { value: 'random', label: 'Random' },
        { value: 'cursor', label: 'Cursor' },
        { value: 'sweep', label: 'Sweep' },
      ],
      selected: appState.get('positionMode'),
      onChange: (v) => {
        appState.set('positionMode', v);
        this._updateSweepVisibility();
      },
    });
    container.appendChild(this._positionModeGroup);

    // Sweep sub-options
    this._sweepOptions = document.createElement('div');
    this._sweepOptions.style.marginTop = '12px';

    this._sweepSpeedSlider = createSlider({
      label: 'Sweep Speed',
      min: 1,
      max: 10,
      step: 1,
      value: appState.get('sweepSpeed'),
      onChange: (v) => appState.set('sweepSpeed', v),
    });
    this._sweepOptions.appendChild(this._sweepSpeedSlider);

    this._sweepPatternGroup = createOptionGroup({
      label: 'Sweep Pattern',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
        { value: 'bounce', label: 'Bounce' },
        { value: 'systematic', label: 'Systematic' },
      ],
      selected: appState.get('sweepPattern'),
      onChange: (v) => appState.set('sweepPattern', v),
    });
    this._sweepOptions.appendChild(this._sweepPatternGroup);

    container.appendChild(this._sweepOptions);
    this._updateSweepVisibility();

    return container;
  }

  _updateSweepVisibility() {
    if (this._sweepOptions) {
      this._sweepOptions.style.display = appState.get('positionMode') === 'sweep' ? '' : 'none';
    }
  }

  _buildEffectTypeContent() {
    const container = document.createElement('div');
    this._effectTypeGroup = createOptionGroup({
      options: [
        { value: 'solid', label: 'Solid Circle' },
        { value: 'brush', label: 'Soft Brush' },
        { value: 'smoke', label: 'Smoke' },
        { value: 'firework', label: 'Firework' },
        { value: 'splat', label: 'Splat (Paint Toss)' },
      ],
      selected: appState.get('effectType'),
      onChange: (v) => appState.set('effectType', v),
    });
    container.appendChild(this._effectTypeGroup);
    return container;
  }

  _buildEffectSettingsContent() {
    const container = document.createElement('div');

    this._effectSizeSlider = createSlider({
      label: 'Size',
      min: 10,
      max: 80,
      step: 5,
      value: appState.get('effectSize'),
      unit: 'px',
      onChange: (v) => appState.set('effectSize', v),
    });
    container.appendChild(this._effectSizeSlider);

    this._effectOpacitySlider = createSlider({
      label: 'Opacity',
      min: 0.1,
      max: 1.0,
      step: 0.1,
      value: appState.get('effectOpacity'),
      onChange: (v) => appState.set('effectOpacity', v),
    });
    container.appendChild(this._effectOpacitySlider);

    this._effectScatterSlider = createSlider({
      label: 'Scatter',
      min: 0,
      max: 60,
      step: 5,
      value: appState.get('effectScatter'),
      unit: 'px',
      onChange: (v) => appState.set('effectScatter', v),
    });
    container.appendChild(this._effectScatterSlider);

    return container;
  }

  _buildBlendModeContent() {
    const container = document.createElement('div');
    this._blendModeGroup = createOptionGroup({
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'add', label: 'Add' },
        { value: 'multiply', label: 'Multiply' },
        { value: 'screen', label: 'Screen' },
      ],
      selected: appState.get('blendMode'),
      onChange: (v) => appState.set('blendMode', v),
    });
    container.appendChild(this._blendModeGroup);
    return container;
  }

  _buildFillModeContent() {
    const container = document.createElement('div');

    this._fillModeGroup = createOptionGroup({
      label: 'Fill Mode',
      options: [
        { value: 'bars', label: 'Bars' },
        { value: 'mosaic', label: 'Mosaic' },
      ],
      selected: appState.get('fillMode'),
      onChange: (v) => {
        appState.set('fillMode', v);
        this._updateFillSubOptions();
      },
    });
    container.appendChild(this._fillModeGroup);

    // Bars sub-options
    this._barsOptions = document.createElement('div');
    this._barsOptions.style.marginTop = '12px';

    this._barOrientationGroup = createOptionGroup({
      label: 'Bar Orientation',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'vertical', label: 'Vertical' },
        { value: 'random', label: 'Random' },
      ],
      selected: appState.get('barOrientation'),
      onChange: (v) => appState.set('barOrientation', v),
    });
    this._barsOptions.appendChild(this._barOrientationGroup);

    this._barThicknessSlider = createSlider({
      label: 'Bar Thickness',
      min: 10,
      max: 80,
      step: 5,
      value: appState.get('barThickness'),
      unit: 'px',
      onChange: (v) => appState.set('barThickness', v),
    });
    this._barsOptions.appendChild(this._barThicknessSlider);

    container.appendChild(this._barsOptions);

    // Mosaic sub-options
    this._mosaicOptions = document.createElement('div');
    this._mosaicOptions.style.marginTop = '12px';

    this._tilePatternGroup = createOptionGroup({
      label: 'Tile Pattern',
      options: [
        { value: 'squares', label: 'Square' },
        { value: 'hexagons', label: 'Hexagon' },
        { value: 'triangles', label: 'Triangle' },
        { value: 'bricks', label: 'Brick' },
      ],
      selected: appState.get('tilePattern'),
      onChange: (v) => appState.set('tilePattern', v),
    });
    this._mosaicOptions.appendChild(this._tilePatternGroup);

    this._tileSizeSlider = createSlider({
      label: 'Tile Size',
      min: 15,
      max: 120,
      step: 5,
      value: appState.get('tileSize'),
      unit: 'px',
      onChange: (v) => appState.set('tileSize', v),
    });
    this._mosaicOptions.appendChild(this._tileSizeSlider);

    container.appendChild(this._mosaicOptions);

    this._updateFillSubOptions();

    return container;
  }

  _updateFillSubOptions() {
    const mode = appState.get('fillMode');
    if (this._barsOptions) this._barsOptions.style.display = mode === 'bars' ? '' : 'none';
    if (this._mosaicOptions) this._mosaicOptions.style.display = mode === 'mosaic' ? '' : 'none';
  }

  _buildSongSoundContent() {
    // Streamlined sound section for Song Mode — no scale or voice mode (songs have fixed pitches)
    const container = document.createElement('div');

    this._songMuteToggle = createToggle({
      label: 'Mute',
      value: appState.get('muted'),
      onChange: (v) => appState.set('muted', v),
    });
    container.appendChild(this._songMuteToggle);

    const sep = () => { const d = document.createElement('div'); d.style.marginTop = '14px'; return d; };

    this._songInstrumentGroup = createOptionGroup({
      label: 'Instrument',
      options: [
        { value: 'bells',     label: 'Bells' },
        { value: 'piano',     label: 'Piano' },
        { value: 'marimba',   label: 'Marimba' },
        { value: 'xylophone', label: 'Xylophone' },
        { value: 'synth',     label: 'Synth' },
      ],
      selected: appState.get('musicInstrument'),
      onChange: (v) => appState.set('musicInstrument', v),
    });
    const instrWrap = sep();
    instrWrap.appendChild(this._songInstrumentGroup);
    container.appendChild(instrWrap);

    this._songNoteLengthGroup = createOptionGroup({
      label: 'Note length',
      options: [
        { value: 'short',  label: 'Short' },
        { value: 'medium', label: 'Medium' },
        { value: 'long',   label: 'Long' },
      ],
      selected: appState.get('musicNoteLength'),
      onChange: (v) => appState.set('musicNoteLength', v),
    });
    const noteLenWrap = sep();
    noteLenWrap.appendChild(this._songNoteLengthGroup);
    container.appendChild(noteLenWrap);

    this._unsubscribers.push(
      appState.subscribe('muted',           (v) => this._songMuteToggle.setValue(v)),
      appState.subscribe('musicInstrument', (v) => this._songInstrumentGroup.setValue(v)),
      appState.subscribe('musicNoteLength', (v) => this._songNoteLengthGroup.setValue(v)),
    );

    return container;
  }

  _buildSongSelectContent() {
    const container = document.createElement('div');

    this._songSelectGroup = createOptionGroup({
      label: 'Choose a song',
      options: SONGS.map((s) => ({ value: s.id, label: s.name })),
      selected: appState.get('songId'),
      onChange: (v) => appState.set('songId', v),
    });
    container.appendChild(this._songSelectGroup);

    this._unsubscribers.push(
      appState.subscribe('songId', (v) => this._songSelectGroup.setValue(v)),
    );

    return container;
  }

  _buildSongModeContent() {
    const container = document.createElement('div');

    this._songModeGroup = createOptionGroup({
      label: 'How to play',
      options: [
        { value: 'rhythm',  label: 'Rhythm Tap \u2014 any switch, right notes' },
        { value: 'guided',  label: 'Guided \u2014 press the correct colour' },
        { value: 'free',    label: 'Free Play \u2014 explore the notes' },
      ],
      selected: appState.get('songMode'),
      onChange: (v) => appState.set('songMode', v),
    });
    container.appendChild(this._songModeGroup);

    this._unsubscribers.push(
      appState.subscribe('songMode', (v) => this._songModeGroup.setValue(v)),
    );

    return container;
  }

  _buildFreePlayNotesContent() {
    const container = document.createElement('div');
    this._freePlayNoteSelects = [];
    this._freePlayNoteSwatches = [];

    const notes = appState.get('freePlayNotes') || [];
    const profiles = appState.get('switchProfiles') || [];

    for (let i = 0; i < FREE_PLAY_SWITCH_LABELS.length; i++) {
      const row = document.createElement('div');
      row.className = 'pg-free-note-row';

      const profile = profiles.find((p) => p.index === i);
      const swatch = document.createElement('span');
      swatch.className = 'pg-free-note-row__swatch';
      swatch.style.backgroundColor = profile?.colour || '#888888';
      this._freePlayNoteSwatches.push(swatch);

      const label = document.createElement('span');
      label.className = 'pg-free-note-row__label';
      label.textContent = FREE_PLAY_SWITCH_LABELS[i];

      const select = document.createElement('select');
      select.className = 'pg-free-note-row__select';
      select.setAttribute('tabindex', '-1');
      FREE_PLAY_NOTE_OPTIONS.forEach((note) => {
        const option = document.createElement('option');
        option.value = note.name;
        option.textContent = note.name;
        select.appendChild(option);
      });

      const selectedName = notes[i]?.name || FREE_PLAY_NOTE_OPTIONS[i % FREE_PLAY_NOTE_OPTIONS.length].name;
      select.value = selectedName;
      select.addEventListener('change', () => {
        const next = (appState.get('freePlayNotes') || []).slice(0, FREE_PLAY_SWITCH_LABELS.length);
        while (next.length < FREE_PLAY_SWITCH_LABELS.length) {
          const fb = FREE_PLAY_NOTE_OPTIONS[next.length % FREE_PLAY_NOTE_OPTIONS.length];
          next.push({ name: fb.name, freq: fb.freq });
        }

        const note = findFreePlayNoteByName(select.value);
        next[i] = { name: note.name, freq: note.freq };
        appState.set('freePlayNotes', next);
      });
      select.addEventListener('keydown', (e) => {
        if (SWITCH_KEYS.has(e.code)) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      this._freePlayNoteSelects.push(select);

      row.appendChild(swatch);
      row.appendChild(label);
      row.appendChild(select);
      container.appendChild(row);
    }

    this._unsubscribers.push(
      appState.subscribe('freePlayNotes', () => this._syncFreePlayNoteControls()),
      appState.subscribe('switchProfiles', () => this._syncFreePlayNoteSwatches()),
    );

    return container;
  }

  _syncFreePlayNoteControls() {
    const notes = appState.get('freePlayNotes') || [];
    this._freePlayNoteSelects.forEach((select, i) => {
      if (!select) return;
      const noteName = notes[i]?.name;
      if (noteName) {
        select.value = noteName;
      }
    });
  }

  _syncFreePlayNoteSwatches() {
    const profiles = appState.get('switchProfiles') || [];
    this._freePlayNoteSwatches.forEach((swatch, i) => {
      if (!swatch) return;
      const profile = profiles.find((p) => p.index === i);
      swatch.style.backgroundColor = profile?.colour || '#888888';
    });
  }

  _buildSwitchesContent() {
    const container = document.createElement('div');
    this._switchRows = [];

    const profiles = appState.get('switchProfiles');
    if (!profiles || profiles.length === 0) return container;

    profiles.forEach((profile, idx) => {
      const row = document.createElement('div');
      row.className = 'pg-switch-row';

      const label = document.createElement('span');
      label.className = 'pg-switch-row__label';
      label.textContent = profile.label;

      const colourBtn = document.createElement('div');
      colourBtn.className = 'pg-switch-row__colour';
      colourBtn.style.backgroundColor = profile.colour;
      colourBtn.setAttribute('tabindex', '-1');
      colourBtn.setAttribute('role', 'button');
      colourBtn.setAttribute('aria-label', `Change colour for ${profile.label}`);

      // Colour picker popup
      let pickerEl = null;
      colourBtn.addEventListener('click', () => {
        // Close any existing picker
        if (this._activeColourPicker) {
          this._activeColourPicker.remove();
          this._activeColourPicker = null;
        }

        pickerEl = document.createElement('div');
        pickerEl.style.cssText = 'padding: 8px 0;';
        const swatch = createColourSwatch({
          selected: profile.colour,
          onChange: (colour) => {
            profile.colour = colour;
            colourBtn.style.backgroundColor = colour;
            appState.set('switchProfiles', [...appState.get('switchProfiles')]);
            pickerEl.remove();
            this._activeColourPicker = null;
          },
        });
        pickerEl.appendChild(swatch);
        row.parentNode.insertBefore(pickerEl, row.nextSibling);
        this._activeColourPicker = pickerEl;
      });

      const sliderContainer = document.createElement('div');
      sliderContainer.className = 'pg-switch-row__slider';
      const slider = createSlider({
        label: 'Impact',
        min: 0.5,
        max: 3.0,
        step: 0.1,
        value: profile.impactMultiplier,
        onChange: (v) => {
          profile.impactMultiplier = v;
          appState.set('switchProfiles', [...appState.get('switchProfiles')]);
        },
      });
      sliderContainer.appendChild(slider);

      row.appendChild(label);
      row.appendChild(colourBtn);
      row.appendChild(sliderContainer);
      container.appendChild(row);

      this._switchRows.push({ row, colourBtn, profile });
    });

    return container;
  }

  _buildActionsContent() {
    const container = document.createElement('div');
    container.className = 'pg-actions';

    const resetBtn = document.createElement('button');
    resetBtn.className = 'pg-action-btn';
    resetBtn.textContent = 'Reset Defaults';
    resetBtn.setAttribute('tabindex', '-1');
    resetBtn.addEventListener('click', () => {
      appState.set('_action', 'resetDefaults');
      this._refreshAllControls();
    });

    container.appendChild(resetBtn);
    return container;
  }

  _refreshAllControls() {
    if (this._muteToggle) this._muteToggle.setValue(appState.get('muted'));
    if (this._positionModeGroup) this._positionModeGroup.setValue(appState.get('positionMode'));
    if (this._sweepSpeedSlider) this._sweepSpeedSlider.setValue(appState.get('sweepSpeed'));
    if (this._sweepPatternGroup) this._sweepPatternGroup.setValue(appState.get('sweepPattern'));
    if (this._effectTypeGroup) this._effectTypeGroup.setValue(appState.get('effectType'));
    if (this._effectSizeSlider) this._effectSizeSlider.setValue(appState.get('effectSize'));
    if (this._effectOpacitySlider) this._effectOpacitySlider.setValue(appState.get('effectOpacity'));
    if (this._effectScatterSlider) this._effectScatterSlider.setValue(appState.get('effectScatter'));
    if (this._blendModeGroup) this._blendModeGroup.setValue(appState.get('blendMode'));
    if (this._fillModeGroup) this._fillModeGroup.setValue(appState.get('fillMode'));
    if (this._barOrientationGroup) this._barOrientationGroup.setValue(appState.get('barOrientation'));
    if (this._barThicknessSlider) this._barThicknessSlider.setValue(appState.get('barThickness'));
    if (this._tilePatternGroup) this._tilePatternGroup.setValue(appState.get('tilePattern'));
    if (this._tileSizeSlider) this._tileSizeSlider.setValue(appState.get('tileSize'));
    this._syncFreePlayNoteControls();
    this._syncFreePlayNoteSwatches();
    this._updateSweepVisibility();
    this._updateFillSubOptions();
  }

  open(settingsSections) {
    this._visibleSections = settingsSections || [];

    // Show/hide sections based on what the activity needs
    Object.entries(this._sections).forEach(([key, section]) => {
      section.el.style.display = this._visibleSections.includes(key) ? '' : 'none';
    });

    // Refresh control values from AppState
    this._refreshAllControls();

    // Show
    if (this.backdrop) this.backdrop.classList.add('pg-settings-backdrop--visible');
    if (this.el) this.el.classList.add('pg-settings--visible');
  }

  _hide() {
    if (this.backdrop) this.backdrop.classList.remove('pg-settings-backdrop--visible');
    if (this.el) this.el.classList.remove('pg-settings--visible');

    // Close any open colour picker
    if (this._activeColourPicker) {
      this._activeColourPicker.remove();
      this._activeColourPicker = null;
    }
  }

  /** Called by user actions (close button, backdrop click). Notifies AppShell. */
  _close() {
    this._hide();
    if (this.onClose) this.onClose();
  }

  /** Called externally by AppShell during transitions. Does NOT call onClose. */
  close() {
    this._hide();
  }

  isOpen() {
    return this.el ? this.el.classList.contains('pg-settings--visible') : false;
  }

  unmount() {
    this._unsubscribers.forEach((unsub) => unsub());
    this._unsubscribers = [];

    if (this.backdrop && this.backdrop.parentNode) {
      this.backdrop.parentNode.removeChild(this.backdrop);
    }
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.backdrop = null;
    this.el = null;
    this._body = null;
    this._sections = {};
  }
}
