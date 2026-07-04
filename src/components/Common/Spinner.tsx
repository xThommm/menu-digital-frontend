export default function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg className="iconSpinner" width={size} height={size} viewBox="0 0 24 24"
      fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}
