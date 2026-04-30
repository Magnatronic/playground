/**
 * Creates an organic paint-splat canvas resembling real thrown paint:
 * a large irregular blob, thin radiating arms, scattered droplets, fine micro-splatter.
 *
 * @param {string} colour       - hex colour e.g. '#ff0000'
 * @param {number} blobDiameter - nominal diameter of the central blob in px
 * @returns {HTMLCanvasElement}
 */
export function createSplatCanvas(colour, blobDiameter) {
  // Canvas is 5× the blob so arms and distant droplets have room
  const armReach = blobDiameter * 2.0;
  const canvasSize = Math.ceil(blobDiameter + armReach * 2);
  const canvas = document.createElement('canvas');
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  const ctx = canvas.getContext('2d');

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;
  const R = blobDiameter * 0.4; // central blob radius

  // Parse hex colour
  const hex = (colour || '#ffffff').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const colA = (a) => `rgba(${r},${g},${b},${a.toFixed(3)})`;
  // Darker shade for depth layers
  const rd = Math.max(0, r - 55);
  const gd = Math.max(0, g - 55);
  const bd = Math.max(0, b - 55);
  const darkA = (a) => `rgba(${rd},${gd},${bd},${a.toFixed(3)})`;

  // ── 1. Radiating arms (drawn underneath the main blob) ──────────────────
  const armCount = 6 + Math.floor(Math.random() * 8); // 6–13 arms
  for (let i = 0; i < armCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const len = R * 1.6 + Math.random() * (armReach * 0.88 - R * 1.6);
    const rootW = Math.max(1.5, R * 0.05 + Math.random() * R * 0.09);
    const bendY = (Math.random() - 0.5) * len * 0.22;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);

    // Tapered shape: wide at root, tapering to a point
    ctx.beginPath();
    ctx.moveTo(R * 0.45, -rootW * 0.5);
    ctx.quadraticCurveTo(len * 0.45, bendY - rootW * 0.15, len, 0);
    ctx.quadraticCurveTo(len * 0.45, bendY + rootW * 0.15, R * 0.45, rootW * 0.5);
    ctx.closePath();

    const ag = ctx.createLinearGradient(R * 0.45, 0, len, 0);
    ag.addColorStop(0,    colA(0.92));
    ag.addColorStop(0.65, colA(0.70));
    ag.addColorStop(1,    colA(0.00));
    ctx.fillStyle = ag;
    ctx.fill();
    ctx.restore();

    // Small teardrop/droplet at the tip of ~half the arms
    if (Math.random() < 0.55) {
      const ex = cx + Math.cos(ang) * len;
      const ey = cy + Math.sin(ang) * len;
      if (ex > 1 && ex < canvasSize - 1 && ey > 1 && ey < canvasSize - 1) {
        const er = Math.max(1, R * (0.03 + Math.random() * 0.07));
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fillStyle = colA(0.88);
        ctx.fill();
      }
    }
  }

  // ── 2. Central irregular blob – 3 passes for layered depth ──────────────
  for (let pass = 0; pass < 3; pass++) {
    // outer pass slightly larger for a soft halo edge
    const passR = R * (pass === 0 ? 1.08 : pass === 1 ? 1.0 : 0.90);
    const pts = 40;

    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      // Multi-frequency noise → truly organic, non-circular edge
      const noise =
        Math.sin(a * 3.1  + pass * 1.3) * 0.10 +
        Math.sin(a * 5.7  + pass * 0.8) * 0.07 +
        Math.sin(a * 11.3 + pass * 0.5) * 0.04 +
        (Math.random() * 0.20 - 0.10);
      const rad = passR * (0.82 + noise);
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else         ctx.lineTo(x, y);
    }
    ctx.closePath();

    if (pass === 0)      ctx.filter = 'blur(3px)';
    else if (pass === 1) ctx.filter = 'blur(1px)';
    else                 ctx.filter = 'none';

    // Top pass slightly darker for a wet-paint depth impression
    ctx.fillStyle = pass === 2 ? darkA(0.45) : colA(pass === 0 ? 0.82 : 0.90);
    ctx.fill();
    ctx.restore();
  }

  // Specular sheen: off-centre radial gradient → looks wet
  ctx.save();
  const sheen = ctx.createRadialGradient(
    cx - R * 0.18, cy - R * 0.22, 0,
    cx,            cy,            R * 1.05
  );
  sheen.addColorStop(0,   'rgba(255,255,255,0.20)');
  sheen.addColorStop(0.35,'rgba(255,255,255,0.06)');
  sheen.addColorStop(1,   'rgba(255,255,255,0.00)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
  ctx.fillStyle = sheen;
  ctx.fill();
  ctx.restore();

  // ── 3. Scattered droplets – power distribution for realism ──────────────
  const dropCount = 22 + Math.floor(Math.random() * 30);
  for (let i = 0; i < dropCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    // √ distribution → many medium-distance, some very far
    const dist = R * 1.1 + Math.pow(Math.random(), 0.55) * armReach * 0.85;
    const dx = cx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist;
    if (dx < 1 || dx > canvasSize - 1 || dy < 1 || dy > canvasSize - 1) continue;

    const rr = Math.max(1, R * (0.022 + Math.random() * 0.12));
    ctx.beginPath();
    ctx.arc(dx, dy, rr, 0, Math.PI * 2);
    ctx.fillStyle = colA(0.58 + Math.random() * 0.40);
    ctx.fill();
  }

  // ── 4. Fine micro-splatter near blob edge ────────────────────────────────
  const fineCount = 14 + Math.floor(Math.random() * 20);
  for (let i = 0; i < fineCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = R * (0.88 + Math.random() * 1.4);
    const dx = cx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist;
    const rr = Math.max(0.5, R * (0.006 + Math.random() * 0.026));
    ctx.beginPath();
    ctx.arc(dx, dy, rr, 0, Math.PI * 2);
    ctx.fillStyle = colA(0.50 + Math.random() * 0.48);
    ctx.fill();
  }

  return canvas;
}

export function createSplatTexture(colour, diameter) {
  return createSplatCanvas(colour, diameter);
}
