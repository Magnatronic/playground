export default class ProgressBar {
  constructor() {
    this.container = document.createElement('div');
    this.fill = document.createElement('div');
    this.text = document.createElement('span');

    this.container.className = 'playground-progress';
    this.fill.className = 'playground-progress-fill';
    this.text.className = 'playground-progress-text';

    this.container.style.position = 'fixed';
    this.container.style.bottom = '30px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.width = '60%';
    this.container.style.maxWidth = '800px';
    this.container.style.height = '36px';
    this.container.style.zIndex = '1000';
    this.container.style.background = 'rgba(0, 0, 0, 0.5)';
    this.container.style.borderRadius = '18px';
    this.container.style.overflow = 'hidden';

    this.fill.style.height = '100%';
    this.fill.style.width = '0%';
    this.fill.style.transition = 'width 0.3s ease, background-color 0.5s ease';
    this.fill.style.borderRadius = '18px';
    this.fill.style.backgroundColor = '#e53935';

    this.text.style.position = 'absolute';
    this.text.style.top = '50%';
    this.text.style.left = '50%';
    this.text.style.transform = 'translate(-50%, -50%)';
    this.text.style.color = 'white';
    this.text.style.fontWeight = 'bold';
    this.text.style.fontSize = '18px';
    this.text.style.fontFamily = 'sans-serif';
    this.text.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
    this.text.textContent = '0%';

    this.container.appendChild(this.fill);
    this.container.appendChild(this.text);
    document.body.appendChild(this.container);
  }

  update(percentage) {
    const numericPercentage = Number.isFinite(percentage) ? percentage : 0;
    const clamped = Math.min(100, Math.max(0, numericPercentage));
    const rounded = Math.round(clamped);

    this.fill.style.width = `${rounded}%`;
    this.fill.style.backgroundColor = this.getBarColor(rounded);
    this.text.textContent = `${rounded}%`;
  }

  show() {
    this.container.style.display = 'block';
  }

  hide() {
    this.container.style.display = 'none';
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }

  getBarColor(percentage) {
    if (percentage <= 33) {
      return '#e53935';
    }

    if (percentage <= 66) {
      return '#fdd835';
    }

    return '#43a047';
  }
}
