type BrandMarkProps = {
  className?: string;
  /** Usa un <svg> inline en vez de <img>, para poder recolorear el fondo
   *  del ícono por CSS vía `color` (ej. el panel CEO, que lo pinta con
   *  --admin-gold). El documento, el plegado y los detalles grises no
   *  cambian de color. */
  inline?: boolean;
};

export default function BrandMark({ className, inline }: BrandMarkProps) {
  const cls = `md-brand-mark${className ? ` ${className}` : ""}`;

  if (inline) {
    // Mismo dibujo que public/brand/menu-digital-logo-mark.svg — si cambia
    // uno, actualizar el otro.
    return (
      <svg className={cls} viewBox="0 0 512 512" aria-hidden="true">
        <rect x="0" y="0" width="512" height="512" rx="110" ry="110" fill="currentColor" />
        <rect x="128" y="102.4" width="256" height="307.2" fill="#FFFFFF" />
        <polygon points="314,102.4 384,102.4 384,172.4" fill="#000000" />
        <rect x="180" y="308" width="50" height="50" rx="6" ry="6" fill="#8F8A85" />
        <path d="M152 352 H165 V372 H185 V384 H163 Q152 384 152 375 V352 Z" fill="#8F8A85" />
      </svg>
    );
  }

  return (
    <img
      src="/brand/menu-digital-logo-mark.svg"
      className={cls}
      alt=""
      aria-hidden="true"
    />
  );
}
