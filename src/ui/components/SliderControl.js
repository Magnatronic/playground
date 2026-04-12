const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

export function createSlider({ label, min, max, step = 1, value, unit = '', onChange }) {
  const el = document.createElement('div');
  el.className = 'pg-slider';

  const header = document.createElement('div');
  header.className = 'pg-slider__header';

  const labelEl = document.createElement('span');
  labelEl.className = 'pg-slider__label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'pg-slider__value';
  valueEl.textContent = value + unit;

  header.appendChild(labelEl);
  header.appendChild(valueEl);

  const input = document.createElement('input');
  input.type = 'range';
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.setAttribute('aria-label', label);
  input.setAttribute('tabindex', '-1');

  input.addEventListener('input', () => {
    const v = Number(input.value);
    valueEl.textContent = v + unit;
    if (onChange) onChange(v);
  });

  input.addEventListener('keydown', (e) => {
    if (SWITCH_KEYS.has(e.code)) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  el.appendChild(header);
  el.appendChild(input);

  el.setValue = (v) => {
    input.value = v;
    valueEl.textContent = v + unit;
  };

  return el;
}
