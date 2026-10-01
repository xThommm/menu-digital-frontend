// La barra de scroll de la página la pinta <html>, pero la paleta de la
// carta pública vive en el div con data-template (ver BARRA DE SCROLL en
// globals.css). Este ref copia a <html> los colores de barra que ese div
// ya resolvió con su paleta, y los saca al desmontar para que el resto de
// la app vuelva a los de su tema.
const VARS = ["--scrollbar-thumb", "--scrollbar-thumb-hover", "--scrollbar-page-track"] as const;

// Cambian la paleta sin remontar el div (vista previa del diseño).
const THEME_ATTRIBUTES = ["data-template", "data-menu-style", "data-menu-family"];

function copyToRoot(source: HTMLElement) {
  const computed = getComputedStyle(source);
  const root = document.documentElement.style;
  for (const name of VARS) {
    const value = computed.getPropertyValue(name).trim();
    if (value) root.setProperty(name, value);
    else root.removeProperty(name);
  }
}

// Ref de callback estable (React 19: lo que devuelve es la limpieza).
export function pageScrollbarRef(element: HTMLElement | null) {
  if (!element) return;
  copyToRoot(element);
  const observer = new MutationObserver(() => copyToRoot(element));
  observer.observe(element, { attributes: true, attributeFilter: THEME_ATTRIBUTES });
  return () => {
    observer.disconnect();
    const root = document.documentElement.style;
    for (const name of VARS) root.removeProperty(name);
  };
}
