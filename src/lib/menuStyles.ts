export type MenuStyle = "classic" | "bistro";

// Ausente en cuentas y backends anteriores: conservar el diseño original.
export function resolveMenuStyle(value: unknown): MenuStyle {
  return value === "bistro" ? "bistro" : "classic";
}
