const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

const PRESET_COLOURS = [
  '#3366FF', '#00CC66', '#CCCC00', '#FF8800',
  '#CC33CC', '#EE1166', '#CC99CC', '#9933CC',
  '#00CCCC', '#33CCAA', '#33CC33', '#6699FF',
];

export function createColourSwatch({ selected, onChange }) {
  const el = document.createElement('div');
  el.className = 'pg-colour-swatch';

  const items = [];

  PRESET_COLOURS.forEach((colour) => {
    const item = document.createElement('div');
    item.className = 'pg-colour-swatch__item' + (colour === selected ? ' pg-colour-swatch__item--selected' : '');
    item.style.backgroundColor = colour;
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(colour === selected));
    item.setAttribute('aria-label', colour);
    item.setAttribute('tabindex', '-1');
    item.dataset.colour = colour;

    item.addEventListener('click', () => {
      items.forEach((it) => {
        it.classList.remove('pg-colour-swatch__item--selected');
        it.setAttribute('aria-checked', 'false');
      });
      item.classList.add('pg-colour-swatch__item--selected');
      item.setAttribute('aria-checked', 'true');
      if (onChange) onChange(colour);
    });

    item.addEventListener('keydown', (e) => {
      if (SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    items.push(item);
    el.appendChild(item);
  });

  el.setValue = (v) => {
    items.forEach((it) => {
      const isSelected = it.dataset.colour === v;
      it.classList.toggle('pg-colour-swatch__item--selected', isSelected);
      it.setAttribute('aria-checked', String(isSelected));
    });
  };

  return el;
}
