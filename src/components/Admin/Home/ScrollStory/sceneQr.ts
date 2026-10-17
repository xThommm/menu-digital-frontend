import QRCode from "qrcode";
import { easeInOut, lerp, range, seeded, type SceneEnv, type SceneRenderer } from "./useScrollScene";

// Escena 1 — "La carta": partículas sueltas que se ordenan en un QR real,
// lo cruza una línea de escaneo y el QR se rearma como la carta dentro de
// un celular. Cada partícula es un módulo oscuro del QR.

const QR_TEXT = "https://www.menudigitalapp.com.ar";
const DUST = 140;

// Contenido de ejemplo de la carta que aparece al final de la escena.
const MENU = {
  place: "Café del Patio",
  status: "Mesa 4 · Abierto ahora",
  categories: ["Cafetería", "Cocina", "Bebidas"],
  items: [
    { name: "Espresso", note: "Blend de la casa", price: "$2.800" },
    { name: "Café con leche", note: "Con leche texturizada", price: "$3.500" },
    { name: "Medialunas x3", note: "De manteca, recién horneadas", price: "$2.400" },
    { name: "Tostado de miga", note: "Jamón y queso", price: "$5.900" },
    { name: "Limonada", note: "Menta y jengibre", price: "$3.200" },
  ],
  cta: "Ver mi pedido · 2",
};

export function createQrScene(env: SceneEnv): SceneRenderer {
  const qr = QRCode.create(QR_TEXT, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col)) cells.push([col, row]);
    }
  }
  const count = cells.length;
  const rand = seeded(7);

  // Salida: dirección y distancia al centro (normalizadas), y un desfase.
  const angle = Float32Array.from({ length: count }, () => rand() * Math.PI * 2);
  const reach = Float32Array.from({ length: count }, () => 0.18 + rand() * 0.62);
  const delay = Float32Array.from({ length: count }, () => rand());
  const dust = Array.from({ length: DUST }, () => ({
    x: rand(), y: rand(), r: 0.6 + rand() * 1.1, a: 0.08 + rand() * 0.25, s: rand() * 10,
  }));

  // Destinos en píxeles, recalculados en cada resize.
  const qrX = new Float32Array(count);
  const qrY = new Float32Array(count);
  const menuX = new Float32Array(count);
  const menuY = new Float32Array(count);
  let w = 0, h = 0, cx = 0, cy = 0, size = 0, module = 0;

  // Celular donde termina la escena (las partículas dibujan su esqueleto y
  // después aparece la carta de verdad en el mismo lugar).
  let pw = 0, ph = 0, x0 = 0, y0 = 0;

  // Esqueleto de la carta: contorno del celular, cabecera y renglones de
  // platos con su precio. Se muestrea a lo largo de todos los trazos, en orden.
  function layoutMenu() {
    const segments: Array<[number, number, number, number]> = [
      [x0, y0, x0 + pw, y0],
      [x0 + pw, y0, x0 + pw, y0 + ph],
      [x0 + pw, y0 + ph, x0, y0 + ph],
      [x0, y0 + ph, x0, y0],
      [cx - pw * 0.14, y0 + ph * 0.035, cx + pw * 0.14, y0 + ph * 0.035],
      [x0 + pw * 0.14, y0 + ph * 0.13, x0 + pw * 0.62, y0 + ph * 0.13],
      [x0 + pw * 0.14, y0 + ph * 0.18, x0 + pw * 0.4, y0 + ph * 0.18],
    ];
    const names = [0.5, 0.36, 0.44, 0.3, 0.4];
    names.forEach((len, i) => {
      const y = y0 + ph * (0.3 + i * 0.13);
      segments.push([x0 + pw * 0.14, y, x0 + pw * (0.14 + len), y]);
      segments.push([x0 + pw * 0.14, y + ph * 0.035, x0 + pw * (0.14 + len * 0.6), y + ph * 0.035]);
      segments.push([x0 + pw * 0.7, y, x0 + pw * 0.86, y]);
    });

    const lengths = segments.map(([ax, ay, bx, by]) => Math.hypot(bx - ax, by - ay));
    const total = lengths.reduce((sum, len) => sum + len, 0);
    let seg = 0;
    let walked = 0;
    for (let i = 0; i < count; i++) {
      const at = (i / count) * total;
      while (seg < segments.length - 1 && walked + lengths[seg] < at) walked += lengths[seg++];
      const [ax, ay, bx, by] = segments[seg];
      const t = lengths[seg] ? (at - walked) / lengths[seg] : 0;
      menuX[i] = lerp(ax, bx, t);
      menuY[i] = lerp(ay, by, t);
    }
  }

  // Recorta el texto con "…" si no entra en el ancho disponible.
  function fit(ctx: CanvasRenderingContext2D, text: string, max: number) {
    if (ctx.measureText(text).width <= max) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
    return `${cut}…`;
  }

  // La carta tal como la ve el cliente: local, categorías, platos con foto,
  // descripción y precio, y el botón del pedido. Aparece sobre el esqueleto
  // de partículas con un leve ascenso.
  function drawMenu(ctx: CanvasRenderingContext2D, t: number) {
    const lift = (1 - t) * 14;
    const top = y0 + lift;
    const radius = pw * 0.1;
    const pad = pw * 0.08;

    ctx.save();
    ctx.globalAlpha = t;

    // Carcasa y pantalla.
    ctx.fillStyle = env.bg;
    ctx.beginPath();
    ctx.roundRect(x0, top, pw, ph, radius);
    ctx.fill();
    ctx.save();
    ctx.clip();
    const tint = ctx.createLinearGradient(0, top, 0, top + ph * 0.4);
    tint.addColorStop(0, env.accent);
    tint.addColorStop(1, "transparent");
    ctx.globalAlpha = t * 0.14;
    ctx.fillStyle = tint;
    ctx.fillRect(x0, top, pw, ph * 0.4);
    ctx.restore();
    ctx.globalAlpha = t;
    ctx.strokeStyle = env.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x0, top, pw, ph, radius);
    ctx.stroke();
    ctx.fillStyle = env.ink;
    ctx.globalAlpha = t * 0.25;
    ctx.beginPath();
    ctx.roundRect(cx - pw * 0.13, top + ph * 0.022, pw * 0.26, ph * 0.016, ph * 0.008);
    ctx.fill();

    // Cabecera del local.
    const left = x0 + pad;
    const right = x0 + pw - pad;
    const inner = right - left;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.globalAlpha = t;
    ctx.fillStyle = env.ink;
    ctx.font = `800 ${Math.max(14, pw * 0.082)}px ${env.sans}`;
    ctx.fillText(fit(ctx, MENU.place, inner), left, top + ph * 0.12);
    ctx.globalAlpha = t * 0.6;
    ctx.font = `500 ${Math.max(9.5, pw * 0.04)}px ${env.sans}`;
    ctx.fillText(fit(ctx, MENU.status, inner), left, top + ph * 0.157);

    // Categorías.
    const chipH = ph * 0.04;
    const chipY = top + ph * 0.185;
    let chipX = left;
    ctx.font = `600 ${Math.max(9, pw * 0.038)}px ${env.sans}`;
    MENU.categories.forEach((cat, i) => {
      const cw = ctx.measureText(cat).width + pw * 0.07;
      if (chipX + cw > right) return;
      ctx.globalAlpha = t * (i === 0 ? 1 : 0.5);
      ctx.fillStyle = i === 0 ? env.accent : "transparent";
      ctx.strokeStyle = i === 0 ? env.accent : env.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(chipX, chipY, cw, chipH, chipH / 2);
      if (i === 0) ctx.fill();
      else ctx.stroke();
      ctx.globalAlpha = t;
      ctx.fillStyle = i === 0 ? env.bg : env.ink;
      ctx.textBaseline = "middle";
      ctx.fillText(cat, chipX + pw * 0.035, chipY + chipH / 2 + 0.5);
      chipX += cw + pw * 0.025;
    });

    // Platos.
    const thumb = ph * 0.07;
    const rowH = ph * 0.112;
    MENU.items.forEach((item, i) => {
      const ry = top + ph * 0.265 + i * rowH;
      const tx = left;
      const shade = ctx.createLinearGradient(tx, ry, tx + thumb, ry + thumb);
      shade.addColorStop(0, env.accent);
      shade.addColorStop(1, env.bg);
      ctx.globalAlpha = t * (0.55 + (i % 3) * 0.15);
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.roundRect(tx, ry, thumb, thumb, thumb * 0.22);
      ctx.fill();

      const textX = tx + thumb + pw * 0.045;
      ctx.font = `700 ${Math.max(10, pw * 0.042)}px ${env.sans}`;
      const price = item.price;
      const priceW = ctx.measureText(price).width;
      const nameMax = right - textX - priceW - pw * 0.04;

      ctx.textBaseline = "alphabetic";
      ctx.globalAlpha = t;
      ctx.fillStyle = env.accent;
      ctx.textAlign = "right";
      ctx.fillText(price, right, ry + thumb * 0.42);
      ctx.textAlign = "left";
      ctx.fillStyle = env.ink;
      ctx.font = `700 ${Math.max(10.5, pw * 0.048)}px ${env.sans}`;
      ctx.fillText(fit(ctx, item.name, nameMax), textX, ry + thumb * 0.42);
      ctx.globalAlpha = t * 0.55;
      ctx.font = `400 ${Math.max(9, pw * 0.036)}px ${env.sans}`;
      ctx.fillText(fit(ctx, item.note, right - textX), textX, ry + thumb * 0.82);

      if (i < MENU.items.length - 1) {
        ctx.globalAlpha = t * 0.1;
        ctx.fillStyle = env.ink;
        ctx.fillRect(left, ry + rowH - ph * 0.02, inner, 1);
      }
    });

    // Botón del pedido.
    const btnH = ph * 0.065;
    const btnY = top + ph - pad - btnH;
    ctx.globalAlpha = t;
    ctx.fillStyle = env.accent;
    ctx.beginPath();
    ctx.roundRect(left, btnY, inner, btnH, btnH / 2);
    ctx.fill();
    ctx.fillStyle = env.bg;
    ctx.font = `800 ${Math.max(10, pw * 0.044)}px ${env.sans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(MENU.cta, cx, btnY + btnH / 2 + 0.5);

    ctx.restore();
  }

  return {
    resize(width, height) {
      w = width;
      h = height;
      const wide = w >= 900;
      cx = wide ? w * 0.68 : w * 0.5;
      cy = wide ? h * 0.52 : h * 0.62;
      size = wide ? Math.min(h * 0.56, w * 0.34) : Math.min(w * 0.66, h * 0.4);
      module = size / n;
      // En angosto el texto ocupa la parte de arriba: el celular se apoya
      // contra el borde inferior y no pasa del 58% del alto.
      pw = wide ? size * 0.6 : Math.min(w * 0.6, 260, (h * 0.58) / 1.86);
      ph = pw * 1.86;
      x0 = cx - pw / 2;
      y0 = wide ? cy - ph / 2 : h - ph - 28;
      cells.forEach(([col, row], i) => {
        qrX[i] = cx - size / 2 + (col + 0.5) * module;
        qrY[i] = cy - size / 2 + (row + 0.5) * module;
      });
      layoutMenu();
    },

    render(ctx, p, time) {
      const far = Math.max(w, h) * 0.62;
      const gather = range(p, 0.02, 0.42);
      const morph = range(p, 0.56, 0.8);
      const reveal = easeInOut(range(p, 0.74, 0.9));

      // Polvo de fondo, siempre a la deriva.
      ctx.fillStyle = env.ink;
      for (const d of dust) {
        const x = ((d.x * w + Math.sin(time * 0.15 + d.s) * 30) % w + w) % w;
        const y = ((d.y * h - time * 6 * d.r) % h + h) % h;
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Brillo detrás del QR, que se enciende a medida que se arma.
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.95);
      glow.addColorStop(0, env.accent);
      glow.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.16 * easeInOut(gather) * (1 - morph * 0.5);
      ctx.fillStyle = glow;
      ctx.fillRect(cx - size, cy - size, size * 2, size * 2);

      ctx.fillStyle = env.accent;
      for (let i = 0; i < count; i++) {
        const a = easeInOut(Math.min(1, Math.max(0, gather * 1.6 - delay[i] * 0.6)));
        const b = easeInOut(Math.min(1, Math.max(0, morph * 1.5 - (i / count) * 0.5)));
        const drift = (1 - a) * 18;
        const sx = cx + Math.cos(angle[i]) * reach[i] * far + Math.sin(time * 0.4 + delay[i] * 9) * drift;
        const sy = cy + Math.sin(angle[i]) * reach[i] * far + Math.cos(time * 0.35 + delay[i] * 7) * drift;
        const x = lerp(lerp(sx, qrX[i], a), menuX[i], b);
        const y = lerp(lerp(sy, qrY[i], a), menuY[i], b);
        const side = lerp(lerp(2.8, module * 0.86, a), 3.4, b);
        ctx.globalAlpha = (0.55 + 0.45 * Math.max(a, b)) * (1 - reveal);
        ctx.fillRect(x - side / 2, y - side / 2, side, side);
      }

      if (reveal > 0) drawMenu(ctx, reveal);

      // La línea de escaneo cruza el QR ya armado.
      const scan = range(p, 0.43, 0.57);
      if (scan > 0 && scan < 1) {
        const y = cy - size / 2 - module + (size + module * 2) * scan;
        const band = ctx.createLinearGradient(0, y - size * 0.18, 0, y);
        band.addColorStop(0, "transparent");
        band.addColorStop(1, env.ink);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = band;
        ctx.fillRect(cx - size * 0.6, y - size * 0.18, size * 1.2, size * 0.18);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = env.ink;
        ctx.fillRect(cx - size * 0.6, y - 1, size * 1.2, 2);
      }

      ctx.globalAlpha = 1;
    },
  };
}
