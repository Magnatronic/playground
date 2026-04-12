export function generateTiles(screenWidth, screenHeight, targetSize = 40) {
  const brickWidth = targetSize * 2;
  const brickHeight = targetSize;

  const cols = Math.ceil(screenWidth / brickWidth) + 2;
  const rows = Math.ceil(screenHeight / brickHeight) + 1;

  const tiles = [];

  for (let row = 0; row < rows; row += 1) {
    const offsetX = (row % 2) * (brickWidth / 2);

    for (let col = -1; col < cols; col += 1) {
      const x = col * brickWidth - offsetX;
      const y = row * brickHeight;

      // Skip bricks entirely off-screen
      if (x + brickWidth < 0 || x > screenWidth + brickWidth) {
        continue;
      }

      const points = [
        [x, y],
        [x + brickWidth, y],
        [x + brickWidth, y + brickHeight],
        [x, y + brickHeight],
      ];

      tiles.push({
        id: tiles.length,
        points,
        centerX: x + brickWidth / 2,
        centerY: y + brickHeight / 2,
      });
    }
  }

  return tiles;
}
