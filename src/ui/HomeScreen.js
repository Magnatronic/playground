import { activityRegistry } from '../app/ActivityRegistry.js';
import { appState } from '../app/AppState.js';
import { createColourSwatch } from './components/ColourSwatch.js';
import { createSlider } from './components/SliderControl.js';
import { iconBrush, iconTarget, iconMusic, iconChevronDown, iconChevronUp } from './icons.js';

const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

const ICON_MAP = {
  brush: iconBrush,
  target: iconTarget,
  music: iconMusic,
};

export class HomeScreen {
  constructor({ onActivitySelected }) {
    this.onActivitySelected = onActivitySelected;
    this.el = null;
  }

  mount(parent) {
    this.el = document.createElement('div');
    this.el.className = 'pg-home';

    // Switch safety
    this.el.addEventListener('keydown', (e) => {
      if (SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    const title = document.createElement('h1');
    title.className = 'pg-home__title';
    title.textContent = 'Playground';
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'pg-home__grid';

    activityRegistry.forEach((activity) => {
      const card = document.createElement('div');
      card.className = 'pg-home__card';
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', activity.name);
      card.setAttribute('tabindex', '-1');

      const iconContainer = document.createElement('div');
      iconContainer.className = 'pg-home__card-icon';
      const iconFn = ICON_MAP[activity.icon];
      if (iconFn) {
        iconContainer.innerHTML = iconFn();
        const svg = iconContainer.querySelector('svg');
        if (svg) svg.setAttribute('aria-hidden', 'true');
      }
      card.appendChild(iconContainer);

      const name = document.createElement('div');
      name.className = 'pg-home__card-name';
      name.textContent = activity.name;
      card.appendChild(name);

      const desc = document.createElement('div');
      desc.className = 'pg-home__card-desc';
      desc.textContent = activity.description;
      card.appendChild(desc);

      card.addEventListener('click', () => {
        if (this.onActivitySelected) {
          this.onActivitySelected(activity.id);
        }
      });

      grid.appendChild(card);
    });

    // Switches section (collapsible) — above cards so it doesn't get pushed off
    const switchSection = this._buildSwitchSection();
    this.el.appendChild(switchSection);

    this.el.appendChild(grid);

    parent.appendChild(this.el);

    // Trigger visibility transition
    requestAnimationFrame(() => {
      this.el.classList.add('pg-home--visible');
    });
  }

  _buildSwitchSection() {
    const section = document.createElement('div');
    section.className = 'pg-section pg-home__switches';

    const toggle = document.createElement('button');
    toggle.className = 'pg-section__toggle';
    toggle.setAttribute('tabindex', '-1');
    toggle.innerHTML = `<span>Switches</span>${iconChevronDown()}`;

    const content = document.createElement('div');
    content.className = 'pg-section__content pg-section__content--collapsed';

    this._switchRows = [];
    this._activeColourPicker = null;

    const profiles = appState.get('switchProfiles');
    if (profiles && profiles.length > 0) {
      profiles.forEach((profile) => {
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

        colourBtn.addEventListener('click', () => {
          if (this._activeColourPicker) {
            this._activeColourPicker.remove();
            this._activeColourPicker = null;
          }

          const pickerEl = document.createElement('div');
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
        content.appendChild(row);

        this._switchRows.push({ row, colourBtn, slider, profile });
      });
    }

    toggle.addEventListener('click', () => {
      const collapsed = content.classList.toggle('pg-section__content--collapsed');
      toggle.innerHTML = `<span>Switches</span>${collapsed ? iconChevronDown() : iconChevronUp()}`;
    });

    section.appendChild(toggle);
    section.appendChild(content);
    return section;
  }

  refreshSwitches() {
    const existing = this.el?.querySelector('.pg-home__switches');
    if (existing) {
      existing.remove();
    }
    if (this._activeColourPicker) {
      this._activeColourPicker.remove();
      this._activeColourPicker = null;
    }
    const switchSection = this._buildSwitchSection();
    const grid = this.el?.querySelector('.pg-home__grid');
    if (grid) {
      this.el.insertBefore(switchSection, grid);
    } else {
      this.el?.appendChild(switchSection);
    }
  }

  show() {
    if (this.el) {
      this.el.style.display = '';
      requestAnimationFrame(() => {
        this.el.classList.add('pg-home--visible');
      });
    }
  }

  hide() {
    if (this.el) {
      this.el.classList.remove('pg-home--visible');
      this.el.style.display = 'none';
    }
  }

  unmount() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
  }
}
