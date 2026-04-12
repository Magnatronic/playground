export class CursorMode {
  init(pixiApp) {
    this.app = pixiApp;
    // Default to center, but also listen for pointerenter + pointerdown
    // so position updates as soon as pointer is over the canvas
    this.pointerX = pixiApp.screen.width / 2;
    this.pointerY = pixiApp.screen.height / 2;
    this.hasReceivedPointer = false;

    this.handlePointer = this.handlePointer.bind(this);
    this.app.canvas.addEventListener('pointermove', this.handlePointer);
    this.app.canvas.addEventListener('pointerenter', this.handlePointer);
    this.app.canvas.addEventListener('pointerdown', this.handlePointer);
  }

  handlePointer(event) {
    this.pointerX = event.offsetX;
    this.pointerY = event.offsetY;
    this.hasReceivedPointer = true;
  }

  getPosition() {
    return {
      x: this.pointerX,
      y: this.pointerY,
    };
  }

  update(delta) {}

  destroy() {
    if (this.app) {
      this.app.canvas.removeEventListener('pointermove', this.handlePointer);
      this.app.canvas.removeEventListener('pointerenter', this.handlePointer);
      this.app.canvas.removeEventListener('pointerdown', this.handlePointer);
    }
    this.app = null;
  }
}
