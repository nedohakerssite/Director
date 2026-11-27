import { useEffect, useRef } from 'react';

interface Snowflake {
  x: number;
  y: number;
  r: number;
  speedY: number;
  driftX: number;
  phase: number;
  phaseSpeed: number;
  alpha: number;
  warm: boolean;
}

export function SnowfallOverlay({ enabled }: { enabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const flakeCount = Math.min(130, Math.max(48, Math.floor((width * height) / 14000)));
    const flakes: Snowflake[] = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.1 + Math.random() * 2.5,
      speedY: 0.45 + Math.random() * 1.15,
      driftX: -0.25 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: 0.008 + Math.random() * 0.018,
      alpha: 0.35 + Math.random() * 0.55,
      warm: Math.random() < 0.14,
    }));

    const drawFrame = (animate: boolean) => {
      ctx.clearRect(0, 0, width, height);

      for (const f of flakes) {
        if (animate) {
          f.phase += f.phaseSpeed;
          f.y += f.speedY;
          f.x += f.driftX + Math.sin(f.phase) * 0.45;

          if (f.y > height + f.r * 2) {
            f.y = -f.r * 2;
            f.x = Math.random() * width;
          }
          if (f.x > width + 10) f.x = -10;
          if (f.x < -10) f.x = width + 10;
        }

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = f.warm
          ? `rgba(255, 226, 196, ${f.alpha * 0.85})`
          : `rgba(255, 255, 255, ${f.alpha})`;
        ctx.fill();
      }
    };

    if (prefersReduced) {
      drawFrame(false);
      return () => {
        window.removeEventListener('resize', resize);
      };
    }

    let rafId = 0;
    const loop = () => {
      drawFrame(true);
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-40 pointer-events-none select-none"
    />
  );
}
