import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { errorMessage } from "../../lib/errors";
import { formatDateTime } from "../../lib/format";
import {
  BILL_PRINT_MODE_HINT, BILL_PRINT_MODE_LABEL, readBillPrinter, saveBillPrinter, type BillPrinterConfig,
} from "../../lib/print/billPrinter";
import type { BillLayout } from "../../lib/print/billLayout";
import { chooseEscposPrinter, escposSupported, hasEscposPrinter, printBill } from "../../lib/print/printers";
import type { PaperWidth, PrintMode } from "../../types";
import p from "./panel.module.css";

// Impresora de la cuenta en ESTE equipo (se guarda en el navegador, no en el
// local): modo, papel y copias, conectar la comandera directa y una prueba.

const SAMPLE: BillLayout = {
  business: "Prueba de impresión",
  place: "Mesa 1",
  orders: "Pedido #1",
  dateTime: "",
  waiter: null,
  lines: [
    { quantity: 2, title: "Milanesa napolitana con papas", amount: 24000 },
    { quantity: 1, title: "Agua con gas", amount: 2500 },
  ],
  subtotal: 26500,
  discount: 2650,
  total: 23850,
  split: [],
  payments: [{ label: "Efectivo", amount: 10000 }],
  paid: 10000,
  pending: 13850,
};

export default function BillPrinterCard({ businessName }: { businessName: string | null }) {
  const [config, setConfig] = useState<BillPrinterConfig>(readBillPrinter);
  const [printerReady, setPrinterReady] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (config.mode !== "escpos") return;
    let cancelled = false;
    hasEscposPrinter().then(ready => { if (!cancelled) setPrinterReady(ready); }).catch(() => {});
    return () => { cancelled = true; };
  }, [config.mode]);

  const update = (patch: Partial<BillPrinterConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    saveBillPrinter(next);
    setNotice(null);
  };

  const connect = async () => {
    try {
      await chooseEscposPrinter();
      setPrinterReady(await hasEscposPrinter());
    } catch (err) {
      // Cerrar el selector sin elegir no es un error para mostrar.
      if (err instanceof Error && err.name === "NotFoundError") return;
      setNotice({ ok: false, text: errorMessage(err, "No se pudo conectar la comandera.") });
    }
  };

  const test = async () => {
    try {
      const dateTime = formatDateTime(new Date().toISOString());
      await printBill(config.mode, { ...SAMPLE, business: businessName ?? SAMPLE.business, dateTime }, config);
      setNotice({ ok: true, text: "Prueba enviada a la impresora." });
    } catch (err) {
      setNotice({ ok: false, text: errorMessage(err, "No se pudo imprimir la prueba.") });
    }
  };

  return (
    <section className={p.card}>
      <h2 className={p.cardTitle}>Impresora de la cuenta</h2>
      <div className={p.stack}>
        <span className={p.switchHint}>Se guarda en este equipo: configurala en la PC que tiene la impresora conectada.</span>
        <div className={p.row} style={{ alignItems: "flex-end" }}>
          <label className={p.field} style={{ flex: "2 1 220px" }}>
            <span className={p.label}>Impresión</span>
            <select className={p.select} value={config.mode} onChange={event => update({ mode: event.target.value as PrintMode })}>
              {(Object.keys(BILL_PRINT_MODE_LABEL) as PrintMode[]).map(mode => (
                <option key={mode} value={mode}>{BILL_PRINT_MODE_LABEL[mode]}</option>
              ))}
            </select>
          </label>
          {config.mode !== "none" && (
            <>
              <label className={p.field} style={{ flex: "1 1 100px" }}>
                <span className={p.label}>Papel</span>
                <select className={p.select} value={config.paperWidth} onChange={event => update({ paperWidth: Number(event.target.value) as PaperWidth })}>
                  <option value={80}>80 mm</option>
                  <option value={58}>58 mm</option>
                </select>
              </label>
              <label className={p.field} style={{ flex: "1 1 80px" }}>
                <span className={p.label}>Copias</span>
                <select className={p.select} value={config.copies} onChange={event => update({ copies: Number(event.target.value) })}>
                  {[1, 2, 3].map(copies => <option key={copies} value={copies}>{copies}</option>)}
                </select>
              </label>
            </>
          )}
        </div>
        <span className={p.switchHint}>{BILL_PRINT_MODE_HINT[config.mode]}</span>

        {config.mode === "escpos" && !escposSupported() && (
          <p className={p.error}>Este navegador no puede hablar directo con la comandera. Usá Chrome o Edge en una PC.</p>
        )}

        {config.mode !== "none" && (
          <div className={p.row}>
            {config.mode === "escpos" && escposSupported() && printerReady === false && (
              <button type="button" className={p.btnGhost} onClick={connect}>Conectar comandera</button>
            )}
            {config.mode === "escpos" && printerReady && <span className={p.switchHint}>Comandera conectada.</span>}
            <button
              type="button"
              className={p.btnGhost}
              onClick={test}
              disabled={config.mode === "escpos" && !printerReady}
            >
              <Printer size={16} aria-hidden /> Imprimir prueba
            </button>
          </div>
        )}
        {notice && <p className={notice.ok ? p.success : p.error} role={notice.ok ? "status" : "alert"}>{notice.text}</p>}
      </div>
    </section>
  );
}
