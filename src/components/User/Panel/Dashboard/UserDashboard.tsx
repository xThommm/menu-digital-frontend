import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../api/Auth/AuthContext";

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dash">

      {/* Top bar */}
      <header className="top-bar">
        <div className="logo-mark">
          <div className="logo-sq">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c0b09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
              <path d="M8 2v6" />
              <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
              <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
            </svg>
          </div>
          <span className="brand-name">Menu<span className="brand-accent">Digital</span></span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </button>
      </header>

      {/* Welcome */}
      <div className="welcome">
        <h1>Hola, {user?.name ?? "Admin"}</h1>
        <p>¿Qué querés gestionar hoy?</p>
      </div>

      {/* Cards */}
      <div className="cards">
        <button className="nav-card" onClick={() => navigate("/admin/menu")}>
          <div className="card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className="card-body">
            <p className="card-title">Editor de menú</p>
            <p className="card-desc">Gestioná platos, precios y categorías de tu carta.</p>
          </div>
          <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>

        <button className="nav-card" onClick={() => navigate("/admin/negocio")}>
          <div className="card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="card-body">
            <p className="card-title">Editor de negocio</p>
            <p className="card-desc">Nombre, logo, horarios y datos de tu restaurante.</p>
          </div>
          <svg className="card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

        * { box-sizing: border-box; }

        .dash {
          min-height: 100vh;
          background: #0c0b09;
          padding: 1.25rem 1rem 2rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          display: flex;
          flex-direction: column;
        }

        /* Top bar */
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2.5rem;
        }

        .logo-mark {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .logo-sq {
          width: 32px; height: 32px;
          background: #c9a84c;
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }

        .brand-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.15rem;
          font-weight: 500;
          color: #ede4d0;
        }

        .brand-accent { color: #c9a84c; }

        .logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: 0.5px solid #272420;
          border-radius: 8px;
          padding: 0.45rem 0.85rem;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 0.8rem;
          color: #5c5649;
          cursor: pointer;
          transition: border-color 0.2s, color 0.2s;
        }

        .logout-btn:hover {
          border-color: #4a4035;
          color: #a09070;
        }

        /* Welcome */
        .welcome {
          margin-bottom: 2rem;
          padding: 0 0.25rem;
        }

        .welcome h1 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: #ede4d0;
          margin: 0 0 0.3rem;
        }

        .welcome p {
          font-size: 0.82rem;
          color: #5c5649;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin: 0;
        }

        /* Cards */
        .cards {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .nav-card {
          width: 100%;
          background: #131210;
          border: 0.5px solid #272420;
          border-radius: 16px;
          padding: 1.25rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 1rem;
          text-align: left;
          transition: border-color 0.2s, background 0.2s;
        }

        .nav-card:hover, .nav-card:active {
          border-color: #c9a84c;
          background: #181610;
        }

        .card-icon {
          width: 52px; height: 52px;
          flex-shrink: 0;
          border-radius: 12px;
          background: #1e1c17;
          border: 0.5px solid #2e2b23;
          display: flex; align-items: center; justify-content: center;
        }

        .card-body {
          flex: 1;
          min-width: 0;
        }

        .card-title {
          font-size: 1rem;
          font-weight: 500;
          color: #ede4d0;
          margin: 0 0 0.25rem;
        }

        .card-desc {
          font-size: 0.8rem;
          color: #5c5649;
          margin: 0;
          line-height: 1.45;
        }

        .card-arrow {
          color: #3d3a33;
          flex-shrink: 0;
          transition: color 0.2s;
        }

        .nav-card:hover .card-arrow,
        .nav-card:active .card-arrow {
          color: #c9a84c;
        }

        /* Tablet+ — dos columnas */
        @media (min-width: 600px) {
          .dash {
            padding: 2rem;
            align-items: center;
            justify-content: center;
          }
          .top-bar, .welcome, .cards {
            width: 100%;
            max-width: 560px;
          }
          .cards {
            flex-direction: row;
          }
          .nav-card {
            flex: 1;
            flex-direction: column;
            align-items: flex-start;
          }
          .card-arrow {
            margin-top: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}