/**
 * Convert a hex colour string to a numeric value for PixiJS.
 * Accepts '#RRGGBB' or 'RRGGBB' format.
 * @param {string} hex
 * @returns {number}
 */
export function hexToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}
