import type { PaperWidth, PrintMode } from "../../types";
import { readJson, writeJson } from "../storage.ts";

// Impresora de la cuenta: se guarda en cada equipo (no en el local), porque
// la impresora está conectada a esa PC y el permiso de la comandera directa
// (Web Serial) también es de ese navegador. Sin configurar: la impresora del
// sistema con papel de 80 mm.

export interface BillPrinterConfig {
  mode: PrintMode;
  paperWidth: PaperWidth;
  copies: number;
}

const KEY = "md:bill-printer";

export const DEFAULT_BILL_PRINTER: BillPrinterConfig = { mode: "browser", paperWidth: 80, copies: 1 };

const isConfig = (value: unknown): value is BillPrinterConfig => {
  const v = value as Partial<BillPrinterConfig> | null;
  return !!v && typeof v === "object"
    && (v.mode === "none" || v.mode === "browser" || v.mode === "escpos")
    && (v.paperWidth === 58 || v.paperWidth === 80)
    && Number.isInteger(v.copies) && v.copies! >= 1 && v.copies! <= 3;
};

export const readBillPrinter = (): BillPrinterConfig => readJson(KEY, isConfig) ?? DEFAULT_BILL_PRINTER;

export const saveBillPrinter = (config: BillPrinterConfig) => writeJson(KEY, config);

export const BILL_PRINT_MODE_LABEL: Record<PrintMode, string> = {
  none: "No imprimir la cuenta",
  browser: "Impresora del sistema",
  escpos: "Comandera directa (ESC/POS)",
};

export const BILL_PRINT_MODE_HINT: Record<PrintMode, string> = {
  none: "En este equipo no se ofrece imprimir la cuenta.",
  browser: "La cuenta sale por una impresora instalada en el equipo (la comandera con su driver). Para que salga sin el diálogo de impresión, el navegador tiene que estar en modo kiosco (--kiosk-printing) con la comandera como predeterminada.",
  escpos: "La pantalla habla directo con la comandera por puerto serie o USB-serie (Chrome o Edge en una PC). Todavía no se probó con una impresora real.",
};
