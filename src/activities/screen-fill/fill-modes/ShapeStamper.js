export const SHAPE_NAMES = [
  'circle', 'square', 'triangle', 'rectangle', 'diamond',
  'pentagon', 'hexagon', 'star', 'parallelogram', 'trapezoid',
];

export const SHAPE_COVERAGE = {
  circle: 1.0,
  square: 1.0,
  triangle: 0.6,
  rectangle: 0.85,
  diamond: 0.7,
  pentagon: 0.85,
  hexagon: 0.9,
  star: 0.45,
  parallelogram: 0.65,
  trapezoid: 0.7,
};

function drawCircle(graphics, radius) {
  graphics.circle(0, 0, radius);
}

function drawSquare(graphics, radius) {
  graphics.rect(-radius, -radius, radius * 2, radius * 2);
}

function drawTriangle(graphics, radius) {
  // 30% larger than other shapes to appear visually similar
  const r = radius * 1.3;
  const halfBase = (Math.sqrt(3) / 2) * r;
  const topY = (-2 * r) / 3;
  const bottomY = r / 3;

  graphics.poly([
    0, topY,
    -halfBase, bottomY,
    halfBase, bottomY,
  ]);
}

function drawRectangle(graphics, radius) {
  // 2:1 aspect ratio
  const halfWidth = radius;
  const halfHeight = radius * 0.5;
  graphics.rect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2);
}

function drawDiamond(graphics, radius) {
  graphics.poly([
    0, -radius,
    radius, 0,
    0, radius,
    -radius, 0,
  ]);
}

function drawPentagon(graphics, radius) {
  const points = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  graphics.poly(points);
}

function drawHexagon(graphics, radius) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * 2 * Math.PI) / 6 - Math.PI / 6;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  graphics.poly(points);
}

function drawStar(graphics, radius) {
  graphics.star(0, 0, 5, radius, radius * 0.4);
}

function drawParallelogram(graphics, radius) {
  // Slanted rectangle - skew offset is 30% of width
  const halfWidth = radius;
  const halfHeight = radius * 0.6;
  const skew = radius * 0.3;
  graphics.poly([
    -halfWidth + skew, -halfHeight,
    halfWidth + skew, -halfHeight,
    halfWidth - skew, halfHeight,
    -halfWidth - skew, halfHeight,
  ]);
}

function drawTrapezoid(graphics, radius) {
  // Top edge narrower than bottom
  const halfBottom = radius;
  const halfTop = radius * 0.5;
  const halfHeight = radius * 0.6;
  graphics.poly([
    -halfTop, -halfHeight,
    halfTop, -halfHeight,
    halfBottom, halfHeight,
    -halfBottom, halfHeight,
  ]);
}

const SHAPE_DRAWERS = {
  circle: drawCircle,
  square: drawSquare,
  triangle: drawTriangle,
  rectangle: drawRectangle,
  diamond: drawDiamond,
  pentagon: drawPentagon,
  hexagon: drawHexagon,
  star: drawStar,
  parallelogram: drawParallelogram,
  trapezoid: drawTrapezoid,
};

export function drawShape(graphics, shapeName, radius) {
  const draw = SHAPE_DRAWERS[shapeName] || drawCircle;
  draw(graphics, radius);
}
