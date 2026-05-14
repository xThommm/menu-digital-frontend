import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Item {
  _id: string;
  title: string;
  description: string;
  price: number | null;
  offerPrice: number | null;
  options: Record<string, number>;
  image: string;
  available: boolean;
  hidden: boolean;
  recommended: boolean;
}

interface Categoria {
  _id: string;
  title: string;
  items: Item[];
}

interface Seccion {
  _id: string;
  title: string;
  categorias: Categoria[];
}

interface MenuData {
  secciones: Seccion[];
  sinSeccion: Categoria[];
}

interface UserData {
  contactInfo: {
    businessName: string;
    address: string;
    number: number | null;
    social: { instagram?: string };
  };
  hasDelivery: boolean;
  template: number;
}

const minOption = (options: Record<string, number>) => {
  const vals = Object.values(options);
  return vals.length > 0 ? Math.min(...vals) : null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default function MenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [user, setUser]           = useState<UserData | null>(null);
  const [menu, setMenu]           = useState<MenuData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const res = await fetch(`/api/users/${slug}/menu`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json();
        setUser(data.user);
        setMenu(data.menu);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [slug]);

  if (loading) return <Loader />;
  if (notFound || !menu || !user) return <NotFound />;

  const tabs: { label: string; categorias: Categoria[] }[] = [
    ...menu.secciones.map(s => ({ label: s.title, categorias: s.categorias })),
    ...(menu.sinSeccion.length > 0 ? [{ label: "Otros", categorias: menu.sinSeccion }] : []),
  ];

  if (tabs.length === 0) return (
    <EmptyMenu
      name={user.contactInfo.businessName}
      template={user.template}
      onBack={() => navigate(`/${slug}`)}
    />
  );

  const info = user.contactInfo;
  const currentTab = tabs[activeTab] ?? tabs[0];
  const t = user.template || 1;

  return (
    // data-template aplica las variables CSS del template elegido por el negocio
    <div className="mp" data-template={t}>

      <header className="mp-header">
        <button className="mp-back" onClick={() => navigate(`/${slug}`)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="mp-header-info">
          <h1 className="mp-name">{info.businessName || "Menú"}</h1>
          <div className="mp-meta">
            {info.address && <span>📍 {info.address}</span>}
            {user.hasDelivery && <span>🛵 Delivery</span>}
          </div>
        </div>
      </header>

      {tabs.length > 1 && (
        <div className="mp-tabs">
          {tabs.map((tab, i) => (
            <button
              key={i}
              className={`mp-tab ${activeTab === i ? "active" : ""}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="mp-content">
        {currentTab.categorias.map(cat =>
          cat.items.filter(it => !it.hidden).length > 0 ? (
            <div key={cat._id} className="mp-cat">
              <h2 className="mp-cat-title">{cat.title}</h2>
              {cat.items
                .filter(it => !it.hidden)
                .map(item => <ItemCard key={item._id} item={item} />)}
            </div>
          ) : null
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

        .mp {
          min-height: 100vh;
          background: var(--t-bg);
          font-family: 'DM Sans', system-ui, sans-serif;
          color: var(--t-text);
          max-width: 600px;
          margin: 0 auto;
        }

        .mp-header {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 1rem;
          background: var(--t-surface);
          border-bottom: 0.5px solid var(--t-border);
        }
        .mp-back {
          width: 36px; height: 36px; flex-shrink: 0;
          background: var(--t-bg); border: 0.5px solid var(--t-border);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--t-muted);
        }
        .mp-header-info { flex: 1; min-width: 0; }
        .mp-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.2rem; font-weight: 400; color: var(--t-title);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mp-meta {
          display: flex; gap: 10px; margin-top: 2px;
          font-size: 0.72rem; color: var(--t-muted); flex-wrap: wrap;
        }

        .mp-tabs {
          display: flex; overflow-x: auto; scrollbar-width: none;
          border-bottom: 0.5px solid var(--t-border);
          background: var(--t-bg);
          position: sticky; top: 0; z-index: 10;
        }
        .mp-tabs::-webkit-scrollbar { display: none; }
        .mp-tab {
          flex-shrink: 0; padding: 0.75rem 1rem;
          background: none; border: none;
          border-bottom: 2px solid transparent;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.85rem; color: var(--t-muted);
          cursor: pointer; white-space: nowrap;
          transition: color 0.15s, border-color 0.15s;
        }
        .mp-tab.active { color: var(--t-accent); border-bottom-color: var(--t-accent); }

        .mp-content { padding: 0.75rem 1rem 3rem; }

        .mp-cat { margin-bottom: 1.5rem; }
        .mp-cat-title {
          font-size: 0.78rem; font-weight: 500;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--t-accent);
          margin-bottom: 0.6rem; padding-bottom: 0.4rem;
          border-bottom: 0.5px solid var(--t-border);
        }

        .item-card {
          background: var(--t-surface);
          border: 0.5px solid var(--t-border);
          border-radius: 12px; padding: 0.9rem;
          display: flex; gap: 0.75rem; margin-bottom: 0.6rem;
        }
        .item-card.unavailable { opacity: 0.45; }

        .item-img {
          width: 72px; height: 72px; flex-shrink: 0;
          border-radius: 10px; object-fit: cover;
          background: var(--t-accent-bg);
        }
        .item-img-placeholder {
          width: 72px; height: 72px; flex-shrink: 0;
          border-radius: 10px; background: var(--t-accent-bg);
          display: flex; align-items: center; justify-content: center;
          border: 0.5px solid var(--t-border);
        }

        .item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
        .item-top  { display: flex; align-items: flex-start; justify-content: space-between; gap: 6px; }
        .item-name { font-size: 0.92rem; font-weight: 500; color: var(--t-title); line-height: 1.3; }
        .item-desc {
          font-size: 0.78rem; color: var(--t-muted); line-height: 1.45;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .item-bottom { display: flex; align-items: center; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
        .item-price  { font-size: 0.88rem; font-weight: 500; color: var(--t-accent); }
        .item-offer  { font-size: 0.78rem; color: var(--t-muted); text-decoration: line-through; }
        .item-unavail { font-size: 0.68rem; color: var(--t-muted); }

        .badge {
          display: inline-flex; align-items: center;
          font-size: 0.62rem; padding: 2px 7px; border-radius: 4px; white-space: nowrap;
        }
        .badge-variant {
          background: var(--t-accent-bg); color: var(--t-accent);
          border: 0.5px solid var(--t-border);
        }
        .badge-reco {
          background: var(--t-accent-bg); color: var(--t-accent);
          border: 0.5px solid var(--t-border);
        }

        .page-center {
          min-height: 100vh; display: flex; align-items: center;
          justify-content: center; background: var(--t-bg, #0c0b09);
        }
        .loader-ring {
          width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid #272420; border-top-color: #c9a84c;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function ItemCard({ item }: { item: Item }) {
  const hasOptions = Object.keys(item.options || {}).length > 0;
  const minPrice   = hasOptions ? minOption(item.options) : null;
  const showPrice  = item.price != null ? item.price : minPrice;

  return (
    <div className={`item-card ${!item.available ? "unavailable" : ""}`}>
      {item.image ? (
        <img src={item.image} alt={item.title} className="item-img" />
      ) : (
        <div className="item-img-placeholder">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </div>
      )}

      <div className="item-body">
        <div className="item-top">
          <span className="item-name">{item.title}</span>
          {item.recommended && <span className="badge badge-reco">⭐</span>}
        </div>

        {item.description && <span className="item-desc">{item.description}</span>}

        <div className="item-bottom">
          {showPrice != null && (
            <span className="item-price">
              {hasOptions ? `Desde ${fmt(showPrice)}` : fmt(showPrice)}
            </span>
          )}
          {item.offerPrice != null && item.price != null && (
            <span className="item-offer">{fmt(item.price)}</span>
          )}
          {hasOptions && (
            <span className="badge badge-variant">Variantes disponibles</span>
          )}
          {!item.available && (
            <span className="item-unavail">No disponible</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0c0b09" }}>
      <div style={{ width:"32px", height:"32px", borderRadius:"50%", border:"2px solid #272420", borderTopColor:"#c9a84c", animation:"spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#0c0b09", color:"#5c5649", fontFamily:"system-ui,sans-serif", gap:"0.5rem" }}>
      <p style={{ fontSize:"1.1rem", color:"#ede4d0" }}>Menú no encontrado</p>
      <p style={{ fontSize:"0.85rem" }}>Este negocio no tiene menú disponible.</p>
    </div>
  );
}

function EmptyMenu({ name, template, onBack }: { name: string; template: number; onBack: () => void }) {
  return (
    <div data-template={template} style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"var(--t-bg, #0c0b09)", color:"var(--t-muted, #5c5649)", fontFamily:"system-ui,sans-serif", gap:"1rem", padding:"2rem" }}>
      <p style={{ fontSize:"1.1rem", color:"var(--t-title, #ede4d0)", textAlign:"center" }}>{name}</p>
      <p style={{ fontSize:"0.85rem", textAlign:"center" }}>El menú todavía no tiene items cargados.</p>
      <button onClick={onBack} style={{ background:"none", border:"0.5px solid var(--t-border, #272420)", borderRadius:"8px", padding:"0.6rem 1.2rem", color:"var(--t-accent, #c9a84c)", cursor:"pointer", fontFamily:"inherit", fontSize:"0.85rem" }}>
        Volver
      </button>
    </div>
  );
}