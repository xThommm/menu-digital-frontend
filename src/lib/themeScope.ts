// Lo que se dibuja en un portal cuelga de <body>, fuera del layout que define
// los tokens del panel: se le copia la clase de tema de la zona de origen. Un
// panel con tema propio suma acá su clase.
const THEME_SCOPE_CLASSES = ["admin-panel-graphite"];

export function themeScopeOf(element: Element | null): string {
  if (!element) return "";
  return THEME_SCOPE_CLASSES.find((scope) => element.closest(`.${scope}`)) ?? "";
}
