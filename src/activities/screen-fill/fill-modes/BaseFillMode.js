export class BaseFillMode {
  init(app, options) {
    throw new Error('BaseFillMode.init() not implemented');
  }

  stamp(options) {
    throw new Error('BaseFillMode.stamp() not implemented');
  }

  getPercentage() {
    throw new Error('BaseFillMode.getPercentage() not implemented');
  }

  getDisplayObject() {
    throw new Error('BaseFillMode.getDisplayObject() not implemented');
  }

  reset() {
    throw new Error('BaseFillMode.reset() not implemented');
  }

  resize(width, height) {
    throw new Error('BaseFillMode.resize() not implemented');
  }

  update(delta) {}

  destroy() {
    throw new Error('BaseFillMode.destroy() not implemented');
  }
}
