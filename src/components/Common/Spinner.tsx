import { useHalloweenActive } from "../../hooks/useHalloween";

export default function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  // Temporada de Halloween: un murciélago aleteando en lugar del anillo.
  if (useHalloweenActive()) {
    return (
      <svg className="hw-batspin" width={size * 1.5} height={size} viewBox="0 0 36 24"
        fill="currentColor" aria-hidden={label ? undefined : "true"} role={label ? "status" : undefined}
        aria-label={label}>
        <path className="hw-batspin-wing" d="M16 11C12 6 6 5 1 8c3 1 4 3 4 6 2-2 4-2 6 0 1-2 3-2 5-1z" />
        <path className="hw-batspin-wing hw-batspin-wing-r" d="M20 11c4-5 10-6 15-3-3 1-4 3-4 6-2-2-4-2-6 0-1-2-3-2-5-1z" />
        <path d="M18 7l-2.500-4 .5 5c-1 1-1.500 3-1.500 5 0 3 1.500 6 3.500 6s3.500-3 3.500-6c0-2-.5-4-1.500-5l.5-5z" />
      </svg>
    );
  }
  return (
    <svg className="iconSpinner" width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden={label ? undefined : "true"} role={label ? "status" : undefined}
      aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}
