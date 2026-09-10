import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Moon, Sun } from "lucide-react";
import BrandMark from "../../components/Common/BrandMark";
import { useAuthTheme } from "../../hooks/useAuthTheme";
import { BLOG_PATH } from "./blogContent";
import styles from "./Blog.module.css";

export default function BlogLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme, toggle } = useAuthTheme();
  const themeLabel = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";

  useEffect(() => {
    // Mantiene los enlaces directos a secciones y evita heredar el scroll de la landing.
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={styles.page} data-auth-theme={theme === "light" ? "light" : undefined}>
      <a className={styles.skipLink} href="#contenido">Saltar al contenido</a>
      <header className={styles.header}>
        <Link className={styles.brand} to="/" aria-label="Menú Digital App, inicio">
          <BrandMark className={styles.brandMark} />
          <span>Menú Digital App</span>
        </Link>
        <nav className={styles.navigation} aria-label="Navegación principal">
          <Link className={styles.navLink} to="/">Volver al inicio</Link>
          <button className={styles.themeToggle} type="button" onClick={toggle} aria-label={themeLabel} title={themeLabel}>
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <Link className={styles.button} to="/register?plan=free">Crear cuenta</Link>
        </nav>
      </header>

      <main className={styles.main} id="contenido" tabIndex={-1}>
        {children}
        <section className={styles.cta} aria-labelledby="empezar-titulo">
          <div>
            <p className={styles.eyebrow}>De la idea a tu carta</p>
            <h2 id="empezar-titulo">Tu próxima carta puede empezar acá.</h2>
            <p>Creá tu cuenta y empezá a cargar los productos de tu local.</p>
          </div>
          <Link className={styles.button} to="/register?plan=free">
            Crear mi menú digital <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>Menú Digital App · Hecho en Argentina</p>
        <nav aria-label="Enlaces del pie de página">
          <Link to={BLOG_PATH}>Guías y preguntas</Link>
          <Link to="/contacto">Contacto</Link>
          <Link to="/terminos">Términos</Link>
          <Link to="/privacidad">Privacidad</Link>
        </nav>
      </footer>
    </div>
  );
}
