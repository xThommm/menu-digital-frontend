// "Descargar como imagen" (menú contextual de un gráfico de Estadísticas).
// Los gráficos son barras en CSS, así que la imagen no es una captura: se
// vuelve a dibujar el mismo gráfico como SVG a partir de los datos (se prueba
// con node --test) y el navegador lo pasa a PNG.

export interface ChartImagePoint {
  /** Etiqueta corta del eje ("14/10"). */
  label: string;
  value: number;
}

export interface ChartImageOptions {
  title: string;
  /** Debajo del título, ej. el período. */
  subtitle?: string;
  points: ChartImagePoint[];
  formatAxis: (value: number) => string;
}

export const CHART_IMAGE_SIZE = { width: 1200, height: 630 };

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" }[char]!));

// Tope "redondo" del eje: 1, 2 o 5 × 10^n.
const roundMax = (value: number) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find(factor => factor * power >= value) ?? 10;
  return step * power;
};

export function chartSvg({ title, subtitle, points, formatAxis }: ChartImageOptions): string {
  const { width, height } = CHART_IMAGE_SIZE;
  const left = 96;
  const right = 40;
  const top = subtitle ? 140 : 110;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const max = roundMax(Math.max(0, ...points.map(point => point.value)));
  const slot = points.length > 0 ? plotWidth / points.length : plotWidth;
  const barWidth = Math.max(2, slot * 0.7);
  // Etiquetas del eje X: no más de ~10 para que no se pisen.
  const labelEvery = Math.max(1, Math.ceil(points.length / 10));
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const num = (value: number) => Math.round(value * 10) / 10;

  const grid = [0, 0.5, 1].map(fraction => {
    const value = max * fraction;
    return `<line x1="${left}" x2="${width - right}" y1="${num(y(value))}" y2="${num(y(value))}" stroke="#e2e2e2" />`
      + `<text x="${left - 12}" y="${num(y(value)) + 6}" text-anchor="end" font-size="18" fill="#666">${escapeXml(formatAxis(value))}</text>`;
  }).join("");

  const bars = points.map((point, index) => {
    const x = left + index * slot + (slot - barWidth) / 2;
    const barHeight = point.value > 0 ? Math.max((point.value / max) * plotHeight, 2) : 0;
    const bar = `<rect x="${num(x)}" y="${num(top + plotHeight - barHeight)}" width="${num(barWidth)}" height="${num(barHeight)}" rx="3" fill="#2f6fed" />`;
    const label = index % labelEvery === 0 || index === points.length - 1
      ? `<text x="${num(x + barWidth / 2)}" y="${height - bottom + 30}" text-anchor="middle" font-size="16" fill="#666">${escapeXml(point.label)}</text>`
      : "";
    return bar + label;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="system-ui, sans-serif">`
    + `<rect width="${width}" height="${height}" fill="#ffffff" />`
    + `<text x="${left}" y="64" font-size="32" font-weight="700" fill="#111">${escapeXml(title)}</text>`
    + (subtitle ? `<text x="${left}" y="100" font-size="20" fill="#555">${escapeXml(subtitle)}</text>` : "")
    + grid + bars
    + `</svg>`;
}

/** "visitas-por-dia-2026-10-14.png" */
export const chartFileName = (title: string, today = new Date()) => {
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "grafico";
  return `${slug}-${today.toISOString().slice(0, 10)}.png`;
};

/** Pasa el SVG a PNG en un canvas y lo descarga. */
export function downloadChartPng(svg: string, fileName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CHART_IMAGE_SIZE.width;
      canvas.height = CHART_IMAGE_SIZE.height;
      const context = canvas.getContext("2d");
      URL.revokeObjectURL(url);
      if (!context) { reject(new Error("Sin canvas")); return; }
      context.drawImage(image, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("Sin imagen")); return; }
        const link = document.createElement("a");
        const href = URL.createObjectURL(blob);
        link.href = href;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(href);
        resolve();
      }, "image/png");
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo dibujar el gráfico")); };
    image.src = url;
  });
}
