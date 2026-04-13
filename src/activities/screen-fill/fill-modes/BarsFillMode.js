import { Container, Graphics } from 'pixi.js';
import { BaseFillMode } from './BaseFillMode.js';
import { hexToNumber } from '../../../utils/colour.js';

const BAR_ORIENTATIONS = ['horizontal', 'vertical', 'random'];

export class BarsFillMode extends BaseFillMode {
  constructor() {
    super();
    this.app = null;
    this.container = null;
    this.filledLayer = null;

    this.orientation = 'horizontal'; // 'horizontal', 'vertical', 'random'
    this.barThickness = 30;
    this.minBarThickness = 10;
    this.maxBarThickness = 80;
    this.barThicknessStep = 5;

    this.bars = []; // Array of {x, y, width, height, centerX, centerY, filled, colour}
    this.filledCount = 0;
    this.totalBars = 0;

    // For random mode: track actual pixel coverage with a coarse grid
    this._coverageCols = 0;
    this._coverageRows = 0;
    this._coverageGrid = null; // Uint8Array, 1 = covered
    this._totalCells = 0;
    this._filledCells = 0;
  }

  init(app, options = {}) {
    this.app = app;

    if (options.barThickness !== undefined) this.setBarThickness(options.barThickness);
    if (options.orientation !== undefined) this.setOrientation(options.orientation);

    this.container = new Container();
    this.filledLayer = new Graphics();
    this.container.addChild(this.filledLayer);

    this._buildBars();
  }

  _buildBars() {
    this.bars = [];
    this.filledCount = 0;

    if (this.filledLayer) {
      this.filledLayer.clear();
    }

    const w = this.app.screen.width;
    const h = this.app.screen.height;

    if (this.orientation === 'horizontal') {
      this._buildHorizontalBars(w, h);
    } else if (this.orientation === 'vertical') {
      this._buildVerticalBars(w, h);
    } else {
      // Random: build both horizontal and vertical bars overlapping
      this._buildHorizontalBars(w, h);
      this._buildVerticalBars(w, h);
    }

    this.totalBars = this.bars.length;

    // For random mode, build a coarse grid to track actual pixel coverage
    if (this.orientation === 'random') {
      const cellSize = Math.max(4, Math.floor(this.barThickness / 2));
      this._coverageCols = Math.ceil(w / cellSize);
      this._coverageRows = Math.ceil(h / cellSize);
      this._coverageCellW = w / this._coverageCols;
      this._coverageCellH = h / this._coverageRows;
      this._totalCells = this._coverageCols * this._coverageRows;
      this._filledCells = 0;
      this._coverageGrid = new Uint8Array(this._totalCells);
    } else {
      this._coverageGrid = null;
      this._totalCells = 0;
      this._filledCells = 0;
    }
  }

  _buildHorizontalBars(w, h) {
    const count = Math.ceil(h / this.barThickness);
    for (let i = 0; i < count; i++) {
      const y = i * this.barThickness;
      const barHeight = Math.min(this.barThickness, h - y);
      this.bars.push({
        x: 0,
        y,
        width: w,
        height: barHeight,
        centerX: w / 2,
        centerY: y + barHeight / 2,
        filled: false,
        colour: null,
        type: 'horizontal',
      });
    }
  }

  _buildVerticalBars(w, h) {
    const count = Math.ceil(w / this.barThickness);
    for (let i = 0; i < count; i++) {
      const x = i * this.barThickness;
      const barWidth = Math.min(this.barThickness, w - x);
      this.bars.push({
        x,
        y: 0,
        width: barWidth,
        height: h,
        centerX: x + barWidth / 2,
        centerY: h / 2,
        filled: false,
        colour: null,
        type: 'vertical',
      });
    }
  }

  stamp({ x, y, colour }) {
    // Find nearest unfilled bar
    let nearestBar = null;
    let minDistanceSq = Infinity;

    for (const bar of this.bars) {
      if (bar.filled) continue;

      // Distance to bar center
      const dx = bar.centerX - x;
      const dy = bar.centerY - y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        nearestBar = bar;
      }
    }

    if (!nearestBar) return;

    nearestBar.filled = true;
    nearestBar.colour = colour;
    this.filledCount++;

    // Draw the bar — no outline, just solid colour
    this.filledLayer.rect(nearestBar.x, nearestBar.y, nearestBar.width, nearestBar.height);
    this.filledLayer.fill(hexToNumber(colour));

    // In random mode, mark actual pixel coverage on the coarse grid
    if (this._coverageGrid) {
      const colStart = Math.floor(nearestBar.x / this._coverageCellW);
      const colEnd = Math.min(this._coverageCols - 1, Math.floor((nearestBar.x + nearestBar.width - 1) / this._coverageCellW));
      const rowStart = Math.floor(nearestBar.y / this._coverageCellH);
      const rowEnd = Math.min(this._coverageRows - 1, Math.floor((nearestBar.y + nearestBar.height - 1) / this._coverageCellH));
      for (let r = rowStart; r <= rowEnd; r++) {
        for (let c = colStart; c <= colEnd; c++) {
          const idx = r * this._coverageCols + c;
          if (!this._coverageGrid[idx]) {
            this._coverageGrid[idx] = 1;
            this._filledCells++;
          }
        }
      }
    }
  }

  getPercentage() {
    // In random mode, use actual pixel coverage (bars overlap)
    if (this._coverageGrid) {
      if (this._totalCells === 0) return 0;
      return (this._filledCells / this._totalCells) * 100;
    }
    // In horizontal/vertical mode, simple bar count
    if (this.totalBars === 0) return 0;
    return (this.filledCount / this.totalBars) * 100;
  }

  getDisplayObject() {
    return this.container;
  }

  getCoverageGrid() {
    return {
      getRandomUnfilledCell: () => {
        const unfilled = this.bars.filter((b) => !b.filled);
        if (unfilled.length === 0) return null;
        const bar = unfilled[Math.floor(Math.random() * unfilled.length)];
        return { x: bar.centerX, y: bar.centerY };
      },
      cellWidth: this.orientation === 'vertical' ? this.barThickness : this.app?.screen.width || 100,
      cellHeight: this.orientation === 'horizontal' ? this.barThickness : this.app?.screen.height || 100,
    };
  }

  reset() {
    this._buildBars();
  }

  resize(width, height) {
    this._buildBars();
  }

  update(delta) {
    // Nothing to animate
  }

  destroy() {
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }
      this.container.destroy({ children: true });
    }
    this.container = null;
    this.filledLayer = null;
    this.bars = [];
    this.app = null;
  }

  // Settings methods
  setOrientation(orientation) {
    if (!BAR_ORIENTATIONS.includes(orientation)) {
      console.warn(`Invalid bar orientation: ${orientation}`);
      return;
    }
    this.orientation = orientation;
  }

  setBarThickness(thickness) {
    this.barThickness = Math.max(this.minBarThickness, Math.min(this.maxBarThickness, thickness));
  }

  increaseBarThickness() {
    this.barThickness = Math.min(this.maxBarThickness, this.barThickness + this.barThicknessStep);
  }

  decreaseBarThickness() {
    this.barThickness = Math.max(this.minBarThickness, this.barThickness - this.barThicknessStep);
  }
}
