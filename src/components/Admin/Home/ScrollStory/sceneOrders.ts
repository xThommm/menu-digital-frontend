import { easeInOut, lerp, range, seeded, type SceneEnv, type SceneRenderer } from "./useScrollScene";

// Escena 2 — "El pedido": un salón de nueve mesas. A medida que se avanza,
// salen comandas de las mesas como cometas que viajan hasta su sector
// (cocina o barra); al llegar, el sector late y suma una al contador.

const SECTORS = ["COCINA", "BARRA"] as const;
const TRAVEL = 0.16;
const ORDERS = [
  { table: 3, sector: 0, at: 0.04 },
  { table: 6, sector: 1, at: 0.12 },
  { table: 0, sector: 0, at: 0.2 },
  { table: 8, sector: 0, at: 0.3 },
  { table: 2, sector: 1, at: 0.38 },
  { table: 4, sector: 0, at: 0.48 },
  { table: 7, sector: 1, at: 0.56 },
  { table: 1, sector: 0, at: 0.64 },
  { table: 5, sector: 1, at: 0.72 },
];
const DUST = 90;

interface Point { x: number; y: number }

export function createOrdersScene(env: SceneEnv): SceneRenderer {
  const rand = seeded(21);
  const dust = Array.from({ length: DUST }, () => ({
    x: rand(), y: rand(), r: 0.5 + rand(), a: 0.06 + rand() * 0.2, s: rand() * 10,
  }));

  let w = 0, h = 0, cell = 0, node = 0, wide = true;
  let tables: Point[] = [];
  let sectors: Point[] = [];

  // Curva de cada comanda: cuadrática con el control corrido hacia un lado,
  // alternando, para que los recorridos no se pisen.
  const curve = (from: Point, to: Point, bend: number, t: number): Point => {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const c = { x: mx - dy * bend, y: my + dx * bend };
    const u = 1 - t;
    return {
      x: u * u * from.x + 2 * u * t * c.x + t * t * to.x,
      y: u * u * from.y + 2 * u * t * c.y + t * t * to.y,
    };
  };

  const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number) => {
    ctx.font = `600 ${px}px ${env.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
  };

  return {
    resize(width, height) {
      w = width;
      h = height;
      wide = w >= 900;
      cell = wide ? Math.min(w * 0.075, h * 0.13, 110) : Math.min(w * 0.2, h * 0.09);
      node = wide ? Math.min(cell * 0.42, 40) : cell * 0.42;
      const gx = wide ? w * 0.6 : w * 0.5;
      const gy = wide ? h * 0.52 : h * 0.6;
      tables = Array.from({ length: 9 }, (_, i) => ({
        x: gx + ((i % 3) - 1) * cell * 1.35,
        y: gy + (Math.floor(i / 3) - 1) * cell * 1.35,
      }));
      sectors = wide
        ? [{ x: w * 0.88, y: h * 0.34 }, { x: w * 0.88, y: h * 0.7 }]
        : [{ x: w * 0.28, y: h * 0.88 }, { x: w * 0.72, y: h * 0.88 }];
    },

    render(ctx, p, time) {
      const appear = easeInOut(range(p, 0, 0.06));

      ctx.fillStyle = env.ink;
      for (const d of dust) {
        const x = ((d.x * w + Math.sin(time * 0.12 + d.s) * 24) % w + w) % w;
        const y = ((d.y * h - time * 4 * d.r) % h + h) % h;
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Plano del salón: grilla de puntos tenue detrás de las mesas.
      const g0 = tables[0];
      const span = cell * 1.35;
      ctx.globalAlpha = 0.12 * appear;
      for (let gx = g0.x - span * 1.2; gx <= g0.x + span * 3.2; gx += span / 3) {
        for (let gy = g0.y - span * 1.2; gy <= g0.y + span * 3.2; gy += span / 3) {
          ctx.fillRect(gx, gy, 1.2, 1.2);
        }
      }

      const arrived = [0, 0];
      const busy = new Set<number>();

      // Recorridos y cometas.
      ORDERS.forEach((order, i) => {
        const q = range(p, order.at, order.at + TRAVEL);
        if (q <= 0) return;
        const from = tables[order.table];
        const to = sectors[order.sector];
        const bend = (i % 2 ? 1 : -1) * 0.18;
        if (q < 1) busy.add(order.table);
        else arrived[order.sector]++;

        ctx.strokeStyle = env.accent;
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = q < 1 ? 0.4 : 0.14;
        ctx.beginPath();
        const steps = 28;
        for (let s = 0; s <= steps; s++) {
          const pt = curve(from, to, bend, (s / steps) * q);
          if (s === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();

        if (q < 1) {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = env.accent;
          for (let k = 9; k >= 0; k--) {
            const pt = curve(from, to, bend, Math.max(0, q - k * 0.018));
            ctx.globalAlpha = (1 - k / 10) * 0.9;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, lerp(4.2, 1, k / 9), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalCompositeOperation = "source-over";
        }

        // Al llegar, el sector late una vez.
        const pulse = range(p, order.at + TRAVEL, order.at + TRAVEL + 0.07);
        if (pulse > 0 && pulse < 1) {
          ctx.strokeStyle = env.accent;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 1 - pulse;
          ctx.beginPath();
          ctx.arc(to.x, to.y, node + pulse * node * 1.4, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      // Mesas: se encienden mientras su comanda viaja.
      const r = cell * 0.36;
      tables.forEach((t, i) => {
        const lit = busy.has(i);
        ctx.globalAlpha = appear * (lit ? 0.3 : 0.06);
        ctx.fillStyle = env.accent;
        ctx.beginPath();
        ctx.roundRect(t.x - r, t.y - r, r * 2, r * 2, r * 0.35);
        ctx.fill();
        ctx.globalAlpha = appear * (lit ? 0.95 : 0.35);
        ctx.strokeStyle = lit ? env.accent : env.ink;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = env.ink;
        ctx.globalAlpha = appear * (lit ? 1 : 0.55);
        label(ctx, String(i + 1), t.x, t.y, Math.max(11, r * 0.55));
      });

      // Sectores, con la cantidad de comandas recibidas.
      sectors.forEach((s, i) => {
        const filled = Math.min(1, arrived[i] / 4);
        ctx.globalAlpha = appear * (0.1 + filled * 0.35);
        ctx.fillStyle = env.accent;
        ctx.beginPath();
        ctx.arc(s.x, s.y, node, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = appear * 0.8;
        ctx.strokeStyle = env.accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = env.ink;
        ctx.globalAlpha = appear;
        label(ctx, String(arrived[i]), s.x, s.y, node * 0.7);
        ctx.globalAlpha = appear * 0.7;
        label(ctx, SECTORS[i], s.x, s.y + node + 16, 11);
      });

      // Contador general.
      const sent = arrived[0] + arrived[1] + busy.size;
      ctx.globalAlpha = appear * 0.75;
      ctx.fillStyle = env.ink;
      ctx.font = `600 11px ${env.font}`;
      ctx.textAlign = wide ? "right" : "center";
      ctx.textBaseline = "alphabetic";
      const hudX = wide ? w - 32 : w / 2;
      const hudY = wide ? h - 32 : h * 0.97;
      ctx.fillText(`COMANDAS ENVIADAS  ${String(sent).padStart(2, "0")}`, hudX, hudY);

      ctx.globalAlpha = 1;
    },
  };
}
