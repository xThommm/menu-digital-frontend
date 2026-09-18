type BrandWordmarkProps = {
  className?: string;
};

/** Texto de marca del logo: "menudigital", en minúscula y sin espacio.
 *  El contraste lo da el peso ("menu" bold, "digital" regular), no el color:
 *  hereda `color` del contexto, igual que el logo con texto de la identidad.
 *  El tamaño lo define quien lo usa (font-size del contenedor o `className`).
 *  Estilos en styles/globals.css (.md-wordmark). */
export default function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span className={`md-wordmark${className ? ` ${className}` : ""}`}>
      <b>menu</b>digital
    </span>
  );
}
