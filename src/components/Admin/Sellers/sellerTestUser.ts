// Datos sugeridos al crear el usuario de prueba de un vendedor (la cuenta de
// comercio que usa en sus demos). El admin puede cambiarlos antes de crear.

// Sin caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/l/I).
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 10;

/** "ABC-123" → "demoabc123". Sin guion: el login lo reserva para los vendedores. */
export function suggestTestUsername(sellerCode: string): string {
  return `demo${sellerCode.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
}

export function generateTestPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PASSWORD_LENGTH));
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join("");
}

export function isValidTestUsername(username: string): boolean {
  const clean = username.trim();
  return clean.length > 0 && !clean.includes("-");
}
