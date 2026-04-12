export class Timer {
  constructor() {
    this.startTime = null;
    this.elapsedMs = 0;
    this.running = false;

    this.element = document.createElement('div');
    this.element.className = 'playground-timer';
    this.element.textContent = '00:00';

    const style = this.element.style;
    style.position = 'fixed';
    style.top = '20px';
    style.right = '20px';
    style.zIndex = '1000';
    style.background = 'rgba(0, 0, 0, 0.5)';
    style.borderRadius = '12px';
    style.padding = '8px 16px';
    style.color = 'white';
    style.fontFamily = "'Courier New', monospace";
    style.fontSize = '28px';
    style.fontWeight = 'bold';
    style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';

    document.body.appendChild(this.element);
  }

  start() {
    if (this.running) {
      return;
    }

    this.startTime = performance.now();
    this.running = true;
  }

  stop() {
    if (!this.running) {
      return;
    }

    this.elapsedMs += performance.now() - this.startTime;
    this.startTime = null;
    this.running = false;
    this.element.textContent = this.formatTime(this.elapsedMs);
  }

  update() {
    if (!this.running) {
      return;
    }

    const totalElapsed = this.elapsedMs + (performance.now() - this.startTime);
    this.element.textContent = this.formatTime(totalElapsed);
  }

  reset() {
    this.startTime = null;
    this.elapsedMs = 0;
    this.running = false;
    this.element.textContent = '00:00';
  }

  getElapsed() {
    if (!this.running) {
      return this.elapsedMs;
    }

    return this.elapsedMs + (performance.now() - this.startTime);
  }

  show() {
    this.element.style.display = 'block';
  }

  hide() {
    this.element.style.display = 'none';
  }

  destroy() {
    this.element.remove();
  }

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}
