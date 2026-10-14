import { ChartColumn, ExternalLink, FileDown, ImageDown, Link2 } from "lucide-react";
import { copyLinkItem, openUrlItem, type MenuEnv } from "../../../../features/contextMenu/lib/menuEnv.ts";
import type { ContextMenuItem } from "../../../../features/contextMenu/types";

// Clic derecho en el inicio del panel del local: la carta en línea (la
// tarjeta y el encabezado, que tienen los mismos botones) y el gráfico de
// visitas.

export interface StorefrontMenuContext {
  url: string | null;
  /** El plan incluye el QR descargable. */
  canDownloadQr: boolean;
  generatingQr: boolean;
  actions: { downloadQr: (format: "png" | "pdf") => void };
}

const qrDisabled = ({ canDownloadQr, generatingQr }: StorefrontMenuContext) =>
  !canDownloadQr ? "El QR descargable no está incluido en tu plan" : generatingQr && "Generando el QR";

export function buildStorefrontMenu(env: MenuEnv): ContextMenuItem<StorefrontMenuContext>[] {
  return [
    openUrlItem<StorefrontMenuContext>(env, { id: "open", label: "Ver mi carta", icon: ExternalLink, url: ({ url }) => url }),
    copyLinkItem<StorefrontMenuContext>(env, { id: "copy", label: "Copiar link", icon: Link2, url: ({ url }) => url }),
    { type: "separator" },
    {
      id: "qr-png",
      label: "Descargar QR en PNG",
      icon: ImageDown,
      visible: ({ url }) => url !== null,
      disabled: qrDisabled,
      run: ({ actions }) => actions.downloadQr("png"),
    },
    {
      id: "qr-pdf",
      label: "Descargar QR en PDF",
      icon: FileDown,
      visible: ({ url }) => url !== null,
      disabled: qrDisabled,
      run: ({ actions }) => actions.downloadQr("pdf"),
    },
  ];
}

export function buildVisitsMenu(env: MenuEnv): ContextMenuItem<undefined>[] {
  return [
    { id: "stats", label: "Ver estadísticas completas", icon: ChartColumn, run: () => env.navigate("/estadisticas") },
  ];
}
