import { useHalloweenActive } from "../../hooks/useHalloween";

// Calabaza tallada con la vela parpadeando adentro. `className` la ubica
// (hw-pumpkin-bl / hw-pumpkin-br, o una clase del módulo); el padre debe ser
// position: relative.
export default function Pumpkin({ size = 64, className = "" }: { size?: number; className?: string }) {
  if (!useHalloweenActive()) return null;
  return (
    <svg
      className={`hw-pumpkin ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M32 16c1-6 5-10 10-10" stroke="#357a22" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="32" cy="38" rx="27" ry="22" fill="#e8650f" />
      <ellipse cx="32" cy="38" rx="15" ry="22" fill="#ff7518" />
      <ellipse cx="32" cy="38" rx="6" ry="22" fill="#ff8a2b" />
      <g className="hw-pumpkin-face" fill="#ffd95a">
        <path d="M17 30l7 9H11zM47 30l7 9H40zM32 36l3.5 5h-7z" />
        <path d="M14 45l5 4 4.5-4 4.5 4 4-4 4 4 4.500-4 4.500 4 5-4-2 7-5 3-4.500-3-4 3-4-3-4.500 3-4.500-3-5 0z" />
      </g>
    </svg>
  );
}
