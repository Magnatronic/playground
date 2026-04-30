// Splat generator: produces a canvas with an organic paint splat look.
export function createSplatCanvas(colour, diameter) {
  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d');

  const cx = diameter / 2;
  const cy = diameter / 2;
  const baseR = diameter * 0.38;

  // helper: hex to rgb
  function hexToRgb(h) {
    const hex = h.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  const { r, g, b } = hexToRgb(colour || '#ffffff');

  // Draw a layered irregular blob: multiple passes with jitter and subtle blur
  for (let pass = 0; pass < 3; pass++) {
    // vary radius and alpha per pass
    const passRadius = baseR * (1 - pass * 0.12);
    const alpha = 0.95 * (1 - pass * 0.2);

    // create point polygon
    const pts = 20;
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const angle = (i / pts) * Math.PI * 2;
      // smoother jitter: use sin/cos perturbation pattern
      const jitter = 0.75 + (Math.sin(i * 1.3 + pass) * 0.12) + (Math.random() * 0.2);
      const rad = passRadius * jitter;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // softly blur outer passes using ctx.filter
    ctx.save();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    // small blur for outer passes
    ctx.filter = pass === 0 ? 'blur(2px)' : pass === 1 ? 'blur(1.2px)' : 'none';
    ctx.fill();
    ctx.restore();
  }

  // add droplet stains with radial gradients and light blur
  const dropletCount = 8 + Math.floor(Math.random() * 10);
  for (let i = 0; i < dropletCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = baseR * (0.4 + Math.random() * 1.1);
    const dx = cx + Math.cos(ang) * dist;
    const dy = cy + Math.sin(ang) * dist;
    const rr = Math.max(1, Math.round(diameter * (0.02 + Math.random() * 0.06)));

    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, rr * 2);
    g.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.95 - Math.random() * 0.5})`);
    g.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

    ctx.save();
    ctx.filter = 'blur(1.2px)';
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(dx, dy, rr * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // subtle noise overlay to break perfectly smooth areas
  const noiseCount = Math.round(diameter * 0.6);
  ctx.fillStyle = `rgba(0,0,0,0.02)`;
  for (let i = 0; i < noiseCount; i++) {
    const nx = Math.random() * diameter;
    const ny = Math.random() * diameter;
    ctx.fillRect(nx, ny, 1, 1);
  }

  return canvas;
}

export function createSplatTexture(colour, diameter) {
  const canvas = createSplatCanvas(colour, diameter);
  return canvas;
}
