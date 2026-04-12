const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

export function createToggle({ label, value = false, onChange }) {
  const el = document.createElement('div');
  el.className = 'pg-toggle' + (value ? ' pg-toggle--on' : '');
  el.setAttribute('role', 'switch');
  el.setAttribute('aria-checked', String(value));
  el.setAttribute('aria-label', label);
  el.setAttribute('tabindex', '-1');

  const track = document.createElement('div');
  track.className = 'pg-toggle__track';

  const thumb = document.createElement('div');
  thumb.className = 'pg-toggle__thumb';
  track.appendChild(thumb);

  const labelEl = document.createElement('span');
  labelEl.className = 'pg-toggle__label';
  labelEl.textContent = label;

  el.appendChild(track);
  el.appendChild(labelEl);

  let currentValue = value;

  el.addEventListener('click', () => {
    currentValue = !currentValue;
    el.classList.toggle('pg-toggle--on', currentValue);
    el.setAttribute('aria-checked', String(currentValue));
    if (onChange) onChange(currentValue);
  });

  el.addEventListener('keydown', (e) => {
    if (SWITCH_KEYS.has(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  el.setValue = (v) => {
    currentValue = v;
    el.classList.toggle('pg-toggle--on', currentValue);
    el.setAttribute('aria-checked', String(currentValue));
  };

  return el;
}
