import { Container, Graphics } from 'pixi.js';
import { BaseFillMode } from './BaseFillMode.js';
import { generateTiles as generateSquares } from './tile-patterns/SquarePattern.js';
import { generateTiles as generateHex } from './tile-patterns/HexPattern.js';
import { generateTiles as generateTriangles } from './tile-patterns/TrianglePattern.js';
import { generateTiles as generateBricks } from './tile-patterns/BrickPattern.js';
import { hexToNumber } from '../../../utils/colour.js';

const PATTERNS = {
  squares: generateSquares,
  hexagons: generateHex,
  triangles: generateTriangles,
  bricks: generateBricks,
};
const PATTERN_NAMES = Object.keys(PATTERNS);
const UNFILLED_COLOR = 0x2a2a3e;
const UNFILLED_STROKE_COLOR = 0x444466;
const UNFILLED_STROKE_WIDTH = 1;
const FILLED_STROKE_ALPHA = 0.3;

export class MosaicFillMode extends BaseFillMode {
  constructor() {
    super();
    this.app = null;
    this.container = null;
    this.unfilledLayer = null;
    this.filledLayer = null;
    this.tiles = [];
    this.filledCount = 0;
    this.totalTiles = 0;
    this.patternName = 'squares';
    this.patternIndex = 0;
    this.tileSize = 40;
    this.minTileSize = 15;
    this.maxTileSize = 120;
    this.tileSizeStep = 10;
  }

  init(app, options = {}) {
    this.app = app;
    this.container = new Container();
    this.unfilledLayer = new Graphics();
    this.filledLayer = new Graphics();
    this.container.addChild(this.unfilledLayer);
    this.container.addChild(this.filledLayer);

    if (options.patternName && PATTERNS[options.patternName]) {
      this.patternName = options.patternName;
      this.patternIndex = PATTERN_NAMES.indexOf(options.patternName);
    }

    if (Number.isFinite(options.tileSize) && options.tileSize > 0) {
      this.tileSize = options.tileSize;
    }

    this.buildTiles();
  }

  buildTiles() {
    if (!this.app) {
      return;
    }

    this.tiles = [];
    this.filledCount = 0;

    this.unfilledLayer.clear();
    this.filledLayer.clear();

    const generator = PATTERNS[this.patternName] || PATTERNS.squares;
    const tileData = generator(this.app.screen.width, this.app.screen.height, this.tileSize);

    const sw = this.app.screen.width;
    const sh = this.app.screen.height;

    for (const tile of tileData) {
      const hasVisibleVertex = tile.points.some(
        (pt) => pt[0] >= 0 && pt[0] <= sw && pt[1] >= 0 && pt[1] <= sh
      );

      if (!hasVisibleVertex) {
        continue;
      }

      const flatPoints = tile.points.flat();

      this.unfilledLayer.poly(flatPoints);
      this.unfilledLayer.fill(UNFILLED_COLOR);
      this.unfilledLayer.poly(flatPoints);
      this.unfilledLayer.stroke({ width: UNFILLED_STROKE_WIDTH, color: UNFILLED_STROKE_COLOR });

      this.tiles.push({
        filled: false,
        centerX: tile.centerX,
        centerY: tile.centerY,
        flatPoints,
      });
    }

    this.totalTiles = this.tiles.length;
  }

  stamp({ x, y, colour }) {
    let nearestTile = null;
    let minDistanceSq = Infinity;

    for (const tile of this.tiles) {
      const dx = tile.centerX - x;
      const dy = tile.centerY - y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        nearestTile = tile;
      }
    }

    if (!nearestTile || nearestTile.filled) {
      return;
    }

    nearestTile.filled = true;
    this.filledCount += 1;

    this.filledLayer.poly(nearestTile.flatPoints);
    this.filledLayer.fill(hexToNumber(colour));
    this.filledLayer.poly(nearestTile.flatPoints);
    this.filledLayer.stroke({
      width: UNFILLED_STROKE_WIDTH,
      color: UNFILLED_STROKE_COLOR,
      alpha: FILLED_STROKE_ALPHA,
    });
  }

  update(delta) {}

  getPercentage() {
    if (this.totalTiles === 0) {
      return 0;
    }

    return (this.filledCount / this.totalTiles) * 100;
  }

  getDisplayObject() {
    return this.container;
  }

  getCoverageGrid() {
    return {
      getRandomUnfilledCell: () => {
        const unfilled = this.tiles.filter((t) => !t.filled);
        if (unfilled.length === 0) {
          return null;
        }

        const tile = unfilled[Math.floor(Math.random() * unfilled.length)];
        return { x: tile.centerX, y: tile.centerY };
      },
      cellWidth: this.tileSize,
      cellHeight: this.tileSize,
    };
  }

  reset() {
    this.buildTiles();
  }

  resize(width, height) {
    this.buildTiles();
  }

  setTileSize(size) {
    const clamped = Math.max(this.minTileSize, Math.min(this.maxTileSize, size));
    this.tileSize = clamped;
    this.buildTiles();
    console.log(`Tile size: ${this.tileSize}`);
  }

  increaseTileSize() {
    this.setTileSize(this.tileSize + this.tileSizeStep);
  }

  decreaseTileSize() {
    this.setTileSize(this.tileSize - this.tileSizeStep);
  }

  setPattern(patternName) {
    if (!PATTERN_NAMES.includes(patternName)) {
      console.warn(`Unknown mosaic pattern: ${patternName}`);
      return;
    }

    this.patternName = patternName;
    this.patternIndex = PATTERN_NAMES.indexOf(patternName);
    this.buildTiles();
    console.log(`Mosaic pattern: ${patternName}`);
  }

  cyclePattern() {
    this.patternIndex = (this.patternIndex + 1) % PATTERN_NAMES.length;
    this.patternName = PATTERN_NAMES[this.patternIndex];
    this.buildTiles();
    console.log(`Mosaic pattern: ${this.patternName}`);
  }

  destroy() {
    if (this.container) {
      if (this.container.parent) {
        this.container.parent.removeChild(this.container);
      }

      this.container.destroy({ children: true });
    }

    this.tiles = [];
    this.filledCount = 0;
    this.totalTiles = 0;
    this.app = null;
    this.container = null;
    this.unfilledLayer = null;
    this.filledLayer = null;
  }
}
