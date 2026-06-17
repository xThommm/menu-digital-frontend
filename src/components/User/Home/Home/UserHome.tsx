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
  1: {
    showDeliveryRow: false,
    heroClass: styles.heroT1,
    titleClass: "t-title",
    galleryRadius: "10px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  2: {
    showDeliveryRow: true,
    heroClass: "",
    titleClass: "t-title-sans",
    galleryRadius: "6px",
    btnLabel: "Ver menú →",
    useAvatar: true,
  },
  3: {
    showDeliveryRow: false,
    heroClass: styles.heroT3,
    overlayClass: styles.overlayT3,
    titleClass: "t-title",
    galleryRadius: "12px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  4: {
    showDeliveryRow: false,
    heroClass: styles.heroT4,
    titleClass: "t-title",
    galleryRadius: "8px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
  5: {
    showDeliveryRow: false,
    heroClass: styles.heroT5,
    titleClass: "t-title-sans",
    galleryRadius: "8px",
    btnLabel: "Ver menú",
    useAvatar: false,
  },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function BusinessLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
        if (!res.ok) {
          setNotFound(true);
          return;
        }
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
  // Un slug inválido nunca dispara el fetch, así que nunca debería mostrar el
  // loader: se resuelve directamente en el render, sin pasar por setState.
  if (!slugIsValid) return <NotFound />;
  if (loading) return <Loader />;
  if (notFound || !user) return <NotFound />;

  const templateId = (user.template ?? 1) as TemplateId;
  const tokens = TEMPLATE_TOKENS[templateId] ?? TEMPLATE_TOKENS[1];

  return <Template user={user} tokens={tokens} goMenu={goMenu} />;
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

  return (
    <div className="t-wrap" data-template={template}>
      {tokens.useAvatar ? (
        <div className="t-header">
          <div
            className="t-avatar"
            style={showBg ? { backgroundImage: `url(${bg})` } : undefined}
            role="img"
            aria-label={`Foto de ${businessName}`}
          />
          <div>
            <h1 className={tokens.titleClass}>{businessName}</h1>
            {hasDelivery && <DeliveryBadge />}
          </div>
        </div>
      ) : (
        <div
          className={`t-hero ${tokens.heroClass}`}
          style={{
            ...heroStyle,
            cursor: showBg ? "zoom-in" : "default",
          }}
          onClick={() => {
            if (!showBg || !bg) return;

            setViewerIndex(-1);
            setViewerOpen(true);
          }}
        >
          <div className={`t-hero-overlay ${tokens.overlayClass ?? ""}`} />
          <div className="t-hero-content">
            <h1 className={tokens.titleClass}>{businessName}</h1>
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
        <Gallery
  pictures={media?.pictures}
  radius={tokens.galleryRadius}
  businessName={businessName}
  onImageClick={(index) => {
    setViewerIndex(index);
    setViewerOpen(true);
  }}
/>
        <button onClick={goMenu} className="t-btn">
          {tokens.btnLabel}
        </button>
      </div>
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

interface ContactListProps {
  info: ContactInfo;
  hasDelivery: boolean;
  showDeliveryRow: boolean;
}

function ContactList({ info, hasDelivery, showDeliveryRow }: ContactListProps) {
  // Si no hay ningún dato de contacto, no renderizamos un contenedor vacío
  // (evita un hueco de espaciado sin contenido).
  const hasAnyInfo =
    info.address ||
    info.number ||
    info.mail ||
    info.social?.instagram ||
    (showDeliveryRow && hasDelivery);

  if (!hasAnyInfo) return null;

  return (
    <div className="t-info-list">
      {info.address && <InfoRow icon={<PinIcon />} text={info.address} />}
      {info.number && (
        <InfoRow
          icon={<PhoneIcon />}
          text={String(info.number)}
          href={`tel:${info.number}`}
        />
      )}
      {info.mail && (
        <InfoRow
          icon={<MailIcon />}
          text={info.mail}
          href={`mailto:${info.mail}`}
        />
      )}
      {info.social?.instagram && (
        <InfoRow
          icon={<InstagramIcon />}
          text={`@${info.social.instagram}`}
          href={`https://instagram.com/${info.social.instagram}`}
        />
      )}
      {showDeliveryRow && hasDelivery && (
        <InfoRow icon={<DeliveryIcon />} text="Delivery disponible" />
      )}
    </div>
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

  return (
    <div
      className="t-gallery"
      role="list"
      aria-label={`Fotos de ${businessName}`}
    >
      {pictures.slice(0, 6).map((url, i) => (
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
  if (error) return null; // Una foto rota no deja un hueco visible en la grilla.

  return (
    <div
  className="t-gallery-item"
  role="listitem"
  style={{
    borderRadius: radius,
    cursor: "zoom-in",
  }}
  onClick={onClick}
>
      <img
        src={url}
        alt={`Foto ${index + 1} de ${businessName}`}
        className="t-gallery-img"
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
      />
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

  const isBackground = current === -1;

  const currentImage = isBackground
    ? backgroundImage
    : images[current];

  if (!currentImage) return null;

  const prev = () => {
    if (current <= 0) return;
    setCurrent(current - 1);
  };

  const next = () => {
    if (current >= images.length - 1) return;
    setCurrent(current + 1);
  };

  return (
    <div className={styles.tViewer} onClick={onClose}>
      <img
        src={currentImage}
        alt=""
        className={styles.tViewerImg}
        onClick={(e) => e.stopPropagation()}
      />

      {!isBackground && images.length > 1 && (
        <>
          <button
            className={styles.tViewerPrev}
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
          >
            ‹
          </button>

          <button
            className={styles.tViewerNext}
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
          >
            ›
          </button>
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

function DeliveryIcon() {
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
      <circle cx="5.5" cy="17.5" r="2.5" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M15 17.5H9m6 0V6h-3l-6 6v5.5m6-11 4.5 4.5H21l-1.5-4.5H15Z" />
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
      <span className={styles.srOnly} role="status">
        Cargando…
      </span>
    </div>
  );
}

function NotFound() {
  return (
    <div className={styles.notFound} role="alert">
      <p className={styles.notFoundTitle}>Local no encontrado</p>
      <p className={styles.notFoundSub}>
        El negocio que buscás no existe o no está activo.
      </p>
    </div>
  );
}
