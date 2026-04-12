export function generateTiles(screenWidth, screenHeight, targetSize = 40) {
  const safeTargetSize = Math.max(1, targetSize);
  const cols = Math.max(1, Math.ceil(screenWidth / safeTargetSize));
  const rows = Math.max(1, Math.ceil(screenHeight / safeTargetSize));

  const tileW = screenWidth / cols;
  const tileH = screenHeight / rows;
  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    const y0 = row * tileH;
    const y1 = y0 + tileH;

    for (let col = 0; col < cols; col += 1) {
      const x0 = col * tileW;
      const x1 = x0 + tileW;
      const id = row * cols + col;

      tiles.push({
        id,
        points: [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
        centerX: x0 + tileW * 0.5,
        centerY: y0 + tileH * 0.5,
      });
    }
  }

  return tiles;
}
