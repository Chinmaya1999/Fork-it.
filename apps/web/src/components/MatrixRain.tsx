import { useEffect, useRef } from 'react';

/** Soft "code rain" on a transparent canvas. Pauses offscreen / hidden tab; static single frame for reduced motion. */
export default function MatrixRain({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext('2d'); if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chars = '01<>{}[]();=+*/\\|&$#ｱｲｳｴｵｶｷｸｹｺｻｼｽ'.split('');
    const size = 15; let cols = 0, drops: number[] = [], dpr = 1, color = '#4ade80', visible = true, frame = 0, raf = 0, last = 0;
    const resize = () => {
      dpr = Math.min(devicePixelRatio, 2); c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
      cols = Math.ceil(c.clientWidth / size); drops = Array.from({ length: cols }, () => Math.random() * -50);
    };
    resize(); const ro = new ResizeObserver(resize); ro.observe(c);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); io.observe(c);
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden || t - last < 55) return; last = t;
      if (frame++ % 40 === 0) color = getComputedStyle(document.documentElement).getPropertyValue('--holo-a').trim() || color;
      ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'source-over'; ctx.font = `${size * dpr}px "JetBrains Mono", monospace`; ctx.fillStyle = color;
      for (let i = 0; i < cols; i++) {
        ctx.globalAlpha = 0.35 + Math.random() * 0.4;
        ctx.fillText(chars[(Math.random() * chars.length) | 0], i * size * dpr, drops[i] * size * dpr);
        if (drops[i] * size * dpr > c.height && Math.random() > 0.975) drops[i] = 0; drops[i] += 1;
      }
      ctx.globalAlpha = 1;
    };
    if (reduced) { for (let k = 0; k < 40; k++) { drops = drops.map((d) => d + 1); } draw(100); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);
  return <canvas ref={ref} className={className} aria-hidden />;
}
