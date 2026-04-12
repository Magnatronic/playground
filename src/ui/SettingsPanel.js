import { appState } from '../app/AppState.js';
import { iconClose, iconChevronDown, iconChevronUp } from './icons.js';
import { createToggle } from './components/ToggleButton.js';
import { createSlider } from './components/SliderControl.js';
import { createOptionGroup } from './components/OptionGroup.js';
import { createColourSwatch } from './components/ColourSwatch.js';

const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

export class SettingsPanel {
  constructor({ onClose }) {
    this.onClose = onClose;
    this.el = null;
    this.backdrop = null;
    this._sections = {};
    this._visibleSections = [];
    this._unsubscribers = [];
    this._activeColourPicker = null;
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
    this._sections.positionMode = this._createSection('Position Mode', this._buildPositionModeContent(), true);
    this._sections.effectType = this._createSection('Effect Type', this._buildEffectTypeContent(), true);
    this._sections.effectSettings = this._createSection('Effect Settings', this._buildEffectSettingsContent(), true);
    this._sections.blendMode = this._createSection('Blend Mode', this._buildBlendModeContent(), true);
    this._sections.fillMode = this._createSection('Fill Mode', this._buildFillModeContent(), true);
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
        { value: 'starburst', label: 'Starburst' },
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
        { value: 'standard', label: 'Standard' },
        { value: 'mosaic', label: 'Mosaic' },
      ],
      selected: appState.get('fillMode'),
      onChange: (v) => {
        appState.set('fillMode', v);
        this._updateFillSubOptions();
      },
    });
    container.appendChild(this._fillModeGroup);

    // Standard sub-options
    this._standardOptions = document.createElement('div');
    this._standardOptions.style.marginTop = '12px';

    this._shapeAssignmentGroup = createOptionGroup({
      label: 'Shape Assignment',
      options: [
        { value: 'per-switch', label: 'Per Switch' },
        { value: 'global', label: 'Global' },
        { value: 'random', label: 'Random' },
      ],
      selected: appState.get('shapeAssignment'),
      onChange: (v) => appState.set('shapeAssignment', v),
    });
    this._standardOptions.appendChild(this._shapeAssignmentGroup);

    this._stampSizeSlider = createSlider({
      label: 'Stamp Size',
      min: 10,
      max: 80,
      step: 10,
      value: appState.get('stampSize'),
      unit: 'px',
      onChange: (v) => appState.set('stampSize', v),
    });
    this._standardOptions.appendChild(this._stampSizeSlider);

    container.appendChild(this._standardOptions);

    // Mosaic sub-options
    this._mosaicOptions = document.createElement('div');
    this._mosaicOptions.style.marginTop = '12px';

    this._tilePatternGroup = createOptionGroup({
      label: 'Tile Pattern',
      options: [
        { value: 'square', label: 'Square' },
        { value: 'hex', label: 'Hexagon' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'brick', label: 'Brick' },
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
    if (this._standardOptions) this._standardOptions.style.display = mode === 'standard' ? '' : 'none';
    if (this._mosaicOptions) this._mosaicOptions.style.display = mode === 'mosaic' ? '' : 'none';
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

    const clearBtn = document.createElement('button');
    clearBtn.className = 'pg-action-btn pg-action-btn--danger';
    clearBtn.textContent = 'Clear Canvas';
    clearBtn.setAttribute('tabindex', '-1');
    clearBtn.addEventListener('click', () => {
      appState.set('_action', 'clear');
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'pg-action-btn';
    resetBtn.textContent = 'Reset Defaults';
    resetBtn.setAttribute('tabindex', '-1');
    resetBtn.addEventListener('click', () => {
      appState.set('_action', 'resetDefaults');
      this._refreshAllControls();
    });

    container.appendChild(clearBtn);
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
    if (this._shapeAssignmentGroup) this._shapeAssignmentGroup.setValue(appState.get('shapeAssignment'));
    if (this._stampSizeSlider) this._stampSizeSlider.setValue(appState.get('stampSize'));
    if (this._tilePatternGroup) this._tilePatternGroup.setValue(appState.get('tilePattern'));
    if (this._tileSizeSlider) this._tileSizeSlider.setValue(appState.get('tileSize'));
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
