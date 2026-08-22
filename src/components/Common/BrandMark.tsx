type BrandMarkProps = {
  className?: string;
};

export default function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      src="/brand/menu-digital-app-brand-mark.png"
      className={`md-brand-mark${className ? ` ${className}` : ""}`}
      alt=""
      aria-hidden="true"
    />
  );
}
