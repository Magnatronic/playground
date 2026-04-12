export class RandomMode {
  init(pixiApp) {
    this.app = pixiApp;
  }

  getPosition() {
    return {
      x: Math.random() * this.app.screen.width,
      y: Math.random() * this.app.screen.height,
    };
  }

  update(delta) {}

  destroy() {
    this.app = null;
  }
}
