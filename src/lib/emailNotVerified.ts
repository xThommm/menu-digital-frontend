// El backend corta con 403 `EMAIL_NOT_VERIFIED` cualquier ruta privada de
// una cuenta que todavía no confirmó el código de email. En el uso normal
// UserRoute ya manda a /verificar-email antes de que se pida nada; esto
// cubre la sesión guardada que quedó desalineada (dice "verificada" y el
// servidor dice que no): la corrige y lleva a la pantalla del código.
const VERIFY_PATH = "/verificar-email";

export function isEmailNotVerified(status: number | undefined, body: unknown): boolean {
  return status === 403
    && typeof body === "object"
    && body !== null
    && (body as { code?: unknown }).code === "EMAIL_NOT_VERIFIED";
}

export function redirectToEmailVerification(): void {
  if (window.location.pathname === VERIFY_PATH) return;
  try {
    const saved = localStorage.getItem("user");
    if (saved) {
      localStorage.setItem("user", JSON.stringify({ ...JSON.parse(saved), emailVerified: false }));
    }
  } catch {
    // Sesión guardada ilegible: AuthProvider la descarta al recargar.
  }
  window.location.href = VERIFY_PATH;
}
