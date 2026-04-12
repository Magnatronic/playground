import { iconHome, iconGear } from './icons.js';

const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

export class ActivityHeader {
  constructor({ onHomeClick, onSettingsClick }) {
    this.onHomeClick = onHomeClick;
    this.onSettingsClick = onSettingsClick;
    this.el = null;
  }

  mount(parent) {
    this.el = document.createElement('div');
    this.el.className = 'pg-header';

    // Switch safety
    this.el.addEventListener('keydown', (e) => {
      if (SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    // Home button
    const homeBtn = document.createElement('button');
    homeBtn.className = 'pg-header__btn';
    homeBtn.setAttribute('aria-label', 'Home');
    homeBtn.setAttribute('tabindex', '-1');
    homeBtn.innerHTML = iconHome();
    homeBtn.querySelector('svg').setAttribute('aria-hidden', 'true');
    homeBtn.addEventListener('click', () => {
      if (this.onHomeClick) this.onHomeClick();
    });

    // Title
    this._titleEl = document.createElement('h2');
    this._titleEl.className = 'pg-header__title';
    this._titleEl.textContent = '';

    // Settings button
    const gearBtn = document.createElement('button');
    gearBtn.className = 'pg-header__btn';
    gearBtn.setAttribute('aria-label', 'Settings');
    gearBtn.setAttribute('tabindex', '-1');
    gearBtn.innerHTML = iconGear();
    gearBtn.querySelector('svg').setAttribute('aria-hidden', 'true');
    gearBtn.addEventListener('click', () => {
      if (this.onSettingsClick) this.onSettingsClick();
    });

    this.el.appendChild(homeBtn);
    this.el.appendChild(this._titleEl);
    this.el.appendChild(gearBtn);

    parent.appendChild(this.el);
  }

  setTitle(text) {
    if (this._titleEl) {
      this._titleEl.textContent = text;
    }
  }

  show() {
    if (this.el) this.el.style.display = '';
  }

  hide() {
    if (this.el) this.el.style.display = 'none';
  }

  unmount() {
    if (this.el && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
    this.el = null;
    this._titleEl = null;
  }
}
