// Preferencia de tema claro/oscuro, compartida entre todo lo que la lee o la
// cambia: los hooks useTheme / useAuthTheme (toggles del sidebar y de la
// landing) y el menú contextual global. Antes cada hook guardaba su copia en
// un useState, así que un cambio hecho desde otro lado no se reflejaba.

export type ThemeMode = "dark" | "light";

export interface ThemeStore {
  get: () => ThemeMode;
  set: (next: ThemeMode) => void;
  toggle: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createThemeStore(storageKey: string, apply?: (theme: ThemeMode) => void): ThemeStore {
  const listeners = new Set<() => void>();
  let current: ThemeMode | null = null;

  const get = () => {
    if (current === null) {
      try {
        current = localStorage.getItem(storageKey) === "light" ? "light" : "dark";
      } catch {
        current = "dark";
      }
    }
    return current;
  };

  const set = (next: ThemeMode) => {
    current = next;
    apply?.(next);
    try {
      localStorage.setItem(storageKey, next);
    } catch {
      // localStorage no disponible (modo privado, etc.): el tema igual se
      // aplica en esta sesión, solo no persiste.
    }
    listeners.forEach((listener) => listener());
  };

  return {
    get,
    set,
    toggle: () => set(get() === "dark" ? "light" : "dark"),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// Panel (dashboard + editores, tokens --admin-*): el tema va en <html>.
// "dark" es el default sin atributo, así que en oscuro se saca en vez de
// escribir data-theme="dark" (deja el <html> limpio).
export const panelThemeStore = createThemeStore("panel-theme", (theme) => {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
});

// Páginas públicas con tokens --auth-* (landing, blog, legales, auth): cada
// página pone data-auth-theme en su contenedor a partir de este valor.
export const publicThemeStore = createThemeStore("public-theme");
