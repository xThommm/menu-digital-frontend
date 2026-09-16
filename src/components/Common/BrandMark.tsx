type BrandMarkProps = {
  className?: string;
  /** Usa un <svg fill="currentColor"> inline en vez de <img>, para poder
   *  recolorear el ícono por CSS (ej. el panel CEO, que lo pinta con
   *  --admin-gold en vez del rojo de marca). */
  inline?: boolean;
};

export default function BrandMark({ className, inline }: BrandMarkProps) {
  const cls = `md-brand-mark${className ? ` ${className}` : ""}`;

  if (inline) {
    return (
      <svg
        className={cls}
        viewBox="0 0 212.000000 214.000000"
        aria-hidden="true"
      >
        <g transform="translate(0.000000,214.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
          <path d="M395 2130 c-161 -28 -290 -125 -358 -268 l-32 -67 0 -725 0 -725 32
          -66 c60 -121 157 -206 282 -248 61 -21 73 -21 754 -19 l692 3 78 37 c131 63
          226 176 262 313 22 87 23 1322 0 1408 -42 162 -158 286 -318 340 -60 21 -78
          22 -702 23 -352 1 -662 -2 -690 -6z m1048 -568 l147 -147 0 -493 0 -492 -535
          0 -535 0 0 640 0 640 388 0 387 0 148 -148z"/>
        </g>
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
