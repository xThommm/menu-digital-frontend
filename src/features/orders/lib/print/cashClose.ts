import type { CashSession } from "../../types";
import { formatDateTime, formatMoney } from "../format.ts";

// "Imprimir cierre" (menú contextual de Caja): el cierre de una caja como una
// hoja A4 para la impresora del sistema. El HTML se arma acá (se prueba con
// node --test); imprimirlo usa un iframe oculto, como las comandas.

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]!));

const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatMoney(value));

export function cashCloseHtml(session: CashSession, businessName = ""): string {
  const s = session.summary;
  const rows = (pairs: [string, string][]) =>
    pairs.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join("");
  const section = (title: string, pairs: [string, string][]) =>
    `<h2>${escapeHtml(title)}</h2><table>${rows(pairs)}</table>`;

  const body = [
    section("Caja", [
      ["Cajero", session.cashierName || "Sin indicar"],
      ["Apertura", `${formatDateTime(session.openedAt)}${session.openedByName ? ` · ${session.openedByName}` : ""}`],
      ["Cierre", session.closedAt ? `${formatDateTime(session.closedAt)}${session.closedByName ? ` · ${session.closedByName}` : ""}` : "Abierta"],
      ["Fondo inicial", money(session.openingAmount)],
    ]),
    s ? section("Ventas", [
      ["Pedidos", String(s.ordersCount)],
      ["Ventas", money(s.salesAmount)],
      ["Descuentos", money(s.discountsAmount)],
      [`Cancelados (${s.cancelledCount})`, money(s.cancelledAmount)],
      [`Devueltos (${s.returnedCount})`, money(s.returnedAmount)],
      ["Neto", money(s.netAmount)],
      ["Cobrado online", money(s.onlineAmount)],
      ...s.paymentsBreakdown.map((row): [string, string] => [`${row.method} (${row.count})`, money(row.amount)]),
    ]) : "",
    s ? section("Efectivo", [
      ["Ventas en efectivo", money(s.cashSalesAmount)],
      ["Ingresos", money(s.incomeAmount)],
      ["Egresos", money(s.expenseAmount)],
      ["Retiros", money(s.withdrawalAmount)],
      ["Esperado en el cajón", money(s.expectedCash)],
    ]) : "",
    section("Arqueo", [
      ["Contado", money(session.cashCounted)],
      ["Diferencia", money(session.difference)],
      ["Retirado al cerrar", money(session.cashWithdrawn)],
      ["Quedó en el cajón", money(session.cashLeft)],
    ]),
    session.closingNotes ? `<p class="notes"><b>Notas:</b> ${escapeHtml(session.closingNotes)}</p>` : "",
  ].join("");

  const title = `Cierre de ${session.registerName}`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font: 12pt/1.4 system-ui, sans-serif; color: #000; }
  h1 { font-size: 18pt; margin: 0 0 2mm; }
  .business { color: #444; margin: 0 0 6mm; }
  h2 { font-size: 12pt; margin: 6mm 0 2mm; border-bottom: 1px solid #999; padding-bottom: 1mm; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-weight: normal; padding: 1mm 0; }
  td { text-align: right; padding: 1mm 0; font-variant-numeric: tabular-nums; }
  .notes { margin-top: 6mm; }
</style></head><body>
<h1>${escapeHtml(title)}</h1>${businessName ? `<p class="business">${escapeHtml(businessName)}</p>` : ""}${body}
</body></html>`;
}

/** Imprime el cierre en un iframe oculto (la pantalla no cambia). */
export function printCashClose(session: CashSession, businessName = ""): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) { frame.remove(); return; }
    win.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 1000), { once: true });
    win.focus();
    win.print();
  };
  frame.srcdoc = cashCloseHtml(session, businessName);
}
