// Splat generator: produces an organic paint splat canvas
export function createSplatCanvas(colour, diameter) {
  const canvas = document.createElement('canvas');
  canvas.width = diameter;
  canvas.height = diameter;
  const ctx = canvas.getContext('2d');

  const cx = diameter / 2;
  const cy = diameter / 2;
  const baseR = diameter * 0.42;

  // helper: hex -> rgb
  function hexToRgb(h) {
    const hex = (h || '#ffffff').replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  const { r, g, b } = hexToRgb(colour);

  // clear
  ctx.clearRect(0, 0, diameter, diameter);

  // 1) core highlight: bright, small specular center
  (function drawCore() {
    const coreR = baseR * (0.28 + Math.random() * 0.06);
    const grad = ctx.createRadialGradient(cx - coreR * 0.15, cy - coreR * 0.15, 0, cx, cy, coreR * 1.6);
    grad.addColorStop(0, `rgba(255,255,255,${0.28 + Math.random() * 0.12})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${0.95})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  })();

  // 2) mid blob: irregular polygon filled with radial gradient (wet paint)
  (function drawMidBlob() {
    const pts = 24;
    const jitterScale = 0.6 + Math.random() * 0.6;
    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      // combine deterministic wave + noise for more organic outline
      const wave = 1 + Math.sin(i * 1.9) * 0.08;
      const jitter = (0.8 + Math.random() * 0.45) * jitterScale;
      const rad = baseR * wave * jitter;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();

    // gradient for wet look (darker near center)
    const gMid = ctx.createRadialGradient(cx, cy, baseR * 0.1, cx, cy, baseR * 1.1);
    gMid.addColorStop(0, `rgba(${Math.min(255, r + 20)},${Math.min(255, g + 20)},${Math.min(255, b + 20)},0.95)`);
    gMid.addColorStop(0.6, `rgba(${r},${g},${b},0.92)`);
    gMid.addColorStop(1, `rgba(${r},${g},${b},0.06)`);

    ctx.save();
    ctx.filter = 'blur(1.6px)';
    ctx.fillStyle = gMid;
    ctx.fill();
    ctx.restore();
  })();

  // 3) spikes / arms: thin tapered strokes radiating from the blob
  (function drawSpikes() {
    const spikeCount = 6 + Math.floor(Math.random() * 10);
    for (let s = 0; s < spikeCount; s++) {
      const ang = Math.random() * Math.PI * 2;
      const len = baseR * (0.45 + Math.random() * 1.2);
      const width = 1 + Math.random() * (diameter * 0.02);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      // narrow triangular spike path
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.3, (Math.random() - 0.5) * width * 6, len * 0.6, (Math.random() - 0.5) * width * 3);
      ctx.quadraticCurveTo(len * 0.9, (Math.random() - 0.5) * width * 1.2, len, 0);
      ctx.lineTo(len * 0.9, width * 0.2);
      ctx.quadraticCurveTo(len * 0.6, (Math.random() - 0.5) * width * 2, 0, 0);
      ctx.closePath();

      const spikeGrad = ctx.createLinearGradient(0, 0, len, 0);
      spikeGrad.addColorStop(0, `rgba(${r},${g},${b},0.88)`);
      spikeGrad.addColorStop(1, `rgba(${r},${g},${b},0.02)`);
      ctx.fillStyle = spikeGrad;
      ctx.filter = 'blur(1.2px)';
      ctx.fill();
      ctx.restore();
    }
  })();

  // 4) smear strokes: simulate paint pulled outward
  (function drawSmears() {
    const smearCount = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < smearCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const len = baseR * (0.6 + Math.random() * 1.4);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, (Math.random() - 0.5) * baseR * 0.25);
      ctx.bezierCurveTo(len * 0.2, (Math.random() - 0.5) * baseR * 0.3, len * 0.6, (Math.random() - 0.5) * baseR * 0.15, len, 0);
      ctx.lineWidth = 1 + Math.random() * (diameter * 0.03);
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(${r},${g},${b},${0.85 - Math.random() * 0.5})`;
      ctx.filter = 'blur(0.8px)';
      ctx.stroke();
      ctx.restore();
    }
  })();

  // 5) droplets / splatters: varied circle and oval marks
  (function drawDroplets() {
    const dropletCount = 8 + Math.floor(Math.random() * 22);
    for (let i = 0; i < dropletCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = baseR * (0.35 + Math.random() * 1.6);
      const dx = cx + Math.cos(ang) * dist;
      const dy = cy + Math.sin(ang) * dist;
      const rr = Math.max(1, Math.round(diameter * (0.015 + Math.random() * 0.07)));

      ctx.save();
      // some droplets are ovals — scale transform
      const sx = 0.7 + Math.random() * 0.8;
      const sy = 0.7 + Math.random() * 0.8;
      ctx.translate(dx, dy);
      ctx.scale(sx, sy);
      const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr * 1.6);
      dg.addColorStop(0, `rgba(${r},${g},${b},${0.95 - Math.random() * 0.6})`);
      dg.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = dg;
      ctx.filter = 'blur(0.9px)';
      ctx.beginPath();
      ctx.arc(0, 0, rr * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  })();

  // 6) textured noise overlay (very subtle) to break smoothness
  (function addNoise() {
    const noise = ctx.createImageData(diameter, diameter);
    for (let i = 0; i < noise.data.length; i += 4) {
      const v = Math.floor(Math.random() * 12); // subtle
      noise.data[i] = v;
      noise.data[i + 1] = v;
      noise.data[i + 2] = v;
      noise.data[i + 3] = 6; // low alpha
    }
    ctx.putImageData(noise, 0, 0);
  })();

  return canvas;
}

export function createSplatTexture(colour, diameter) {
  return createSplatCanvas(colour, diameter);
}
