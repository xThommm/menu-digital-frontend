export default function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <svg className="iconSpinner" width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden={label ? undefined : "true"} role={label ? "status" : undefined}
      aria-label={label}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}
