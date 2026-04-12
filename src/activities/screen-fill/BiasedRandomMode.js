export class BiasedRandomMode {
  constructor(coverageGrid) {
    this.coverageGrid = coverageGrid;
    this.app = null;
  }

  init(pixiApp) {
    this.app = pixiApp;
  }

  getPosition() {
    const unfilledCell = this.coverageGrid?.getRandomUnfilledCell();

    if (unfilledCell) {
      const cellWidth = this.coverageGrid?.cellWidth ?? this.coverageGrid?.cellSize ?? 20;
      const cellHeight = this.coverageGrid?.cellHeight ?? this.coverageGrid?.cellSize ?? 20;
      const halfCellWidth = cellWidth / 2;
      const halfCellHeight = cellHeight / 2;

      const x = unfilledCell.x + (Math.random() * 2 - 1) * halfCellWidth;
      const y = unfilledCell.y + (Math.random() * 2 - 1) * halfCellHeight;

      return {
        x: Math.max(0, Math.min(this.app.screen.width, x)),
        y: Math.max(0, Math.min(this.app.screen.height, y)),
      };
    }

    return {
      x: Math.random() * this.app.screen.width,
      y: Math.random() * this.app.screen.height,
    };
  }

  update(delta) {}

  destroy() {
    this.coverageGrid = null;
    this.app = null;
  }
}
