import { BaseFillMode } from './BaseFillMode.js';
import { PaintLayer } from '../../../painting/PaintLayer.js';
import { CoverageGrid } from '../CoverageGrid.js';
import { SHAPE_NAMES } from './ShapeStamper.js';

const SHAPE_ASSIGNMENT_MODES = ['per-switch', 'global', 'random'];

export class StandardFillMode extends BaseFillMode {
  constructor() {
    super();
    this.paintLayer = null;
    this.coverageGrid = null;
    this.app = null;

    this.shapeAssignment = 'global'; // 'per-switch', 'global', 'random'
    this.currentShape = 'circle';
    this.currentShapeIndex = 0;
    this.stampSize = 30; // base radius
    this.minStampSize = 10;
    this.maxStampSize = 80;
    this.stampSizeStep = 10;
  }

  init(app, options = {}) {
    this.app = app;

    this.paintLayer = new PaintLayer(app);
    this.paintLayer.setBlendMode('normal');

    this.coverageGrid = new CoverageGrid(app.screen.width, app.screen.height);

    if (options.stampSize !== undefined) {
      this.setStampSize(options.stampSize);
    }

    if (options.shapeAssignment !== undefined) {
      this.setShapeAssignment(options.shapeAssignment);
    }

    if (options.currentShape !== undefined) {
      this.setCurrentShape(options.currentShape);
    }
  }

  stamp({ x, y, colour, size, impactMultiplier = 1, switchIndex = 0 }) {
    void size;

    let shape = this.currentShape;

    if (this.shapeAssignment === 'random') {
      shape = SHAPE_NAMES[Math.floor(Math.random() * SHAPE_NAMES.length)];
    } else if (this.shapeAssignment === 'per-switch') {
      shape = SHAPE_NAMES[switchIndex % SHAPE_NAMES.length];
    }

    this.paintLayer.stamp({
      x,
      y,
      colour,
      size: this.stampSize,
      opacity: 0.9,
      impactMultiplier,
      shape,
    });

    this.coverageGrid.markFilled(x, y, this.stampSize * impactMultiplier);
  }

  getPercentage() {
    return this.coverageGrid.getPercentage();
  }

  getDisplayObject() {
    return this.paintLayer.getDisplayObject();
  }

  getCoverageGrid() {
    return this.coverageGrid;
  }

  reset() {
    this.paintLayer.clear();
    this.coverageGrid.reset();
  }

  resize(width, height) {
    this.coverageGrid.resize(width, height);
    if (this.paintLayer) {
      this.paintLayer.resize(width, height);
    }
  }

  update(delta) {
    void delta;
  }

  destroy() {
    if (this.paintLayer) {
      this.paintLayer.destroy();
    }

    this.paintLayer = null;
    this.coverageGrid = null;
    this.app = null;
  }

  setShapeAssignment(mode) {
    if (!SHAPE_ASSIGNMENT_MODES.includes(mode)) {
      console.warn(`Invalid shape assignment mode: ${mode}`);
      return;
    }

    this.shapeAssignment = mode;
    console.log(`Shape assignment mode: ${mode}`);
  }

  setCurrentShape(shapeName) {
    const shapeIndex = SHAPE_NAMES.indexOf(shapeName);

    if (shapeIndex === -1) {
      console.warn(`Invalid shape name: ${shapeName}`);
      return;
    }

    this.currentShape = shapeName;
    this.currentShapeIndex = shapeIndex;
    console.log(`Current shape: ${shapeName}`);
  }

  cycleShape() {
    this.currentShapeIndex = (this.currentShapeIndex + 1) % SHAPE_NAMES.length;
    this.currentShape = SHAPE_NAMES[this.currentShapeIndex];
    console.log(`Current shape: ${this.currentShape}`);
  }

  cycleShapeAssignment() {
    const index = SHAPE_ASSIGNMENT_MODES.indexOf(this.shapeAssignment);
    const nextIndex = (index + 1) % SHAPE_ASSIGNMENT_MODES.length;
    this.shapeAssignment = SHAPE_ASSIGNMENT_MODES[nextIndex];
    console.log(`Shape assignment mode: ${this.shapeAssignment}`);
  }

  setStampSize(size) {
    const clampedSize = Math.max(this.minStampSize, Math.min(this.maxStampSize, size));
    this.stampSize = clampedSize;
    console.log(`Stamp size: ${this.stampSize}`);
  }

  increaseStampSize() {
    const nextSize = Math.min(this.maxStampSize, this.stampSize + this.stampSizeStep);
    this.stampSize = nextSize;
    console.log(`Stamp size: ${this.stampSize}`);
  }

  decreaseStampSize() {
    const nextSize = Math.max(this.minStampSize, this.stampSize - this.stampSizeStep);
    this.stampSize = nextSize;
    console.log(`Stamp size: ${this.stampSize}`);
  }
}
