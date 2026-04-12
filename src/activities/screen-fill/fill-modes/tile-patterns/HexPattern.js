export function generateTiles(screenWidth, screenHeight, targetSize = 40) {
  const radius = Number.isFinite(targetSize) && targetSize > 0 ? targetSize : 40;
  const hexWidth = Math.sqrt(3) * radius;
  const rowHeight = 1.5 * radius;

  // Start offset so hexagons bleed past top-left edge
  const startX = 0;
  const startY = 0;

  // Extra rows/cols on all sides to ensure full edge coverage
  const cols = Math.ceil(screenWidth / hexWidth) + 2;
  const rows = Math.ceil(screenHeight / rowHeight) + 2;

  const angles = [30, 90, 150, 210, 270, 330].map((degrees) => (degrees * Math.PI) / 180);
  const tiles = [];

  let id = 0;

  for (let row = -1; row < rows; row += 1) {
    for (let col = -1; col < cols; col += 1) {
      const centerX = startX + col * hexWidth + (((row % 2) + 2) % 2) * (hexWidth / 2);
      const centerY = startY + row * rowHeight;

      // Skip tiles whose center is far outside the screen (but keep partial-overlap tiles)
      if (
        centerX < -radius * 2 ||
        centerX > screenWidth + radius * 2 ||
        centerY < -radius * 2 ||
        centerY > screenHeight + radius * 2
      ) {
        continue;
      }

      const points = angles.map((angle) => [
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle),
      ]);

      tiles.push({ id, points, centerX, centerY });
      id += 1;
    }
  }

  return tiles;
}
