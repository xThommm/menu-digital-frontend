import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../api/Auth/AuthContext";
import styles from "./PanelHome.module.css";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={styles.dash}>

      {/* Top bar */}
      <header className={styles.topBar}>
        <div className={styles.logoMark}>
          <div className={styles.logoSq}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0c0b09" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2h1v6a3 3 0 0 0 6 0V2h1" />
              <path d="M8 2v6" />
              <path d="M15 2c0 4 3 5 3 9a3 3 0 0 1-6 0c0-4 3-5 3-9z" />
              <path d="M8 22v-4" /><path d="M15 22v-4" /><path d="M5 22h14" />
            </svg>
          </div>
          <span className={styles.brandName}>
            NUESTRO<span className={styles.brandAccent}>DASHBOARD</span>
          </span>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Salir
        </button>
      </header>

      {/* Welcome */}
      <div className={styles.welcome}>
        <h1>Hola, {user?.name ?? "Admin"}</h1>
        <p>¿Qué querés gestionar hoy?</p>
      </div>

      {/* Cards */}
      <div className={styles.cards}>
        <button className={styles.navCard} onClick={() => navigate("/admin/menu")}>
          <div className={styles.cardIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardTitle}>Editor de menú</p>
            <p className={styles.cardDesc}>Gestioná platos, precios y categorías de tu carta.</p>
          </div>
          <svg className={styles.cardArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>

        <button className={styles.navCard} onClick={() => navigate("/admin/negocio")}>
          <div className={styles.cardIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a84c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className={styles.cardBody}>
            <p className={styles.cardTitle}>Editor de negocio</p>
            <p className={styles.cardDesc}>Nombre, logo, horarios y datos de tu restaurante.</p>
          </div>
          <svg className={styles.cardArrow} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>

    </div>
  );
}