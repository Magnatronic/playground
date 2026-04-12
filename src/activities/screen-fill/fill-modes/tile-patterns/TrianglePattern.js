export function generateTiles(screenWidth, screenHeight, targetSize = 40) {
  const side = Number.isFinite(targetSize) && targetSize > 0 ? targetSize : 40;
  const triangleHeight = (Math.sqrt(3) / 2) * side;

  const tiles = [];
  let id = 0;

  // Extend generation bounds so edge coverage remains complete after clipping.
  const rowCount = Math.ceil(screenHeight / triangleHeight) + 2;
  const colCount = Math.ceil(screenWidth / side) + 4;

  for (let row = -1; row <= rowCount; row += 1) {
    const topY = row * triangleHeight;
    const bottomY = topY + triangleHeight;

    for (let col = -2; col <= colCount; col += 1) {
      const baseLeftX = col * side;
      const baseRightX = baseLeftX + side;
      const midX = baseLeftX + side / 2;

      const upPoints = [
        [baseLeftX, bottomY],
        [baseRightX, bottomY],
        [midX, topY],
      ];

      tiles.push({
        id: id++,
        points: upPoints,
        centerX: (upPoints[0][0] + upPoints[1][0] + upPoints[2][0]) / 3,
        centerY: (upPoints[0][1] + upPoints[1][1] + upPoints[2][1]) / 3,
      });

      const downPoints = [
        [midX, topY],
        [baseRightX + side / 2, topY],
        [baseRightX, bottomY],
      ];

      tiles.push({
        id: id++,
        points: downPoints,
        centerX: (downPoints[0][0] + downPoints[1][0] + downPoints[2][0]) / 3,
        centerY: (downPoints[0][1] + downPoints[1][1] + downPoints[2][1]) / 3,
      });
    }
  }

  return tiles;
}
