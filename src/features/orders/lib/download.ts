// Descarga un archivo armado en el navegador (o recibido como blob).
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** "cierre-barra-principal-2026-10-14.xlsx" (el mismo nombre que arma el servidor). */
export function cashCloseFileName(registerName: string, at: string): string {
  const slug = registerName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "caja";
  const day = new Date(new Date(at).getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return `cierre-${slug}-${day}.xlsx`;
}
