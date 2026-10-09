import { useHalloweenActive } from "../../hooks/useHalloween";

// Telaraña de esquina: radios desde (0,0) y arcos que se hunden hacia el
// centro. Se dibuja una sola vez; las otras esquinas se espejan con CSS.
const RADIALS = [0, 22.5, 45, 67.5, 90].map((deg) => {
  const a = (deg * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) };
});
const RINGS = [22, 40, 58, 76, 94];

const WEB_PATH = (() => {
  const parts: string[] = [];
  for (const r of [100]) {
    for (const p of RADIALS) parts.push(`M0 0L${(p.x * r).toFixed(1)} ${(p.y * r).toFixed(1)}`);
  }
  for (const r of RINGS) {
    for (let i = 0; i < RADIALS.length - 1; i++) {
      const a = RADIALS[i], b = RADIALS[i + 1];
      const mx = ((a.x + b.x) / 2) * r * 0.84;
      const my = ((a.y + b.y) / 2) * r * 0.84;
      parts.push(`M${(a.x * r).toFixed(1)} ${(a.y * r).toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${(b.x * r).toFixed(1)} ${(b.y * r).toFixed(1)}`);
    }
  }
  return parts.join("");
})();

type Props = {
  corner?: "tl" | "tr" | "bl" | "br";
  /** Lado en px. */
  size?: number;
  className?: string;
};

// El padre debe ser position: relative (y suele convenirle overflow: hidden).
export default function Cobweb({ corner = "tr", size = 96, className = "" }: Props) {
  if (!useHalloweenActive()) return null;
  return (
    <svg
      className={`hw-web hw-web-${corner} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      <path d={WEB_PATH} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
