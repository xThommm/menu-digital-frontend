import { useEffect, useRef } from "react";
import { SWARM_EVENT, type HalloweenLevel } from "../../lib/halloween";

// Murciélagos en un <canvas> fijo, sin eventos. Con mouse orbitan al cursor
// con resorte (cada uno con su radio, fase y velocidad); en pantallas táctiles
// no hay cursor, así que cruzan la pantalla de vez en cuando. Se detienen con
// la pestaña oculta y con prefers-reduced-motion no se montan.
// Además: el cursor deja un rastro de chispas, y el evento SWARM_EVENT (el
// huevo de pascua del interruptor) suelta una lluvia de murciélagos.

type Bat = {
  x: number; y: number; vx: number; vy: number;
  radius: number; phase: number; speed: number; flap: number; scale: number;
};

const COUNT: Record<HalloweenLevel, number> = { full: 6, low: 3 };
// Chispas por cada ~10 px de recorrido del cursor.
const SPARKS: Record<HalloweenLevel, number> = { full: 1, low: 0.4 };
const MAX_SPARKS = 90;

type Spark = { x: number; y: number; vx: number; vy: number; life: number; size: number; hue: number };

function drawBat(ctx: CanvasRenderingContext2D, b: Bat, t: number, alpha: number) {
  const face = b.vx >= 0 ? 1 : -1;
  const flap = Math.sin(t * 0.018 * b.flap + b.phase) ; // -1..1
  const s = 11 * b.scale;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(Math.max(-0.5, Math.min(0.5, b.vy * 0.04)));
  ctx.scale(face, 1);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = "rgba(150, 90, 255, 0.55)";
  ctx.shadowBlur = 9;
  ctx.fillStyle = "#17101f";
  for (const side of [-1, 1]) {
    // Ala: punta que sube y baja con el aleteo; borde inferior festoneado.
    const tipY = -s * (0.2 + 0.9 * flap);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.15);
    ctx.quadraticCurveTo(side * s * 1.0, tipY - s * 0.5, side * s * 2.1, tipY);
    ctx.quadraticCurveTo(side * s * 1.75, tipY + s * 0.55, side * s * 1.45, tipY + s * 0.5 + s * 0.2);
    ctx.quadraticCurveTo(side * s * 1.1, tipY + s * 0.95, side * s * 0.75, tipY + s * 0.7 + s * 0.35);
    ctx.quadraticCurveTo(side * s * 0.4, tipY + s * 1.2, 0, s * 0.55);
    ctx.closePath();
    ctx.fill();
  }
  // Cuerpo y orejas.
  ctx.beginPath();
  ctx.ellipse(0, s * 0.1, s * 0.34, s * 0.62, 0, 0, Math.PI * 2);
  ctx.moveTo(-s * 0.3, -s * 0.4); ctx.lineTo(-s * 0.2, -s * 0.9); ctx.lineTo(-s * 0.02, -s * 0.5);
  ctx.moveTo(s * 0.3, -s * 0.4); ctx.lineTo(s * 0.2, -s * 0.9); ctx.lineTo(s * 0.02, -s * 0.5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ff7518";
  ctx.fillRect(-s * 0.2, -s * 0.2, s * 0.1, s * 0.1);
  ctx.fillRect(s * 0.1, -s * 0.2, s * 0.1, s * 0.1);
  ctx.restore();
}

export default function Bats({ level }: { level: HalloweenLevel }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const alpha = level === "full" ? 0.95 : 0.7;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const mouse = { x: w * 0.7, y: h * 0.3, seen: false };
    const sparks: Spark[] = [];
    const onMove = (e: MouseEvent) => {
      if (mouse.seen) {
        const dist = Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y);
        let n = (dist / 10) * SPARKS[level];
        while (n > 0 && sparks.length < MAX_SPARKS) {
          if (n >= 1 || Math.random() < n) {
            sparks.push({
              x: e.clientX + (Math.random() - 0.5) * 8, y: e.clientY + (Math.random() - 0.5) * 8,
              vx: (Math.random() - 0.5) * 0.9, vy: -0.2 - Math.random() * 0.8,
              life: 1, size: 1.6 + Math.random() * 2.4, hue: 18 + Math.random() * 28,
            });
          }
          n -= 1;
        }
      }
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.seen = true;
    };
    if (fine) window.addEventListener("mousemove", onMove, { passive: true });

    const n = COUNT[level];
    const bats: Bat[] = Array.from({ length: fine ? n : 0 }, (_, i) => ({
      x: Math.random() * w, y: -40 - Math.random() * 80, vx: 0, vy: 0,
      radius: 46 + i * 15 + Math.random() * 14,
      phase: (i / n) * Math.PI * 2,
      speed: (0.0006 + Math.random() * 0.0005) * (i % 2 ? 1 : -1),
      flap: 0.8 + Math.random() * 0.6,
      scale: 0.75 + Math.random() * 0.55,
    }));

    // Táctil: un murciélago cruza cada tanto de un lado al otro.
    const crossers: Bat[] = [];
    let nextCross = performance.now() + 2500;

    // Lluvia del huevo de pascua: caen desde arriba meciéndose.
    const rain: Bat[] = [];
    const onSwarm = () => {
      for (let i = 0; i < 36; i++) {
        rain.push({
          x: Math.random() * w, y: -30 - Math.random() * h * 0.9,
          vx: (Math.random() - 0.5) * 2.4, vy: 2.2 + Math.random() * 2.6,
          radius: 0, phase: Math.random() * 6, speed: 0, flap: 1 + Math.random() * 0.8, scale: 0.7 + Math.random() * 0.9,
        });
      }
    };
    window.addEventListener(SWARM_EVENT, onSwarm);

    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.015; p.life -= 0.02;
        if (p.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.9;
        ctx.fillStyle = `hsl(${p.hue} 100% ${55 + p.life * 20}%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life + 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      for (let i = rain.length - 1; i >= 0; i--) {
        const b = rain[i];
        b.x += b.vx + Math.sin(t * 0.003 + b.phase) * 1.2; b.y += b.vy;
        drawBat(ctx, b, t, 0.95);
        if (b.y > h + 40) rain.splice(i, 1);
      }
      for (const b of bats) {
        const ang = b.phase + t * b.speed;
        const tx = (mouse.seen ? mouse.x : w * 0.75) + Math.cos(ang) * b.radius;
        const ty = (mouse.seen ? mouse.y : h * 0.25) + Math.sin(ang * 1.3) * b.radius * 0.55 - 14;
        b.vx += (tx - b.x) * 0.012; b.vy += (ty - b.y) * 0.012;
        b.vx *= 0.9; b.vy *= 0.9;
        b.x += b.vx; b.y += b.vy;
        drawBat(ctx, b, t, alpha);
      }
      if (!fine && t > nextCross && crossers.length < 2) {
        const ltr = Math.random() > 0.5;
        crossers.push({
          x: ltr ? -30 : w + 30, y: h * (0.12 + Math.random() * 0.5),
          vx: (ltr ? 1 : -1) * (1.6 + Math.random()), vy: 0,
          radius: 0, phase: Math.random() * 6, speed: 0, flap: 1.1, scale: 0.9,
        });
        nextCross = t + 7000 + Math.random() * 8000;
      }
      for (let i = crossers.length - 1; i >= 0; i--) {
        const b = crossers[i];
        b.x += b.vx; b.y += Math.sin(t * 0.004 + b.phase) * 0.8;
        drawBat(ctx, b, t, alpha);
        if (b.x < -60 || b.x > w + 60) crossers.splice(i, 1);
      }
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener(SWARM_EVENT, onSwarm);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [level]);

  return <canvas ref={ref} className="hw-bats" aria-hidden="true" />;
}
