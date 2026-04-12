export class CoverageGrid {
  constructor(screenWidth, screenHeight) {
    this.targetCellSize = 10;
    this.resize(screenWidth, screenHeight);
  }

  resize(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    this.cols = Math.max(20, Math.round(screenWidth / this.targetCellSize));
    this.rows = Math.max(12, Math.round(screenHeight / this.targetCellSize));

    this.cellWidth = screenWidth / this.cols;
    this.cellHeight = screenHeight / this.rows;

    this.totalCells = this.cols * this.rows;
    this.cells = new Uint8Array(this.totalCells);
    this.filledCount = 0;
  }

  reset() {
    this.cells.fill(0);
    this.filledCount = 0;
  }

  markFilled(x, y, radius) {
    const safeRadius = Math.max(0, radius);
    const r2 = safeRadius * safeRadius;

    const minX = x - safeRadius;
    const maxX = x + safeRadius;
    const minY = y - safeRadius;
    const maxY = y + safeRadius;

    if (
      maxX < 0 ||
      maxY < 0 ||
      minX >= this.screenWidth ||
      minY >= this.screenHeight
    ) {
      return;
    }

    const startCol = Math.max(0, Math.floor(minX / this.cellWidth));
    const endCol = Math.min(this.cols - 1, Math.floor(maxX / this.cellWidth));
    const startRow = Math.max(0, Math.floor(minY / this.cellHeight));
    const endRow = Math.min(this.rows - 1, Math.floor(maxY / this.cellHeight));

    for (let row = startRow; row <= endRow; row += 1) {
      const cellTop = row * this.cellHeight;
      const cellBottom = cellTop + this.cellHeight;

      for (let col = startCol; col <= endCol; col += 1) {
        const cellLeft = col * this.cellWidth;
        const cellRight = cellLeft + this.cellWidth;

        // Check all 4 corners are within the stamp radius
        const dx0 = x - cellLeft;
        const dy0 = y - cellTop;
        const dx1 = x - cellRight;
        const dy1 = y - cellBottom;

        if (
          dx0 * dx0 + dy0 * dy0 > r2 ||
          dx1 * dx1 + dy0 * dy0 > r2 ||
          dx0 * dx0 + dy1 * dy1 > r2 ||
          dx1 * dx1 + dy1 * dy1 > r2
        ) {
          continue;
        }

        const index = row * this.cols + col;
        if (this.cells[index] === 0) {
          this.cells[index] = 1;
          this.filledCount += 1;
        }
      }
    }
  }

  getPercentage() {
    if (this.totalCells === 0) {
      return 0;
    }

    return (this.filledCount / this.totalCells) * 100;
  }

  getRandomUnfilledCell() {
    if (this.filledCount >= this.totalCells) {
      return null;
    }

    const startIndex = Math.floor(Math.random() * this.totalCells);

    for (let offset = 0; offset < this.totalCells; offset += 1) {
      const index = (startIndex + offset) % this.totalCells;
      if (this.cells[index] === 1) {
        continue;
      }

      const row = Math.floor(index / this.cols);
      const col = index - row * this.cols;

      return {
        x: (col + 0.5) * this.cellWidth,
        y: (row + 0.5) * this.cellHeight,
      };
    }

    return null;
  }
}
