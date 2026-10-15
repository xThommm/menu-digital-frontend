// Link de registro con el código de un vendedor o influencer:
// /register?codigo=ABC-123. El registro tiene dos pasos (datos y plan), así
// que el código se guarda en la sesión al entrar y el paso del plan lo trae
// cargado en el campo "código de promoción" (se valida igual que si se tipeara).

const STORAGE_KEY = "pendingSellerCode";
const CODE_PATTERN = /^[A-Z]{3}-\d{3}$/;

export const normalizeSellerCode = (value: string | null | undefined): string | null => {
  const code = (value ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
};

/** "https://…/register?codigo=ABC-123" */
export const registerLinkWithCode = (origin: string, code: string) =>
  `${origin}/register?codigo=${encodeURIComponent(code)}`;

/** Al entrar al registro: guarda el código del link (si es válido). */
export function rememberSellerCodeFromUrl(search = window.location.search): string | null {
  const code = normalizeSellerCode(new URLSearchParams(search).get("codigo"));
  if (code) {
    try { sessionStorage.setItem(STORAGE_KEY, code); } catch { /* sin almacenamiento: se tipea a mano */ }
  }
  return code;
}

/** En el paso del plan: el código que trajo el link, si hubo. */
export function readRememberedSellerCode(): string | null {
  try {
    return normalizeSellerCode(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
