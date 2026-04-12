const SWITCH_KEYS = new Set(['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F7', 'F8']);

export function createOptionGroup({ label, options, selected, onChange }) {
  const wrapper = document.createElement('div');

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.className = 'pg-option-group__label';
    labelEl.textContent = label;
    labelEl.id = 'pg-og-' + label.replace(/\s+/g, '-').toLowerCase();
    wrapper.appendChild(labelEl);
  }

  const group = document.createElement('div');
  group.className = 'pg-option-group';
  group.setAttribute('role', 'radiogroup');
  if (label) group.setAttribute('aria-labelledby', wrapper.firstChild.id);

  const items = [];

  options.forEach((opt) => {
    const item = document.createElement('div');
    item.className = 'pg-option-group__item' + (opt.value === selected ? ' pg-option-group__item--selected' : '');
    item.setAttribute('role', 'radio');
    item.setAttribute('aria-checked', String(opt.value === selected));
    item.setAttribute('tabindex', '-1');
    item.textContent = opt.label;
    item.dataset.value = opt.value;

    item.addEventListener('click', () => {
      items.forEach((it) => {
        it.classList.remove('pg-option-group__item--selected');
        it.setAttribute('aria-checked', 'false');
      });
      item.classList.add('pg-option-group__item--selected');
      item.setAttribute('aria-checked', 'true');
      if (onChange) onChange(opt.value);
    });

    item.addEventListener('keydown', (e) => {
      if (SWITCH_KEYS.has(e.code)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    items.push(item);
    group.appendChild(item);
  });

  wrapper.appendChild(group);

  wrapper.setValue = (v) => {
    items.forEach((it) => {
      const isSelected = it.dataset.value === v;
      it.classList.toggle('pg-option-group__item--selected', isSelected);
      it.setAttribute('aria-checked', String(isSelected));
    });
  };

  return wrapper;
}
