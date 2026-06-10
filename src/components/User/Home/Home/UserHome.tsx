import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./UserHome.module.css";
import type { User, ContactInfo } from "../../../../types/index";

// ── Tokens por template ───────────────────────────────────────────────────────
// Cada template tiene su propio conjunto de estilos: clase del hero,
// clase del overlay, forma del botón y radio de las imágenes de la galería.
// Centralizar estos valores evita repetir lógica en cada componente.

type TemplateId = 1 | 2 | 3 | 4 | 5;

interface TemplateTokens {
  heroClass: string;       // clase CSS del hero (color de fondo / gradiente)
  overlayClass?: string;   // clase extra para el overlay (opcional)
  titleClass: string;      // serif ("t-title") o sans ("t-title-sans")
  galleryRadius: string;   // border-radius de las miniaturas
  btnLabel: string;        // texto del botón "ver menú"
  useAvatar: boolean;      // Template 2 usa avatar circular en lugar de hero full-bleed
}

const TEMPLATE_TOKENS: Record<TemplateId, TemplateTokens> = {
  1: { heroClass: styles.heroT1, titleClass: "t-title",      galleryRadius: "10px", btnLabel: "Ver menú",   useAvatar: false },
  2: { heroClass: "",            titleClass: "t-title-sans", galleryRadius: "6px",  btnLabel: "Ver menú →", useAvatar: true  },
  3: { heroClass: styles.heroT3, overlayClass: styles.overlayT3, titleClass: "t-title", galleryRadius: "12px", btnLabel: "Ver menú", useAvatar: false },
  4: { heroClass: styles.heroT4, titleClass: "t-title",      galleryRadius: "8px",  btnLabel: "Ver menú",   useAvatar: false },
  5: { heroClass: styles.heroT5, titleClass: "t-title-sans", galleryRadius: "8px",  btnLabel: "Ver menú",   useAvatar: false },
};

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * BusinessLandingPage
 * Lee el `slug` de la URL, obtiene los datos del negocio desde la API
 * y renderiza el template correspondiente.
 */
export default function BusinessLandingPage() {
  const { slug }    = useParams<{ slug: string }>();
  const navigate    = useNavigate();

  const [user, setUser]         = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  /** Carga los datos del negocio una sola vez cuando cambia el slug */
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${slug}`);
        if (!res.ok) { setNotFound(true); return; }
        setUser(await res.json());
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [slug]);

  /**
   * goMenu
   * Navega a la página del menú del negocio.
   * useCallback evita recrear la función en cada render.
   */
  const goMenu = useCallback(() => navigate(`/${slug}/menu`), [slug, navigate]);

  if (loading)           return <Loader />;
  if (notFound || !user) return <NotFound />;

  const templateId = (user.template ?? 1) as TemplateId;
  const tokens     = TEMPLATE_TOKENS[templateId] ?? TEMPLATE_TOKENS[1];

  return (
    <Template
      user={user}
      tokens={tokens}
      goMenu={goMenu}
    />
  );
}

// ── Template unificado ────────────────────────────────────────────────────────

interface TemplateProps {
  user: User;
  tokens: TemplateTokens;
  goMenu: () => void;
}

/**
 * Template
 * Componente único que reemplaza los cinco componentes Template1–5.
 * Recibe los tokens visuales del template elegido y los aplica,
 * eliminando la duplicación de JSX que había antes.
 */
function Template({ user, tokens, goMenu }: TemplateProps) {
  const { contactInfo: info, media, hasDelivery, template } = user;
  const bg = media?.backgroundPicture;

  const heroStyle = bg
    ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <div className="t-wrap" data-template={template}>

      {/* ── Cabecera: avatar (T2) o hero full-bleed (resto) ── */}
      {tokens.useAvatar ? (
        <div className="t-header">
          <div className="t-avatar" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
          <div>
            <h1 className={tokens.titleClass}>{info.businessName || "Mi Negocio"}</h1>
            {hasDelivery && <DeliveryBadge />}
          </div>
        </div>
      ) : (
        <div className={`t-hero ${tokens.heroClass}`} style={heroStyle}>
          <div className={`t-hero-overlay ${tokens.overlayClass ?? ""}`} />
          <div className="t-hero-content">
            <h1 className={tokens.titleClass}>{info.businessName || "Mi Negocio"}</h1>
            {hasDelivery && <DeliveryBadge />}
          </div>
        </div>
      )}

      {/* ── Cuerpo: info de contacto, galería y botón ── */}
      <div className="t-body">
        <ContactList info={info} hasDelivery={hasDelivery} showDeliveryRow={tokens.useAvatar === false && !tokens.heroClass.includes("T1") && !tokens.heroClass.includes("T4")} />
        <Gallery pictures={media?.pictures} radius={tokens.galleryRadius} />
        <button onClick={goMenu} className="t-btn">{tokens.btnLabel}</button>
      </div>

    </div>
  );
}

// ── Componentes reutilizables ─────────────────────────────────────────────────

/**
 * DeliveryBadge
 * Muestra el badge "Delivery disponible" en el hero o cabecera.
 */
function DeliveryBadge() {
  return <span className="t-badge">Delivery disponible</span>;
}

interface ContactListProps {
  info: ContactInfo;
  hasDelivery: boolean;
  /** Si es true, el delivery se muestra como fila de info en lugar de badge en el hero */
  showDeliveryRow: boolean;
}

/**
 * ContactList
 * Renderiza las filas de información de contacto disponibles.
 * Solo muestra las filas cuyos datos existen (evita filas vacías).
 */
function ContactList({ info, hasDelivery, showDeliveryRow }: ContactListProps) {
  return (
    <div className="t-info-list">
      {info.address            && <InfoRow icon="📍" text={info.address} />}
      {info.number             && <InfoRow icon="📞" text={String(info.number)} />}
      {info.mail               && <InfoRow icon="✉️" text={info.mail} />}
      {info.social?.instagram  && <InfoRow icon="📸" text={`@${info.social.instagram}`} />}
      {showDeliveryRow && hasDelivery && <InfoRow icon="🛵" text="Delivery disponible" />}
    </div>
  );
}

/**
 * InfoRow
 * Fila individual de dato de contacto: ícono + texto.
 */
function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="t-info-row">
      <span className="t-info-icon">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

interface GalleryProps {
  pictures?: string[];
  radius: string;
}

/**
 * Gallery
 * Muestra hasta 6 imágenes del negocio en grilla.
 * Retorna null si no hay imágenes para evitar espacio vacío.
 */
function Gallery({ pictures, radius }: GalleryProps) {
  if (!pictures?.length) return null;

  return (
    <div className="t-gallery">
      {pictures.slice(0, 6).map((url, i) => (
        <div key={i} className="t-gallery-item" style={{ borderRadius: radius }}>
          <img src={url} alt="" className="t-gallery-img" loading="lazy" />
        </div>
      ))}
    </div>
  );
}

/**
 * Loader
 * Pantalla de carga mientras se obtienen los datos del negocio.
 */
function Loader() {
  return (
    <div className={styles.loaderWrap}>
      <div className="loader" />
    </div>
  );
}

/**
 * NotFound
 * Pantalla de error cuando el slug no corresponde a ningún negocio activo.
 */
function NotFound() {
  return (
    <div className={styles.notFound}>
      <p className={styles.notFoundTitle}>Local no encontrado</p>
      <p className={styles.notFoundSub}>El negocio que buscás no existe o no está activo.</p>
    </div>
  );
}