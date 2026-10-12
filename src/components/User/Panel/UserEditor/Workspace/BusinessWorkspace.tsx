import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, Check, ChevronRight, MapPin } from "lucide-react";
import {
  BUSINESS_BLOCKS, BUSINESS_TABS, getBusinessBlock,
  type BusinessBlockId, type BusinessCheck, type BusinessTab,
} from "./businessBlocks";
import ws from "../../MenuEditor/Workspace/MenuWorkspace.module.css";
import bw from "./BusinessWorkspace.module.css";

// Piezas del editor de negocio en escritorio, con el mismo armado que el
// editor de menú: estructura (izquierda), tablero de tarjetas (centro) y
// panel con la vista previa (derecha). Encabezado, estructura y panel usan
// las clases de MenuWorkspace.module.css; lo propio está en
// BusinessWorkspace.module.css. El estado sigue viviendo en UserEditor.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

const ICON = { size: 16, strokeWidth: 1.8, "aria-hidden": true } as const;

// ── Pestañas del encabezado ─────────────────────────────────────────────────

export function BusinessTabs({ value, dirty, onChange }: {
  value: BusinessTab;
  // Hay cambios sin guardar en Información.
  dirty: boolean;
  onChange: (tab: BusinessTab) => void;
}) {
  const index = BUSINESS_TABS.findIndex(tab => tab.key === value);

  return (
    <div
      className={bw.tabs}
      role="tablist"
      aria-label="Secciones"
      style={{ "--tab-index": index } as CSSProperties}
    >
      <span className={bw.tabIndicator} aria-hidden="true" />
      {BUSINESS_TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={cx(bw.tab, value === key && bw.tabActive)}
          onClick={() => onChange(key)}
        >
          {label}
          {key === "info" && dirty && <span className={bw.dirtyDot} aria-label="Cambios sin guardar" />}
        </button>
      ))}
    </div>
  );
}

// ── Estructura ──────────────────────────────────────────────────────────────

interface JumpProps {
  activeBlock: BusinessBlockId | null;
  onSelect: (id: BusinessBlockId) => void;
}

export function BusinessNav({ tab, activeBlock, dirtyBlocks, counts, onSelect }: JumpProps & {
  tab: BusinessTab;
  dirtyBlocks: BusinessBlockId[];
  // Contador a la derecha del bloque (ej: fotos de la galería).
  counts: Partial<Record<BusinessBlockId, number>>;
}) {
  return (
    <nav className={ws.nav} aria-label="Estructura del negocio">
      <p className={ws.navHeading}>Estructura</p>
      <div className={ws.navScroll}>
        {BUSINESS_TABS.map(group => (
          <div key={group.key} className={ws.navGroup}>
            <div className={ws.navGroupHeader}>
              <span className={ws.navGroupTitle}>{group.label}</span>
            </div>
            {BUSINESS_BLOCKS.filter(block => block.tab === group.key).map(block => {
              const active = tab === group.key && activeBlock === block.id;
              const Icon = block.icon;
              return (
                <div key={block.id} className={ws.navItemRow}>
                  <button
                    type="button"
                    className={cx(ws.navItem, active && ws.navItemActive)}
                    onClick={() => onSelect(block.id)}
                    aria-current={active ? "location" : undefined}
                  >
                    <Icon {...ICON} size={15} className={bw.navIcon} />
                    <span className={ws.navItemName}>{block.title}</span>
                    {dirtyBlocks.includes(block.id) && (
                      <span className={bw.dirtyDot} aria-label="Cambios sin guardar" />
                    )}
                    {counts[block.id] != null && <span className={ws.navItemCount}>{counts[block.id]}</span>}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

// Versión compacta para anchos intermedios (sin columna de estructura): los
// bloques de la pestaña a la vista.
export function BusinessJumpBar({ tab, activeBlock, onSelect }: JumpProps & { tab: BusinessTab }) {
  return (
    <nav className={ws.jumpBar} aria-label="Ir a un bloque">
      {BUSINESS_BLOCKS.filter(block => block.tab === tab).map(block => (
        <button
          key={block.id}
          type="button"
          className={cx(ws.jumpChip, activeBlock === block.id && ws.jumpChipActive)}
          onClick={() => onSelect(block.id)}
          aria-current={activeBlock === block.id ? "location" : undefined}
        >
          {block.title}
        </button>
      ))}
    </nav>
  );
}

// ── Tarjeta del tablero ─────────────────────────────────────────────────────

export function BusinessCard({ block, dirty = false, flash = 0, aside, children }: {
  block: BusinessBlockId;
  dirty?: boolean;
  // Número de salto que la trajo a la vista (0: ninguno). Alterna entre dos
  // animaciones iguales para que el destello se repita en saltos seguidos.
  flash?: number;
  // Acción propia del bloque, a la derecha del título.
  aside?: ReactNode;
  children: ReactNode;
}) {
  const { title, hint, icon: Icon, tab } = getBusinessBlock(block);
  const index = BUSINESS_BLOCKS.filter(item => item.tab === tab).findIndex(item => item.id === block);
  const titleId = `business-block-title-${block}`;

  return (
    <section
      id={`business-block-${block}`}
      data-business-block={block}
      className={cx(bw.card, dirty && bw.cardDirty, flash > 0 && (flash % 2 ? bw.cardFlashA : bw.cardFlashB))}
      style={{ "--card-index": index } as CSSProperties}
      aria-labelledby={titleId}
    >
      <header className={bw.cardHeader}>
        <span className={bw.cardIcon}><Icon {...ICON} size={19} /></span>
        <div className={bw.cardHeading}>
          <h3 id={titleId} className={bw.cardTitle}>{title}</h3>
          <span className={bw.cardHint}>{hint}</span>
        </div>
        {dirty && <span className={cx(ws.panelStatus, bw.cardStatus)}>Sin guardar</span>}
        {aside}
      </header>
      <div className={bw.cardBody}>{children}</div>
    </section>
  );
}

// ── Panel lateral ───────────────────────────────────────────────────────────

export function BusinessPanel({ title, subtitle, status, children }: {
  title: string;
  subtitle?: string;
  status?: string;
  children: ReactNode;
}) {
  return (
    <aside className={ws.panel} aria-label={title}>
      <header className={ws.panelHeader}>
        <div className={ws.panelHeading}>
          <h2 className={ws.panelTitle}>{title}</h2>
          {subtitle && <p className={ws.panelSubtitle}>{subtitle}</p>}
        </div>
        {status && <span className={ws.panelStatus} role="status">{status}</span>}
      </header>
      <div className={ws.panelBody}>{children}</div>
    </aside>
  );
}

export interface BusinessPreviewData {
  name: string;
  address: string;
  cover: string;
  logo: string;
  open: boolean;
  hasDelivery: boolean;
  hasTakeAway: boolean;
  // Paleta vigente: la miniatura se pinta con sus tokens (--t-*).
  template: number;
  paletteName: string;
  styleName: string;
  layoutName: string;
}

// Miniatura de la portada del local: se actualiza mientras se edita, antes
// de guardar. Es ilustrativa, no la página real.
function BusinessPreview({ data }: { data: BusinessPreviewData }) {
  const name = data.name.trim() || "Tu negocio";

  return (
    <figure className={bw.previewFigure}>
      <div className={bw.preview} data-template={data.template}>
        <div
          className={bw.previewCover}
          style={data.cover ? { backgroundImage: `url(${data.cover})` } : undefined}
        >
          <span className={cx(bw.previewStatus, data.open && bw.previewStatusOpen)}>
            {data.open ? "Abierto ahora" : "Cerrado ahora"}
          </span>
        </div>
        <div className={bw.previewBody}>
          <span className={bw.previewLogo}>
            {data.logo ? <img src={data.logo} alt="" /> : name.charAt(0)}
          </span>
          <p className={bw.previewName}>{name}</p>
          <p className={bw.previewAddress}>
            <MapPin {...ICON} size={13} />
            {data.address.trim() || "Sin dirección cargada"}
          </p>
          <div className={bw.previewChips}>
            <span className={bw.previewChip}>Ver la carta</span>
            {data.hasDelivery && <span className={cx(bw.previewChip, bw.previewChipSoft)}>Delivery</span>}
            {data.hasTakeAway && <span className={cx(bw.previewChip, bw.previewChipSoft)}>Take away</span>}
          </div>
        </div>
      </div>
      <figcaption className={bw.previewCaption}>
        Vista ilustrativa · Diseño {data.styleName} · Plantilla {data.layoutName} · Paleta {data.paletteName}
      </figcaption>
    </figure>
  );
}

export function BusinessOverview({ preview, checklist, publicUrl, onSelect }: {
  preview: BusinessPreviewData;
  checklist: BusinessCheck[];
  publicUrl: string | null;
  onSelect: (id: BusinessBlockId) => void;
}) {
  const done = checklist.filter(item => item.done).length;
  const complete = done === checklist.length;

  return (
    <div className={ws.overview}>
      <BusinessPreview data={preview} />

      <section aria-labelledby="business-overview-profile">
        <p id="business-overview-profile" className={ws.overviewHeading}>
          {complete ? "Perfil completo" : "Completá tu perfil"}
        </p>
        <div className={ws.statTotal}>
          <strong>{done}</strong>
          <span>de {checklist.length} listos</span>
        </div>
        <div
          className={bw.progress}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={checklist.length}
          aria-valuenow={done}
          aria-label="Avance del perfil"
        >
          <span style={{ width: `${(done / checklist.length) * 100}%` }} />
        </div>
        <ul className={bw.checklist}>
          {checklist.map(item => (
            <li key={item.block}>
              <button
                type="button"
                className={cx(bw.checkItem, item.done && bw.checkItemDone)}
                onClick={() => onSelect(item.block)}
              >
                <span className={bw.checkMark}>{item.done && <Check {...ICON} size={13} strokeWidth={2.6} />}</span>
                <span className={bw.checkLabel}>{item.label}</span>
                <span className="sr-only">{item.done ? " (listo)" : " (falta)"}</span>
                <ChevronRight {...ICON} size={15} className={bw.checkArrow} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {publicUrl && (
        <a className={ws.publicLink} href={publicUrl} target="_blank" rel="noopener noreferrer">
          Ver mi página
          <ArrowUpRight {...ICON} />
        </a>
      )}

      <section aria-labelledby="business-overview-shortcuts">
        <p id="business-overview-shortcuts" className={ws.overviewHeading}>Atajos de teclado</p>
        <dl className={ws.shortcuts}>
          <div><dt><kbd>Ctrl</kbd> <kbd>S</kbd></dt><dd>Guardar los cambios</dd></div>
        </dl>
      </section>
    </div>
  );
}
