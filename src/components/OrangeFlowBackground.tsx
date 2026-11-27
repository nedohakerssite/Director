import { useEffect, useRef } from 'react';

interface StreamParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ox: number;
  oy: number;
  size: number;
  trailLen: number;
  alpha: number;
  hue: number;
}

export function OrangeFlowBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const mouse = { x: -9999, y: -9999, active: false };
    const REPEL_RADIUS = 155;

    let particles: StreamParticle[] = [];

    function spawnParticle(initial: boolean): StreamParticle {
      // Flow originates from top-right edge and streams diagonally down-left
      let x: number;
      let y: number;
      if (initial) {
        x = Math.random() * (width + 200) - 100;
        y = Math.random() * (height + 200) - 100;
      } else {
        const fromTop = Math.random() < 0.55;
        if (fromTop) {
          x = width * 0.25 + Math.random() * (width * 0.95);
          y = -20 - Math.random() * 80;
        } else {
          x = width + 20 + Math.random() * 80;
          y = -40 + Math.random() * (height * 0.78);
        }
      }

      const speed = 0.55 + Math.random() * 1.15;
      // Diagonal top-right -> bottom-left vector (~132 degrees)
      const angle = (128 + (Math.random() - 0.5) * 14) * (Math.PI / 180);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      return {
        x,
        y,
        vx,
        vy,
        ox: 0,
        oy: 0,
        size: 1.2 + Math.random() * 2.2,
        trailLen: 14 + Math.random() * 34,
        alpha: 0.22 + Math.random() * 0.55,
        hue: 18 + Math.random() * 22, // Rich deep orange to warm amber (18°–40°)
      };
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount = Math.min(130, Math.max(65, Math.floor((width * height) / 14500)));
      if (particles.length === 0) {
        particles = Array.from({ length: targetCount }, () => spawnParticle(true));
      } else if (particles.length < targetCount) {
        while (particles.length < targetCount) {
          particles.push(spawnParticle(true));
        }
      } else if (particles.length > targetCount) {
        particles.length = targetCount;
      }
    }

    function drawFrame() {
      ctx!.clearRect(0, 0, width, height);

      // Deep black base
      ctx!.fillStyle = '#070709';
      ctx!.fillRect(0, 0, width, height);

      // Top-right warm orange atmospheric source glow
      const topRightGlow = ctx!.createRadialGradient(
        width * 0.96,
        height * 0.02,
        10,
        width * 0.85,
        height * 0.14,
        Math.max(width, height) * 0.72
      );
      topRightGlow.addColorStop(0, 'rgba(249, 115, 22, 0.22)');
      topRightGlow.addColorStop(0.28, 'rgba(234, 88, 12, 0.10)');
      topRightGlow.addColorStop(0.62, 'rgba(154, 52, 18, 0.03)');
      topRightGlow.addColorStop(1, 'rgba(7, 7, 9, 0)');
      ctx!.fillStyle = topRightGlow;
      ctx!.fillRect(0, 0, width, height);

      // Subtle diagonal orange wash band from top-right to bottom-left
      const diagonalWash = ctx!.createLinearGradient(width, 0, width * 0.1, height);
      diagonalWash.addColorStop(0, 'rgba(251, 146, 60, 0.07)');
      diagonalWash.addColorStop(0.5, 'rgba(234, 88, 12, 0.025)');
      diagonalWash.addColorStop(1, 'rgba(7, 7, 9, 0)');
      ctx!.fillStyle = diagonalWash;
      ctx!.fillRect(0, 0, width, height);

      // Update positions & cursor parting displacement
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Respawn off bottom or left edge back at top-right source
          if (p.x < -120 || p.y > height + 120) {
            const fresh = spawnParticle(false);
            p.x = fresh.x;
            p.y = fresh.y;
            p.vx = fresh.vx;
            p.vy = fresh.vy;
            p.ox = 0;
            p.oy = 0;
          }
        }

        // Smooth parting repulsion around mouse cursor
        let targetOx = 0;
        let targetOy = 0;
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < REPEL_RADIUS * REPEL_RADIUS && distSq > 0.01) {
            const dist = Math.sqrt(distSq);
            const force = Math.pow(1 - dist / REPEL_RADIUS, 1.8) * 58;
            targetOx = (dx / dist) * force;
            targetOy = (dy / dist) * force;
          }
        }

        // Elastic ease toward displaced offset and smooth return when cursor leaves
        p.ox += (targetOx - p.ox) * 0.14;
        p.oy += (targetOy - p.oy) * 0.14;
      }

      // Faint orange geometric filaments between nearby stream particles
      ctx!.lineWidth = 0.7;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const ax = a.x + a.ox;
        const ay = a.y + a.oy;

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const bx = b.x + b.ox;
          const by = b.y + b.oy;
          const dx = ax - bx;
          const dy = ay - by;
          const d2 = dx * dx + dy * dy;
          if (d2 < 115 * 115) {
            const dist = Math.sqrt(d2);
            const lineAlpha = (1 - dist / 115) * 0.11;
            ctx!.strokeStyle = `rgba(249, 115, 22, ${lineAlpha.toFixed(3)})`;
            ctx!.beginPath();
            ctx!.moveTo(ax, ay);
            ctx!.lineTo(bx, by);
            ctx!.stroke();
          }
        }
      }

      // Draw flowing orange ember streaks & glowing cores
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const rx = p.x + p.ox;
        const ry = p.y + p.oy;

        // Normalize velocity to extend tail back toward top-right
        const speed = Math.hypot(p.vx, p.vy) || 1;
        const tailX = rx - (p.vx / speed) * p.trailLen;
        const tailY = ry - (p.vy / speed) * p.trailLen;

        const grad = ctx!.createLinearGradient(rx, ry, tailX, tailY);
        grad.addColorStop(0, `hsla(${p.hue}, 95%, 62%, ${p.alpha.toFixed(3)})`);
        grad.addColorStop(1, `hsla(${p.hue}, 95%, 50%, 0)`);

        ctx!.strokeStyle = grad;
        ctx!.lineWidth = p.size * 0.9;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(rx, ry);
        ctx!.lineTo(tailX, tailY);
        ctx!.stroke();

        // Bright ember dot
        ctx!.fillStyle = `hsla(${p.hue + 6}, 100%, 72%, ${Math.min(0.95, p.alpha + 0.18).toFixed(3)})`;
        ctx!.beginPath();
        ctx!.arc(rx, ry, p.size * 0.85, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function onPointerMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    }

    function onPointerLeave() {
      mouse.active = false;
    }

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('blur', onPointerLeave);

    let rafId = 0;
    if (reducedMotion) {
      drawFrame();
    } else {
      const loop = () => {
        drawFrame();
        rafId = window.requestAnimationFrame(loop);
      };
      rafId = window.requestAnimationFrame(loop);
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('blur', onPointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none select-none"
    />
  );
}
