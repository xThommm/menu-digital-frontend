import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./UserHome.module.css";
import { useReveal } from "../../../../hooks/useReveal";
import type { User, ContactInfo, DayKey, DayHours, LandingVisibility, Schedule, TimeRange } from "../../../../types/index";
import BusinessSEO from "../../../Common/BusinessSEO";
import FreePlanAd from "../../../Common/FreePlanAd";
import { getOpenStatus, getBusinessDayIndex, getDayRanges, JS_DAY_TO_KEY } from "../../../../Utils/businessSchedule";
import { resolveLandingVisibility } from "../../../../lib/landingVisibility";
import { getVisualFamily, resolveMenuStyle } from "../../../../lib/menuStyles";
import { buildWaHref, getWaTargets, sanitizePhoneForWa, type WaTarget } from "../../../../lib/whatsapp";
import WaTargetPicker from "../WaTargetPicker/WaTargetPicker";

// ── Tokens por template ───────────────────────────────────────────────────────

type TemplateId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

interface TemplateTokens {
  titleClass: string;
  galleryRadius: string;
  btnLabel: string;
  useAvatar: boolean;
}

const SLUG_REGEX = /^[a-z0-9-]{2,80}$/;

// ── Horario de atención ──
// El tipo Schedule vive en types/index.ts (espejo del backend) — acá solo
// las constantes/helpers de UI que lo consumen.
const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const DAY_LABEL: Record<DayKey, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

// true si el negocio cargó horario y tiene al menos un día abierto. Un
// schedule con los 7 días en `enabled: false` se trata igual que no haber
// cargado nada — ni el badge del hero ni la sección de abajo tienen sentido
// si el negocio nunca está abierto.
function scheduleHasData(schedule?: Schedule): boolean {
  return !!schedule && DAY_ORDER.some(day => schedule[day]?.enabled);
}

const TEMPLATE_TOKENS: Record<TemplateId, TemplateTokens> = {
  1: {
    titleClass: "t-title",
    galleryRadius: "10px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  2: {
    titleClass: "t-title-sans",
    galleryRadius: "6px",
    btnLabel: "Ver menú →",
    useAvatar: true,
  },
  3: {
    titleClass: "t-title",
    galleryRadius: "12px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  4: {
    titleClass: "t-title",
    galleryRadius: "8px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  5: {
    titleClass: "t-title-sans",
    galleryRadius: "8px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  6: {
    titleClass: "t-title",
    galleryRadius: "14px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  7: {
    titleClass: "t-title",
    galleryRadius: "6px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // ── Templates 8-15 ──
  // 8 Coastal — claro y aireado, título sans para un look fresco de costa.
  8: {
    titleClass: "t-title-sans",
    galleryRadius: "12px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // 9 Charcoal — usa el layout con avatar (como el 2), sin hero con foto.
  9: {
    titleClass: "t-title-sans",
    galleryRadius: "8px",
    btnLabel: "Ver menú →",
    useAvatar: true,
  },
  // 10 Terracotta — cálido y rústico, título serif.
  10: {
    titleClass: "t-title",
    galleryRadius: "10px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // 11 Lavender — elegante, esquinas más redondeadas, serif.
  11: {
    titleClass: "t-title",
    galleryRadius: "14px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // 12 Forest — oscuro luxe, serif.
  12: {
    titleClass: "t-title",
    galleryRadius: "8px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // 13 Platinum — esquinas ajustadas para un look afilado.
  13: {
    titleClass: "t-title",
    galleryRadius: "6px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  // 14 Ocean — oscuro marino con acento turquesa.
  14: {
    titleClass: "t-title-sans",
    galleryRadius: "10px",
    btnLabel: "Ver menú →",
    useAvatar: true,
  },
  // 15 Rosé — claro editorial con acento rosa profundo.
  15: {
    titleClass: "t-title",
    galleryRadius: "14px",
    btnLabel: "Ver menú",
    useAvatar: true,
  },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function BusinessLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Derivación de estado — fuera del efecto, sin setState
  const slugIsValid = !!slug && SLUG_REGEX.test(slug);

  // ── Todos los hooks primero, sin excepción ──
  const goMenu = useCallback(() => navigate(`/${slug}/menu`), [slug, navigate]);

  useEffect(() => {
    // Si el slug ya es inválido, no hay nada que buscar: ni siquiera entramos
    // al efecto con un setState. `loading` se cortocircuita más abajo, en el
    // render, comparando contra slugIsValid directamente — así evitamos el
    // "setState síncrono al inicio del efecto" que señala el linter.
    if (!slugIsValid) return;

    const controller = new AbortController();

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${slug}`, {
          signal: controller.signal,
        });
        if (res.status === 403) {
          const error = await res.json();
          if (error.code === "LANDING_NOT_INCLUDED") { navigate(`/${slug}/menu`, { replace: true }); return; }
        }
        if (!res.ok) {
          if (res.status === 404) setNotFound(true);
          else setLoadError(true);
          return;
        }
        setUser(await res.json());
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    return () => controller.abort();
  }, [slug, slugIsValid, navigate]);

  // ── Returns después de todos los hooks ──
  // Un slug inválido nunca dispara el fetch, así que nunca debería mostrar el
  // loader: se resuelve directamente en el render, sin pasar por setState.
  if (!slugIsValid) return <NotFound />;
  if (loading) return <Loader />;
  if (loadError) return <NotFound unavailable />;
  if (notFound || !user) return <NotFound />;

  const templateId = (user.template ?? 1) as TemplateId;
  const tokens = TEMPLATE_TOKENS[templateId] ?? TEMPLATE_TOKENS[1];

  return (
  <>
    <BusinessSEO
      user={user}
      slug={slug!}
      page="landing"
    />

    <Template
      user={user}
      tokens={tokens}
      goMenu={goMenu}
    />
  </>
);
}

// ── Template unificado ────────────────────────────────────────────────────────

interface TemplateProps {
  user: User;
  tokens: TemplateTokens;
  goMenu: () => void;
}

function Template({ user, tokens, goMenu }: TemplateProps) {
  const { contactInfo: info, media, hasDelivery, template, schedule } = user;
  const menuStyle = resolveMenuStyle(user.menuStyle);
  const family = getVisualFamily(menuStyle);
  const useAvatar = !family && tokens.useAvatar;
  const bg = media?.backgroundPicture;

  // Guardamos qué URL específica falló, no solo un booleano. Así, cuando `bg`
  // cambia a una URL nueva, `showBg` se deriva correctamente sin necesitar
  // un setState síncrono al inicio del efecto solo para "resetear" el error
  // (eso es lo que React señala como render en cascada evitable).
  const [failedBg, setFailedBg] = useState<string | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const showBg = !!bg && bg !== failedBg;

  // Precarga la imagen de fondo (porque se usa como background-image, no <img>,
  // así detectamos el error igual y evitamos el flash de "sin imagen").
  useEffect(() => {
    if (!bg) return;
    const img = new Image();
    img.onerror = () => setFailedBg(bg);
    img.src = bg;
  }, [bg]);

  const heroStyle = showBg
    ? {
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  const businessName = info.businessName || "Mi Negocio";
  const galleryImages = media?.pictures ?? [];

  // Lo que el dueño ocultó desde Configuración el backend ya no lo envía;
  // igual se chequea acá porque el número puede venir solo para el botón de
  // reservas (con la fila de teléfono oculta), o de un backend anterior.
  const visible = resolveLandingVisibility(user.landingVisibility);

  const scheduleActive = visible.schedule && scheduleHasData(schedule);
  const isOpenNow = scheduleActive ? getOpenStatus(schedule) : false;
  const showHeroBadges = hasDelivery || scheduleActive;

  return (
    <div className={`t-wrap ${styles.landing}`} data-template={template ?? 1} data-menu-style={menuStyle} data-menu-family={family?.id}>
      {user.features?.sin_publicidad !== true && <FreePlanAd />}
      <main className={styles.layout}>
        <header className={`${styles.header} ${showBg && !useAvatar ? styles.headerWithCover : ""}`}>
          {showBg && !useAvatar && (
            <button
              type="button"
              className={styles.cover}
              style={heroStyle}
              aria-label={`Ampliar foto de ${businessName}`}
              onClick={() => { setViewerIndex(-1); setViewerOpen(true); }}
            />
          )}
          <div className={styles.intro}>
            <div className={styles.identity}>
              {useAvatar && showBg && (
                <button
                  type="button"
                  className={`t-avatar ${styles.avatar}`}
                  style={heroStyle}
                  aria-label={`Ampliar foto de ${businessName}`}
                  onClick={() => { setViewerIndex(-1); setViewerOpen(true); }}
                />
              )}
              <div className={styles.identityText}>
                {family && <p className={styles.familyEyebrow}>Bienvenidos a</p>}
                <h1 className={`${tokens.titleClass} ${styles.title}`}>{businessName}</h1>
                {showHeroBadges && (
                  <div className={styles.badgeRow}>
                    {scheduleActive && <OpenStatusBadge isOpen={isOpenNow} />}
                    {hasDelivery && <DeliveryBadge />}
                  </div>
                )}
              </div>
            </div>
            <div className={styles.actions}>
              <button type="button" onClick={goMenu} className="t-btn">
                {tokens.btnLabel}
              </button>
              {visible.whatsappReserve && (
                <ReserveButton targets={getWaTargets(info)} message={info.reservationMessage} businessName={businessName} />
              )}
            </div>
            {visible.address && <MapBadge address={info.address} businessName={businessName} />}
          </div>
        </header>
        <div className={styles.content}>
          <Gallery
            pictures={media?.pictures}
            radius={family ? "var(--t-family-photo-radius)" : tokens.galleryRadius}
            businessName={businessName}
            onImageClick={(index) => { setViewerIndex(index); setViewerOpen(true); }}
          />
          <div className={styles.practical}>
            {visible.schedule && <ScheduleSection schedule={schedule} />}
            <ContactList info={info} visible={visible} />
          </div>
        </div>
      </main>
      {viewerOpen && (
  <ImageViewer
    images={galleryImages}
    backgroundImage={bg}
    index={viewerIndex}
    onClose={() => setViewerOpen(false)}
  />
)}
    </div>
  );
}

// ── Componentes reutilizables ─────────────────────────────────────────────────

function DeliveryBadge() {
  return <span className="t-badge">Delivery disponible</span>;
}

// Mismo componente base que DeliveryBadge (.t-badge — tipografía, padding y
// fondo ya resueltos por template en globals.css) para que quede "acorde a
// la página" en cualquiera de los 15 estilos; el único agregado es el punto
// de color. Verde para "abierto" es un código universal que conviene no
// adaptar por template; para "cerrado" se usa currentColor (el mismo color
// de texto que ya trae .t-badge en ese template) para no introducir un rojo
// que no siempre combina.
function OpenStatusBadge({ isOpen }: { isOpen: boolean }) {
  return (
    <span className={`t-badge ${styles.scheduleBadge}`}>
      <span
        className={`${styles.scheduleBadgeDot} ${isOpen ? styles.scheduleBadgeDotOpen : styles.scheduleBadgeDotClosed}`}
        aria-hidden
      />
      {isOpen ? "Abierto ahora" : "Cerrado ahora"}
    </span>
  );
}


// ── Ubicación del local: enlace a Maps por dirección, sin APIs externas ──

interface MapBadgeProps {
  address?: string;
  businessName: string;
}

function MapBadge({ address, businessName }: MapBadgeProps) {
  if (!address) return null;

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <a
      className={styles.mapBadge}
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Ver ubicación de ${businessName} en Google Maps`}
    >
      <span className={styles.mapIcon}>
        <PinIcon />
      </span>
      <span className={styles.mapText}>
        <span className={styles.mapLabel}>Cómo llegar</span>
        <span>{address}</span>
      </span>
      <ExternalIcon />
    </a>
  );
}

interface ContactListProps {
  info: ContactInfo;
  visible: LandingVisibility;
}

// Los campos de redes sociales a veces se cargan con "@" adelante (el
// placeholder del formulario lo sugiere) y a veces sin él. Normalizamos
// acá, en el punto de uso, para que el texto no muestre "@@usuario" y el
// link no quede roto sin importar cómo se haya guardado el dato.
const stripHandle = (handle: string) => handle.trim().replace(/^@/, "");

function ContactList({ info, visible }: ContactListProps) {
  // Cada dato se resuelve a vacío si el dueño lo ocultó desde Configuración.
  const number    = visible.phone && info.number ? String(info.number) : "";
  const mail      = visible.mail ? info.mail : "";
  const instagram = visible.instagram && info.social?.instagram ? stripHandle(info.social.instagram) : "";
  const facebook  = visible.facebook  && info.social?.facebook  ? stripHandle(info.social.facebook)  : "";

  // Si no hay ningún dato de contacto, no renderizamos un contenedor vacío
  // (evita un hueco de espaciado sin contenido). La dirección NO entra acá:
  // ya se muestra arriba como MapBadge (clickeable a Maps), así que listarla
  // de nuevo en texto plano sería mostrar el mismo dato dos veces.
  const hasAnyInfo =
    number ||
    mail ||
    instagram ||
    facebook;

  if (!hasAnyInfo) return null;

  return (
    <section className={styles.contactCard} aria-label="Contacto">
      <h2 className={styles.sectionLabel}>Contacto</h2>
      <div className="t-info-list">
        {number && <PhoneRow number={number} />}
        {mail && (
          <InfoRow
            icon={<MailIcon />}
            text={mail}
            href={`mailto:${mail}`}
          />
        )}
        {instagram && (
          <InfoRow
            icon={<InstagramIcon />}
            text={`@${instagram}`}
            href={`https://instagram.com/${instagram}`}
          />
        )}
        {facebook && (
          <InfoRow
            icon={<FacebookIcon />}
            text={facebook}
            href={`https://facebook.com/${facebook}`}
          />
        )}
      </div>
    </section>
  );
}

// Lista completa de la semana, con el día de hoy resaltado. El estado
// "abierto/cerrado ahora" ya se muestra como badge arriba, en el hero
// (ver OpenStatusBadge) — acá solo el detalle día por día.
function formatRange({ from, to }: TimeRange): string {
  if (from === to) return from === "00:00" ? "24 horas" : `24 horas desde ${from}`;
  return `${from} – ${to}${to < from ? " (día siguiente)" : ""}`;
}

// Horario cortado: "12:00 – 15:00 y 20:00 – 00:00 (día siguiente)".
function formatHours(day?: DayHours): string {
  const ranges = getDayRanges(day);
  if (ranges.length === 0) return "Cerrado";
  return ranges.map(formatRange).join(" y ");
}

function ScheduleSection({ schedule }: { schedule?: Schedule }) {
  if (!scheduleHasData(schedule)) return null;

  const todayKey = JS_DAY_TO_KEY[getBusinessDayIndex()];

  return (
    <details className={styles.scheduleCard}>
      <summary className={styles.scheduleSummary}>
        <span>
          <span className={styles.scheduleHeading}>Horarios</span>
          <span className={styles.schedulePreview}>Hoy · {DAY_LABEL[todayKey]} · {formatHours(schedule?.[todayKey])}</span>
        </span>
        <span className={styles.scheduleChevron} aria-hidden>⌄</span>
      </summary>
      <div className={styles.scheduleTable}>
        {DAY_ORDER.map(day => {
          const d = schedule![day];
          return (
            <div
              key={day}
              className={`${styles.scheduleTableRow} ${day === todayKey ? styles.scheduleTableToday : ""}`}
            >
              <span>{DAY_LABEL[day]}</span>
              <span className={!d?.enabled ? styles.scheduleTableClosed : undefined}>
                {formatHours(d)}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

// Botón de reserva: abre WhatsApp con un mensaje pre-cargado. El texto lo
// define el dueño del negocio (campo editable en el panel); si no cargó
// nada, se usa un mensaje genérico de respaldo con el nombre del negocio.
// Con más de un WhatsApp (sucursales), el cliente elige a cuál escribir;
// sin ningún número el picker no dibuja nada.
function ReserveButton({
  targets,
  message,
  businessName,
}: {
  targets: WaTarget[];
  message?: string;
  businessName: string;
}) {
  const text = message?.trim() || `Hola! Quiero hacer una reserva en ${businessName}.`;

  return (
    <WaTargetPicker
      targets={targets}
      message={text}
      className={styles.reserveBtn}
      prompt="¿En qué sucursal querés reservar?"
    >
      <WhatsAppIcon />
      <span>Reservar por WhatsApp</span>
    </WaTargetPicker>
  );
}

function InfoRow({
  icon,
  text,
  href,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="t-info-icon" aria-hidden>
        {icon}
      </span>
      <span>{text}</span>
    </>
  );

  // Datos de contacto accionables (teléfono, mail, instagram) son enlaces
  // reales: el usuario puede tocar para llamar/escribir, no solo leer.
  if (href) {
    return (
      <a
        className="t-info-row"
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return <div className="t-info-row">{content}</div>;
}

// Fila de teléfono: en vez de un link directo a "tel:", abre un menú con
// las dos formas de contactar (llamada normal o WhatsApp), porque son
// acciones distintas y no siempre se quiere la misma.
function PhoneRow({ number }: { number: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Mismo formato que pedidos y reservas: el número se guarda sin 54/9 y
  // wa.me lo necesita completo (ver sanitizePhoneForWa).
  const waPhone = sanitizePhoneForWa(number);

  return (
    <div className={styles.phoneWrap} ref={wrapRef}>
      <button
        type="button"
        className={`t-info-row ${styles.phoneTrigger}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="t-info-icon" aria-hidden>
          <PhoneIcon />
        </span>
        <span>{number}</span>
      </button>

      {open && (
        <div className={styles.phoneMenu} role="menu">
          <a
            className={styles.phoneMenuItem}
            href={`tel:${number}`}
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <span className={styles.phoneMenuIcon} aria-hidden><PhoneIcon /></span>
            <span>Llamar</span>
          </a>
          {waPhone && (
            <a
              className={styles.phoneMenuItem}
              href={buildWaHref(waPhone)}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className={styles.phoneMenuIcon} aria-hidden><WhatsAppIcon /></span>
              <span>WhatsApp</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface GalleryProps {
  pictures?: string[];
  radius: string;
  businessName: string;
  onImageClick: (index: number) => void;
}

function Gallery({
  pictures,
  radius,
  businessName,
  onImageClick,
}: GalleryProps) {
  if (!pictures?.length) return null;

  const shown = pictures.slice(0, 6);

  return (
    <section className={styles.gallerySection} aria-label="Galería">
      <h2 className={styles.galleryTitle}>Un vistazo a {businessName}</h2>
      <div
        className={styles.gallery}
        role="list"
        aria-label={`Fotos de ${businessName}`}
      >
        {shown.map((url, i) => (
          <GalleryItem
            key={url}
            url={url}
            index={i}
            radius={radius}
            businessName={businessName}
            onClick={() => onImageClick(i)}
          />
        ))}
      </div>
    </section>
  );
}

function GalleryItem({
  url,
  index,
  radius,
  businessName,
  onClick,
}: {
  url: string;
  index: number;
  radius: string;
  businessName: string;
  onClick: () => void;
}) {
  const [error, setError] = useState(false);
  const { ref, revealed } = useReveal<HTMLDivElement>();
  if (error) return null; // Una foto rota no deja un hueco visible en la grilla.

  return (
    <div
      ref={ref}
      className={`${styles.galleryItem} t-reveal ${revealed ? "t-reveal-in" : ""}`}
      role="listitem"
      style={{
        borderRadius: radius,
        cursor: "zoom-in",
        "--reveal-delay": `${Math.min(index * 0.06, 0.3)}s`,
      } as React.CSSProperties}
    >
      <button type="button" className={styles.galleryButton} onClick={onClick} aria-label={`Ampliar foto ${index + 1} de ${businessName}`}>
      <img
        src={url}
        alt={`Foto ${index + 1} de ${businessName}`}
        className="t-gallery-img"
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
      />
      </button>
    </div>
  );
}


function ImageViewer({
  images,
  backgroundImage,
  index,
  onClose,
}: {
  images: string[];
  backgroundImage?: string;
  index: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  // index === -1 significa "estoy mirando la foto de portada" (no la galería):
  // en ese caso no hay navegación ni contador, es una sola imagen.
  const isBackground = current === -1;
  const currentImage = isBackground ? backgroundImage : images[current];

  const atStart = current <= 0;
  const atEnd = current >= images.length - 1;
  const showNav = !isBackground && images.length > 1;

  // Navegación con teclado (← → para moverse, Esc para cerrar) y bloqueo del
  // scroll del fondo mientras el visor está abierto. Es lo que espera cualquiera
  // que abre una foto a pantalla completa; sin esto el lightbox se siente a
  // medio hacer. Los setCurrent van con updater functional para no depender de
  // `current` (así el listener no se re-suscribe en cada navegación).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") setCurrent((c) => (c > 0 ? c - 1 : c));
      else if (e.key === "ArrowRight") setCurrent((c) => (c < images.length - 1 ? c + 1 : c));
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [images.length, onClose]);

  if (!currentImage) return null;

  const prev = () => setCurrent((c) => (c > 0 ? c - 1 : c));
  const next = () => setCurrent((c) => (c < images.length - 1 ? c + 1 : c));

  return (
    <div
      className={styles.tViewer}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imágenes"
    >
      <button className={styles.tViewerClose} onClick={onClose} aria-label="Cerrar" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <img
        src={currentImage}
        alt=""
        className={styles.tViewerImg}
        onClick={(e) => e.stopPropagation()}
      />

      {showNav && (
        <>
          <button
            className={styles.tViewerPrev}
            onClick={(e) => { e.stopPropagation(); prev(); }}
            disabled={atStart}
            aria-label="Imagen anterior"
            type="button"
          >
            ‹
          </button>

          <button
            className={styles.tViewerNext}
            onClick={(e) => { e.stopPropagation(); next(); }}
            disabled={atEnd}
            aria-label="Imagen siguiente"
            type="button"
          >
            ›
          </button>

          <div className={styles.tViewerCounter} aria-hidden>
            {current + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  );
}

// ── Íconos ────────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 0 0 4.73 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.24.25-.4.08-.16.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.24-.86.85-.86 2.06 0 1.22.88 2.4 1 2.56.13.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Estados ───────────────────────────────────────────────────────────────────

function Loader() {
  return (
    <div className={styles.loaderWrap}>
      <div className={styles.heroSkeleton} aria-hidden="true" />
      <div className={styles.bodySkeleton} aria-hidden="true">
        <div
          className={`${styles.skelBox} ${styles.skelLine}`}
          style={{ width: "50%" }}
        />
        <div
          className={`${styles.skelBox} ${styles.skelLine}`}
          style={{ width: "70%" }}
        />
        <div
          className={`${styles.skelBox} ${styles.skelLine}`}
          style={{ width: "40%" }}
        />
        <div className={`${styles.skelBox} ${styles.skelBtn}`} />
      </div>
      <span className="sr-only" role="status">
        Cargando…
      </span>
    </div>
  );
}

function NotFound({ unavailable = false }: { unavailable?: boolean }) {
  return (
    <div className="t-notfound" role="alert">
      <p className="t-notfound-title">{unavailable ? "No pudimos cargar el local" : "Local no encontrado"}</p>
      <p className="t-notfound-sub">
        {unavailable ? "El servicio no está disponible por el momento. Intentá nuevamente." : "El negocio que buscás no existe o no está activo."}
      </p>
      {unavailable && <button className="t-notfound-retry" onClick={() => window.location.reload()}>Reintentar</button>}
    </div>
  );
}
