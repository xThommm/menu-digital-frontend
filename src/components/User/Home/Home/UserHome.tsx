import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./UserHome.module.css";
import type { User, ContactInfo } from "../../../../types/index";

// ── Tokens por template ───────────────────────────────────────────────────────

type TemplateId = 1 | 2 | 3 | 4 | 5;

interface TemplateTokens {
  heroClass: string;
  overlayClass?: string;
  titleClass: string;
  showDeliveryRow: boolean;
  galleryRadius: string;
  btnLabel: string;
  useAvatar: boolean;
}

const SLUG_REGEX = /^[a-z0-9-]{2,80}$/;

const TEMPLATE_TOKENS: Record<TemplateId, TemplateTokens> = {
  1: { showDeliveryRow: false, heroClass: styles.heroT1, titleClass: "t-title",      galleryRadius: "10px", btnLabel: "Ver menú",   useAvatar: false },
  2: { showDeliveryRow: true,  heroClass: "",            titleClass: "t-title-sans", galleryRadius: "6px",  btnLabel: "Ver menú →", useAvatar: true  },
  3: { showDeliveryRow: false, heroClass: styles.heroT3, overlayClass: styles.overlayT3, titleClass: "t-title", galleryRadius: "12px", btnLabel: "Ver menú", useAvatar: false },
  4: { showDeliveryRow: false, heroClass: styles.heroT4, titleClass: "t-title",      galleryRadius: "8px",  btnLabel: "Ver menú",   useAvatar: false },
  5: { showDeliveryRow: false, heroClass: styles.heroT5, titleClass: "t-title-sans", galleryRadius: "8px",  btnLabel: "Ver menú",   useAvatar: false },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function BusinessLandingPage() {
  const { slug }  = useParams<{ slug: string }>();
  const navigate  = useNavigate();

  const [user, setUser]         = useState<User | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Derivación de estado — fuera del efecto, sin setState
  const slugIsValid = !!slug && SLUG_REGEX.test(slug);

  // ── Todos los hooks primero, sin excepción ──
  const goMenu = useCallback(
    () => navigate(`/${slug}/menu`),
    [slug, navigate]
  );

  useEffect(() => {
    if (!slugIsValid) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchUser = async () => {
      try {
        const res = await fetch(`/api/users/${slug}`, {
          signal: controller.signal,
        });
        if (!res.ok) { setNotFound(true); return; }
        setUser(await res.json());
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    return () => controller.abort();
  }, [slug, slugIsValid]);

  // ── Returns después de todos los hooks ──
  if (loading)           return <Loader />;
  if (!slugIsValid)      return <NotFound />;
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

function Template({ user, tokens, goMenu }: TemplateProps) {
  const { contactInfo: info, media, hasDelivery, template } = user;
  const bg = media?.backgroundPicture;

  const heroStyle = bg
    ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
    : undefined;

  return (
    <div className="t-wrap" data-template={template}>

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

      <div className="t-body">
        <ContactList
          info={info}
          hasDelivery={hasDelivery}
          showDeliveryRow={tokens.showDeliveryRow}
        />
        <Gallery pictures={media?.pictures} radius={tokens.galleryRadius} />
        <button onClick={goMenu} className="t-btn">{tokens.btnLabel}</button>
      </div>

    </div>
  );
}

// ── Componentes reutilizables ─────────────────────────────────────────────────

function DeliveryBadge() {
  return <span className="t-badge">Delivery disponible</span>;
}

interface ContactListProps {
  info: ContactInfo;
  hasDelivery: boolean;
  showDeliveryRow: boolean;
}

function ContactList({ info, hasDelivery, showDeliveryRow }: ContactListProps) {
  return (
    <div className="t-info-list">
      {info.address           && <InfoRow icon="📍" text={info.address} />}
      {info.number            && <InfoRow icon="📞" text={String(info.number)} />}
      {info.mail              && <InfoRow icon="✉️" text={info.mail} />}
      {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} />}
      {showDeliveryRow && hasDelivery && <InfoRow icon="🛵" text="Delivery disponible" />}
    </div>
  );
}

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

function Gallery({ pictures, radius }: GalleryProps) {
  if (!pictures?.length) return null;

  return (
    <div className="t-gallery">
      {pictures.slice(0, 6).map((url, i) => (
        <div key={i} className="t-gallery-item" style={{ borderRadius: radius }}>
          <img
            src={url}
            alt={`Foto del local ${i + 1}`}
            className="t-gallery-img"
            loading="lazy"
            decoding="async"
          />
        </div>
      ))}
    </div>
  );
}

function Loader() {
  return (
    <div className={styles.loaderWrap}>
      <div className="loader" />
    </div>
  );
}

function NotFound() {
  return (
    <div className={styles.notFound}>
      <p className={styles.notFoundTitle}>Local no encontrado</p>
      <p className={styles.notFoundSub}>El negocio que buscás no existe o no está activo.</p>
    </div>
  );
}