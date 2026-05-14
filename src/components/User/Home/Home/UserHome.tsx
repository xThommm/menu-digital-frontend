import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface User {
  _id: string;
  slug: string;
  template: number;
  hasDelivery: boolean;
  contactInfo: {
    businessName: string;
    mail: string;
    number: number | null;
    address: string;
    social: { instagram?: string; facebook?: string };
  };
  media: {
    pictures: string[];
    backgroundPicture: string;
  };
}

export default function BusinessLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/users/${slug}`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setUser(data.user);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [slug]);

  if (loading) return <Loader />;
  if (notFound || !user) return <NotFound />;

  const t = user.template || 1;
  const info = user.contactInfo;
  const bg = user.media?.backgroundPicture;

  const goMenu = () => navigate(`/${slug}/menu`);

  return (
    <>
      {t === 1 && <Template1 user={user} bg={bg} info={info} goMenu={goMenu} />}
      {t === 2 && <Template2 user={user} bg={bg} info={info} goMenu={goMenu} />}
      {t === 3 && <Template3 user={user} bg={bg} info={info} goMenu={goMenu} />}
      {t === 4 && <Template4 user={user} bg={bg} info={info} goMenu={goMenu} />}
      {t === 5 && <Template5 user={user} bg={bg} info={info} goMenu={goMenu} />}
    </>
  );
}

// ── Props compartidas ──────────────────────────────────────────────────────────
interface TProps {
  user: User;
  bg: string;
  info: User["contactInfo"];
  goMenu: () => void;
}

// ── Template 1: Clásico (oscuro dorado) ───────────────────────────────────────
function Template1({ user, bg, info, goMenu }: TProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#1a1510", color: "#ede4d0", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* Hero con imagen de fondo */}
      <div style={{ position: "relative", height: "240px", background: bg ? `url(${bg}) center/cover` : "#0c0b09", display: "flex", alignItems: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #1a1510 100%)" }} />
        <div style={{ position: "relative", padding: "1.25rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "#ede4d0", margin: "0 0 0.4rem" }}>
            {info.businessName || "Mi Negocio"}
          </h1>
          {user.hasDelivery && (
            <span style={{ fontSize: "0.72rem", background: "#c9a84c22", color: "#c9a84c", border: "0.5px solid #c9a84c44", padding: "3px 10px", borderRadius: "4px" }}>
              Delivery disponible
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "1.25rem" }}>
        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {info.address && <InfoRow icon="📍" text={info.address} color="#6b6457" />}
          {info.number  && <InfoRow icon="📞" text={String(info.number)} color="#6b6457" />}
          {/* {info.mail    && <InfoRow icon="✉️" text={info.mail} color="#6b6457" />} */}
          {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} color="#6b6457" />}
        </div>

        {/* Galería */}
        <Gallery pictures={user.media?.pictures} radius="10px" />

        {/* Botón ver menú */}
        <button onClick={goMenu} style={{ width: "100%", background: "#c9a84c", border: "none", borderRadius: "12px", padding: "1rem", fontFamily: "inherit", fontSize: "1rem", fontWeight: 500, color: "#0c0b09", cursor: "pointer", marginTop: "1.5rem" }}>
          Ver menú
        </button>
      </div>

      <Fonts />
    </div>
  );
}

// ── Template 2: Moderno (dark blue) ───────────────────────────────────────────
function Template2({ user, bg, info, goMenu }: TProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", color: "#e6edf3", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ background: "#161b22", borderBottom: "0.5px solid #30363d", padding: "2rem 1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        {/* Logo circle o imagen */}
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: bg ? `url(${bg}) center/cover` : "#21262d", border: "0.5px solid #30363d", flexShrink: 0 }} />
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 500, color: "#e6edf3", margin: "0 0 0.25rem" }}>
            {info.businessName || "Mi Negocio"}
          </h1>
          {user.hasDelivery && (
            <span style={{ fontSize: "0.72rem", background: "#58a6ff22", color: "#58a6ff", padding: "2px 8px", borderRadius: "4px" }}>Delivery</span>
          )}
        </div>
      </div>

      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {info.address && <InfoRow icon="📍" text={info.address} color="#8b949e" />}
          {info.number  && <InfoRow icon="📞" text={String(info.number)} color="#8b949e" />}
          {info.mail    && <InfoRow icon="✉️" text={info.mail} color="#8b949e" />}
          {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} color="#8b949e" />}
        </div>

        <Gallery pictures={user.media?.pictures} radius="6px" />

        <button onClick={goMenu} style={{ width: "100%", background: "#58a6ff", border: "none", borderRadius: "8px", padding: "1rem", fontFamily: "inherit", fontSize: "1rem", fontWeight: 500, color: "#0d1117", cursor: "pointer", marginTop: "1.5rem" }}>
          Ver menú →
        </button>
      </div>
    </div>
  );
}

// ── Template 3: Natural (verde suave) ─────────────────────────────────────────
function Template3({ user, bg, info, goMenu }: TProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#f0f4ee", color: "#1a2a1a", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ position: "relative", height: "200px", background: bg ? `url(${bg}) center/cover` : "#c8dfc0", display: "flex", alignItems: "flex-end" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #f0f4eecc 100%)" }} />
        <div style={{ position: "relative", padding: "1.25rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "#1a2a1a", margin: 0 }}>
            {info.businessName || "Mi Negocio"}
          </h1>
        </div>
      </div>

      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {info.address && <InfoRow icon="📍" text={info.address} color="#4a6b4a" />}
          {info.number  && <InfoRow icon="📞" text={String(info.number)} color="#4a6b4a" />}
          {info.mail    && <InfoRow icon="✉️" text={info.mail} color="#4a6b4a" />}
          {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} color="#4a6b4a" />}
          {user.hasDelivery && <InfoRow icon="🛵" text="Delivery disponible" color="#4a6b4a" />}
        </div>

        <Gallery pictures={user.media?.pictures} radius="12px" />

        <button onClick={goMenu} style={{ width: "100%", background: "#2d6a2d", border: "none", borderRadius: "12px", padding: "1rem", fontFamily: "inherit", fontSize: "1rem", fontWeight: 500, color: "#f0f4ee", cursor: "pointer", marginTop: "1.5rem" }}>
          Ver menú
        </button>
      </div>

      <Fonts />
    </div>
  );
}

// ── Template 4: Rojo (vibrante) ───────────────────────────────────────────────
function Template4({ user, bg, info, goMenu }: TProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#1a0a0a", color: "#f5e6e6", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ position: "relative", height: "220px", background: bg ? `url(${bg}) center/cover` : "#2a0f0f", borderBottom: "0.5px solid #5a2020", display: "flex", alignItems: "flex-end" }}>
        {bg && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, #1a0a0aee 100%)" }} />}
        <div style={{ position: "relative", padding: "1.25rem" }}>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "1.75rem", fontWeight: 400, color: "#f5e6e6", margin: "0 0 0.4rem" }}>
            {info.businessName || "Mi Negocio"}
          </h1>
          {user.hasDelivery && (
            <span style={{ fontSize: "0.72rem", background: "#e0555522", color: "#e05555", border: "0.5px solid #e0555544", padding: "3px 10px", borderRadius: "4px" }}>
              Delivery disponible
            </span>
          )}
        </div>
      </div>

      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {info.address && <InfoRow icon="📍" text={info.address} color="#8b5a5a" />}
          {info.number  && <InfoRow icon="📞" text={String(info.number)} color="#8b5a5a" />}
          {info.mail    && <InfoRow icon="✉️" text={info.mail} color="#8b5a5a" />}
          {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} color="#8b5a5a" />}
        </div>

        <Gallery pictures={user.media?.pictures} radius="8px" />

        <button onClick={goMenu} style={{ width: "100%", background: "#e05555", border: "none", borderRadius: "12px", padding: "1rem", fontFamily: "inherit", fontSize: "1rem", fontWeight: 500, color: "#fff", cursor: "pointer", marginTop: "1.5rem" }}>
          Ver menú
        </button>
      </div>

      <Fonts />
    </div>
  );
}

// ── Template 5: Minimal (blanco) ──────────────────────────────────────────────
function Template5({ user, bg, info, goMenu }: TProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ height: "200px", background: bg ? `url(${bg}) center/cover` : "#f5f5f5", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "flex-end" }}>
        <div style={{ padding: "1.25rem" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, color: "#111", margin: 0 }}>
            {info.businessName || "Mi Negocio"}
          </h1>
        </div>
      </div>

      <div style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {info.address && <InfoRow icon="📍" text={info.address} color="#888" />}
          {info.number  && <InfoRow icon="📞" text={String(info.number)} color="#888" />}
          {info.mail    && <InfoRow icon="✉️" text={info.mail} color="#888" />}
          {info.social?.instagram && <InfoRow icon="📸" text={`@${info.social.instagram}`} color="#888" />}
          {user.hasDelivery && <InfoRow icon="🛵" text="Delivery disponible" color="#888" />}
        </div>

        <Gallery pictures={user.media?.pictures} radius="8px" />

        <button onClick={goMenu} style={{ width: "100%", background: "#111", border: "none", borderRadius: "8px", padding: "1rem", fontFamily: "inherit", fontSize: "1rem", fontWeight: 500, color: "#fff", cursor: "pointer", marginTop: "1.5rem" }}>
          Ver menú
        </button>
      </div>
    </div>
  );
}

// ── Componentes reutilizables ──────────────────────────────────────────────────

// Fila de info con ícono
function InfoRow({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem", color }}>
      <span style={{ fontSize: "0.9rem" }}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// Galería de imágenes
function Gallery({ pictures, radius }: { pictures?: string[]; radius: string }) {
  if (!pictures || pictures.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px", marginBottom: "0.5rem" }}>
      {pictures.slice(0, 6).map((url, i) => (
        <div key={i} style={{ aspectRatio: "1", borderRadius: radius, overflow: "hidden" }}>
          <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
    </div>
  );
}

// Carga las fuentes
function Fonts() {
  return (
    <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@400;500&display=swap');`}</style>
  );
}

// ── Estados de carga y error ───────────────────────────────────────────────────
function Loader() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0b09" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #272420", borderTopColor: "#c9a84c", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0c0b09", color: "#5c5649", fontFamily: "system-ui, sans-serif", gap: "0.5rem" }}>
      <p style={{ fontSize: "1.1rem", color: "#ede4d0" }}>Local no encontrado</p>
      <p style={{ fontSize: "0.85rem" }}>El negocio que buscás no existe o no está activo.</p>
    </div>
  );
}