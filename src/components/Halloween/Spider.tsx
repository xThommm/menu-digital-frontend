import { useHalloweenActive } from "../../hooks/useHalloween";

// Araña colgada de un hilo que se balancea. El padre debe ser position:
// relative; `thread` es el largo del hilo en px.
export default function Spider({ thread = 44, className = "" }: { thread?: number; className?: string }) {
  if (!useHalloweenActive()) return null;
  return (
    <div className={`hw-spider ${className}`} style={{ ["--hw-thread" as string]: `${thread}px` }} aria-hidden="true">
      <span className="hw-spider-thread" />
      <svg className="hw-spider-body" width="26" height="22" viewBox="0 0 26 22" focusable="false">
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none">
          <path d="M8 9 3 4 1 8M8 11 2 11 1 16M9 13 4 18 3 21M18 9l5-5 2 4M18 11l6 0 1 5M17 13l5 5 1 3" />
        </g>
        <ellipse cx="13" cy="12" rx="6" ry="6.5" fill="currentColor" />
        <circle cx="10.8" cy="10.5" r="1.2" fill="#ff7518" />
        <circle cx="15.2" cy="10.5" r="1.2" fill="#ff7518" />
      </svg>
    </div>
  );
}
