export function launchConfetti(): void {
  if (document.getElementById('confetti-canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  canvas.width = document.body.clientWidth;
  canvas.height = document.body.clientHeight;

  const colors = ['#f94144', '#f3722c', '#f9c74f', '#90be6d', '#43aa8b', '#577590', '#a855f7'];
  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -100,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.15,
    vx: (Math.random() - 0.5) * 2,
    vy: 2 + Math.random() * 3,
  }));

  let frame: number;
  const start = performance.now();
  const duration = 2800;

  function draw(now: number) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (elapsed < duration) {
      frame = requestAnimationFrame(draw);
    } else {
      canvas.remove();
    }
  }

  frame = requestAnimationFrame(draw);
  window.addEventListener(
    'unload',
    () => {
      cancelAnimationFrame(frame);
      canvas.remove();
    },
    { once: true }
  );
}
