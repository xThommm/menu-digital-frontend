import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./AdminHome.module.css";
import type { Plan } from "../../../types"

// ─────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    id: "gratis",
    name: "Gratis",
    price: 0,
    highlight: false,
    period: "para siempre",
    features: [
      "Hasta 15 productos",
      "QR descargable",
      "Menú en menudigitalapp.com.ar/tu-local/menu",
      "Incluye publicidad de Menú Digital",
    ],
  },
  {
    id: "mensual",
    name: "Starter",
    price: 5999,
    period: "por mes",
    highlight: false,
    monthlyEquiv: "$5.999/mes",
    features: [
      "Sin publicidad",
      "Productos ilimitados",
      "Landing page del local",
      "Carga masiva por Excel",
      "Soporte por WhatsApp",
    ],
  },
  {
    id: "semestral",
    name: "Pro",
    price: 29999,
    period: "cada 6 meses",
    highlight: true,
    badge: "Más elegido",
    features: [
      "Todo lo del Starter",
      "2 meses gratis (= $5.000/mes)",
      "Estadísticas de visitas",
      "Reservas online (próximamente)",
      "Prioridad en soporte",
    ],
    monthlyEquiv: "$5.000/mes",
  },
  {
    id: "anual",
    name: "Premium",
    price: 49999,
    period: "por año",
    highlight: false,
    badge: "Ahorrás $21.989",
    features: [
      "Dominio propio incluido (.com.ar)",
      "Todo lo del Pro",
      "4 meses gratis (= $4.167/mes)",
      "Integración con delivery (próximamente)",
      "Onboarding por videollamada",
    ],
    monthlyEquiv: "$4.167/mes",
  },
];

const REVIEWS = [
  {
    name: "Martina Sosa",
    business: "La Pérgola Café",
    location: "Palermo, CABA",
    text: "Antes imprimíamos el menú cada semana porque cambiábamos los precios. Ahora en dos minutos lo tenemos actualizado y los clientes lo escanean con el celular.",
    stars: 5,
    initial: "M",
  },
  {
    name: "Roberto Funes",
    business: "Don Funes Parrilla",
    location: "Lanús, GBA Sur",
    text: "Pensé que era complicado pero me ayudaron a cargarlo todo desde un Excel. Mis clientes me dicen que el menú se ve muy prolijo. Vale cada peso.",
    stars: 5,
    initial: "R",
  },
  {
    name: "Camila Ríos",
    business: "Café del Ángel",
    location: "Córdoba Capital",
    text: "Lo que más me gusta es poder ocultar lo que se agotó sin borrarlo. Y el diseño quedó igual que la estética del local. Lo recomiendo a todos mis colegas.",
    stars: 5,
    initial: "C",
  },
  {
    name: "Hernán Vidal",
    business: "Sushi Nakamura",
    location: "Rosario, Santa Fe",
    text: "Tenemos más de 80 productos y la carga masiva por Excel nos ahorró horas de trabajo. El soporte responde rápido y siempre resuelven.",
    stars: 5,
    initial: "H",
  },
];

// ─────────────────────────────────────────────
// HOOK: PARALLAX
// ─────────────────────────────────────────────
function useParallax() {
  const scrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY;
      const heroBg = document.getElementById("heroBg");
      const heroGrid = document.getElementById("heroGrid");
      const parBg = document.getElementById("parBg");
      const parGrid = document.getElementById("parGrid");
      const y = scrollY.current;

      if (heroBg) heroBg.style.transform = `translateY(${y * 0.3}px)`;
      if (heroGrid) heroGrid.style.transform = `translateY(${y * 0.12}px)`;

      const bannerEl = parBg?.closest(`.${styles.parBanner}`) as HTMLElement | null;
      if (parBg && bannerEl) {
        const rel = y - bannerEl.offsetTop;
        parBg.style.transform = `translateY(${rel * 0.35}px)`;
      }
      if (parGrid && bannerEl) {
        const rel = y - bannerEl.offsetTop;
        parGrid.style.transform = `perspective(700px) rotateX(28deg) translateY(${rel * 0.18}px)`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

// ─────────────────────────────────────────────
// HOOK: REVEAL ON SCROLL
// ─────────────────────────────────────────────
function useReveal() {
  useEffect(() => {
    const check = () => {
      document.querySelectorAll(`.${styles.reveal}`).forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight - 60) {
          el.classList.add(styles.revealed);
        }
      });
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }, []);
}

// ─────────────────────────────────────────────
// HOOK: ANIMATED COUNTER
// ─────────────────────────────────────────────
function useCounterOnView(
  ref: React.RefObject<HTMLElement>,
  target: number,
  format: (n: number) => string,
  setter: (v: string) => void
) {
  const formatRef = useRef(format);
  const setterRef = useRef(setter);

  useEffect(() => {
    formatRef.current = format;
    setterRef.current = setter;
  });

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        obs.disconnect();
        const dur = 1800;
        const start = performance.now();
        const step = (ts: number) => {
          const p = Math.min((ts - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setterRef.current(formatRef.current(Math.floor(target * ease)));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// ─────────────────────────────────────────────
// SUBCOMPONENTE: CURSOR PERSONALIZADO
// ─────────────────────────────────────────────
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mx = 0, my = 0, rx = 0, ry = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; };
    document.addEventListener("mousemove", onMove);

    let raf: number;
    const animate = () => {
      if (dotRef.current) {
        dotRef.current.style.left = mx + "px";
        dotRef.current.style.top = my + "px";
      }
      rx += (mx - rx) * 0.11;
      ry += (my - ry) * 0.11;
      if (ringRef.current) {
        ringRef.current.style.left = rx + "px";
        ringRef.current.style.top = ry + "px";
      }
      raf = requestAnimationFrame(animate);
    };
    animate();

    const expand = () => {
      if (dotRef.current) { dotRef.current.style.width = "12px"; dotRef.current.style.height = "12px"; }
      if (ringRef.current) { ringRef.current.style.width = "52px"; ringRef.current.style.height = "52px"; ringRef.current.style.borderColor = "rgba(255,149,0,.75)"; }
    };
    const contract = () => {
      if (dotRef.current) { dotRef.current.style.width = "7px"; dotRef.current.style.height = "7px"; }
      if (ringRef.current) { ringRef.current.style.width = "32px"; ringRef.current.style.height = "32px"; ringRef.current.style.borderColor = "rgba(255,149,0,.45)"; }
    };
    const interactiveEls = document.querySelectorAll("a,button,[data-hover]");
    interactiveEls.forEach((el) => { el.addEventListener("mouseenter", expand); el.addEventListener("mouseleave", contract); });

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      interactiveEls.forEach((el) => { el.removeEventListener("mouseenter", expand); el.removeEventListener("mouseleave", contract); });
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className={styles.curDot} />
      <div ref={ringRef} className={styles.curRing} />
    </>
  );
}

// ─────────────────────────────────────────────
// SUBCOMPONENTE: MOCKUP TELÉFONO (hero)
// ─────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div className={styles.phoneWrap}>
      <div className={styles.phoneGlow} />
      <div className={styles.mockPhone}>
        <div className={styles.phoneNotch} />
        <div className={styles.mockScreen}>
          <div className={styles.mockBar} />
          <div className={styles.mockBiz}>La Pérgola Café</div>
          <div className={styles.mockLoc}>📍 Palermo, CABA</div>
          <div className={styles.mockSection}>🍕 Pizzas</div>
          {[
            { name: "Napolitana", desc: "Tomate y mozzarella", price: "$2.800", badge: "⭐ Destacada" },
            { name: "Fugazza", desc: "Cebolla y mozzarella", price: "$2.600" },
            { name: "Especial", desc: "Ingredientes de estación", price: "$3.200" },
          ].map((item, i) => (
            <div className={styles.mockItem} key={i}>
              <div>
                <div className={styles.mockItemName}>{item.name}</div>
                <div className={styles.mockItemDesc}>{item.desc}</div>
                {item.badge && <div className={styles.mockBadge}>{item.badge}</div>}
              </div>
              <div className={styles.mockItemPrice}>{item.price}</div>
            </div>
          ))}
          <div className={styles.mockSection} style={{ marginTop: 16 }}>☕ Bebidas</div>
          {[
            { name: "Agua mineral", desc: "500ml", price: "$800" },
            { name: "Gaseosa", desc: "Lata 354ml", price: "$950" },
          ].map((item, i) => (
            <div className={styles.mockItem} key={i}>
              <div>
                <div className={styles.mockItemName}>{item.name}</div>
                <div className={styles.mockItemDesc}>{item.desc}</div>
              </div>
              <div className={styles.mockItemPrice}>{item.price}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SUBCOMPONENTE: QR FRAME
// ─────────────────────────────────────────────
function QRFrame() {
  return (
    <div className={styles.qrVisual}>
      <div className={styles.qrFrame}>
        <div className={`${styles.qrCorner} ${styles.qrTl}`} />
        <div className={`${styles.qrCorner} ${styles.qrTr}`} />
        <div className={`${styles.qrCorner} ${styles.qrBl}`} />
        <div className={`${styles.qrCorner} ${styles.qrBr}`} />
        <div className={styles.scanLine} />
        <svg viewBox="0 0 200 200" width="200" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="60" height="60" fill="none" stroke="#000" strokeWidth="5" rx="4" />
          <rect x="22" y="22" width="36" height="36" fill="#000" rx="2" />
          <rect x="130" y="10" width="60" height="60" fill="none" stroke="#000" strokeWidth="5" rx="4" />
          <rect x="142" y="22" width="36" height="36" fill="#000" rx="2" />
          <rect x="10" y="130" width="60" height="60" fill="none" stroke="#000" strokeWidth="5" rx="4" />
          <rect x="22" y="142" width="36" height="36" fill="#000" rx="2" />
          <rect x="84" y="10" width="12" height="12" fill="#000" rx="1" />
          <rect x="100" y="10" width="12" height="12" fill="#000" rx="1" />
          <rect x="116" y="10" width="12" height="12" fill="#000" rx="1" />
          <rect x="84" y="26" width="12" height="12" fill="#000" rx="1" />
          <rect x="116" y="42" width="12" height="12" fill="#000" rx="1" />
          <rect x="10" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="10" y="100" width="12" height="12" fill="#000" rx="1" />
          <rect x="26" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="42" y="116" width="12" height="12" fill="#000" rx="1" />
          <rect x="84" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="100" y="100" width="12" height="12" fill="#000" rx="1" />
          <rect x="116" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="84" y="116" width="12" height="12" fill="#000" rx="1" />
          <rect x="130" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="146" y="100" width="12" height="12" fill="#000" rx="1" />
          <rect x="162" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="178" y="84" width="12" height="12" fill="#000" rx="1" />
          <rect x="130" y="116" width="12" height="12" fill="#000" rx="1" />
          <rect x="162" y="130" width="12" height="12" fill="#000" rx="1" />
          <rect x="100" y="130" width="12" height="12" fill="#000" rx="1" />
          <rect x="116" y="146" width="12" height="12" fill="#000" rx="1" />
          <rect x="100" y="162" width="12" height="12" fill="#000" rx="1" />
          <rect x="130" y="178" width="12" height="12" fill="#000" rx="1" />
          <rect x="146" y="162" width="12" height="12" fill="#000" rx="1" />
          <rect x="178" y="130" width="12" height="12" fill="#000" rx="1" />
          <rect x="178" y="162" width="12" height="12" fill="#000" rx="1" />
          <rect x="92" y="92" width="16" height="16" fill="#ff9500" rx="2" />
        </svg>
      </div>
      <p className={styles.qrLabel}>↑ Tu QR personalizado</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function HomePage() {
  const [billingOpen, setBillingOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(
  PLANS.find((p) => p.id === "anual") ?? null
);
  const [visible, setVisible] = useState(false);

  // Stat counters
  const statsRef = useRef<HTMLDivElement>(null!);
  const [s0, setS0] = useState("+0");
  const [s1, setS1] = useState("+0K");
  const [s2, setS2] = useState("0 min");
  const [s3, setS3] = useState("0%");
  useCounterOnView(statsRef, 500, (n) => `+${n}`, setS0);
  useCounterOnView(statsRef, 80, (n) => `+${n}K`, setS1);
  useCounterOnView(statsRef, 2, (n) => `${n} min`, setS2);
  useCounterOnView(statsRef, 100, (n) => `${n}%`, setS3);

  useParallax();
  useReveal();

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Steam rings
  useEffect(() => {
    const steamEl = document.getElementById("steamContainer");
    if (!steamEl) return;
    for (let i = 0; i < 10; i++) {
      const r = document.createElement("div");
      r.className = styles.steamRing;
      const size = 30 + Math.random() * 80;
      const x = 10 + Math.random() * 80;
      const y = 20 + Math.random() * 60;
      const dur = 8 + Math.random() * 8;
      const delay = Math.random() * 12;
      r.style.cssText = `width:${size}px;height:${size}px;left:${x}%;top:${y}%;animation-duration:${dur}s;animation-delay:-${delay}s`;
      steamEl.appendChild(r);
    }
  }, []);

  useEffect(() => {
  if (!menuOpen) return;
  const handleClick = (e: MouseEvent | TouchEvent) => {
    if (navRef.current && !navRef.current.contains(e.target as Node)) {
      setMenuOpen(false);
    }
  };
  document.addEventListener('mousedown', handleClick);
  document.addEventListener('touchstart', handleClick);
  return () => {
    document.removeEventListener('mousedown', handleClick);
    document.removeEventListener('touchstart', handleClick);
  };
}, [menuOpen]);

  // Toda cuenta arranca gratis. El cobro real (MercadoPago) solo se dispara
  // desde adentro del panel, ya logueado, cuando el usuario quiere mejorar
  // su plan — ahí el backend sabe a quién asociarle el pago
  // (crear-preferencia requiere auth, ver paymentRoutes.js). Por eso, sin
  // importar el plan que elija acá, primero se registra.
  const goRegister = () => {
    window.location.href = "/register";
  };

  // Detectar si viene de un pago fallido/cancelado en MP
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") === "mp_failure") {
    // Limpiar la URL sin recargar
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);

  const openBilling = () => {
  setSelectedPlan(PLANS.find((p) => p.id === "semestral") ?? null);
  setBillingOpen(true);
};

  return (
    <>
      <CustomCursor />

      <div className={styles.hpage}>

        {/* ── NAV ── */}
        <nav className={styles.nav} ref={navRef}>
  <a className={styles.navLogo} href="/">Menú<span> Digital</span></a>
 
  {/* Links — ocultos en mobile, sin cambios en desktop */}
  <ul className={styles.navLinks}>
    <li><a href="#how">Cómo funciona</a></li>
    <li><a href="#features">Funciones</a></li>
    <li><a href="#reviews">Clientes</a></li>
    <li><a href="#about">Quiénes somos</a></li>
  </ul>
 
  {/* Actions — ocultos en mobile, sin cambios en desktop */}
  <div className={styles.navActions}>
    <Link to="/login" className={styles.navLogin}>Iniciar sesión</Link>
    <Link to="/register" className={styles.navRegister}>Crear cuenta</Link>
    <button className={styles.navCta} onClick={() => openBilling()}>Ver precios</button>
  </div>
 
  {/* Hamburger — SOLO visible en mobile (≤900px) */}
  <button
    className={styles.hamburger}
    onClick={() => setMenuOpen(o => !o)}
    aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
    aria-expanded={menuOpen}
  >
    <span className={`${styles.hLine} ${menuOpen ? styles.hLineOpen1 : ""}`} />
    <span className={`${styles.hLine} ${menuOpen ? styles.hLineOpen2 : ""}`} />
    <span className={`${styles.hLine} ${menuOpen ? styles.hLineOpen3 : ""}`} />
  </button>
 
  {/* Dropdown mobile — SOLO visible en mobile cuando menuOpen=true */}
  <div className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : ""}`}>
    <a href="#how" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
      Cómo funciona
    </a>
    <a href="#features" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
      Funciones
    </a>
    <a href="#reviews" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
      Clientes
    </a>
    <a href="#about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
      Quiénes somos
    </a>
    <Link
      to="/login"
      className={styles.mobileLink}
      onClick={() => setMenuOpen(false)}
    >
      Iniciar sesión
    </Link>
    <Link
      to="/register"
      className={styles.mobileLinkRegister}
      onClick={() => setMenuOpen(false)}
    >
      Crear cuenta
    </Link>
    <button
      className={styles.mobileLinkCta}
      onClick={() => { setMenuOpen(false); openBilling(); }}
    >
      Ver precios →
    </button>
  </div>
</nav>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          {/* parallax layers */}
          <div id="heroBg" className={styles.heroBg} />
          <div id="heroGrid" className={styles.heroGrid} />
          <div id="steamContainer" className={styles.steam} />

          <div className={styles.heroInner}>
            <div className={styles.heroText}>
              <div className={`${styles.heroTag} ${visible ? styles.vis : ""}`}>
                🇦🇷 Hecho para gastronomía argentina
              </div>
              <h1 className={`${styles.heroH1} ${visible ? styles.vis : ""}`}>
                Tu menú,<br />en el <em>celular</em><br />de tus clientes.
              </h1>
              <p className={`${styles.heroSub} ${visible ? styles.vis : ""}`}>
                Creá tu menú digital en minutos. Actualizá precios, ocultá platos agotados y dejá que tus clientes lo vean desde cualquier dispositivo — sin descargar nada.
              </p>
              <div className={`${styles.heroBtns} ${visible ? styles.vis : ""}`}>
                <button className={styles.btnPrimary} onClick={() => openBilling()}>
                  Empezar ahora →
                </button>
                <button
                  className={styles.btnSecondary}
                  onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}
                >
                  ¿Cómo funciona?
                </button>
              </div>
            </div>

            <div className={`${styles.heroVisual} ${visible ? styles.vis : ""}`}>
              <PhoneMockup />
            </div>
          </div>

          <div className={styles.scrollHint}>
            <span>SCROLL</span>
          </div>
        </section>

        {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

        {/* ── STATS ── */}
        <div className={styles.stats} ref={statsRef}>
          {[
            { n: s0, l: "locales activos" },
            { n: s1, l: "consultas por mes" },
            { n: s2, l: "para publicar tu menú" },
            { n: s3, l: "desde el celular" },
          ].map((s, i) => (
            <div className={styles.stat} key={i}>
              <div className={styles.statN}>{s.n}</div>
              <div className={styles.statL}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className={styles.how} id="how">
          <div className={styles.sectionInner}>
            <div className={styles.reveal}>
              <div className={styles.eyebrow}>¿Cómo funciona?</div>
              <h2 className={styles.sectionH2}>
                De cero a menú publicado<br />en <em>tres pasos.</em>
              </h2>
            </div>
            <div className={styles.steps}>
              {[
                { icon: "🧾", title: "Elegís tu plan", desc: "Seleccionás el plan que mejor se ajusta a tu negocio. Sin contratos, sin letras chicas. Podés cancelar cuando quieras.", n: "1" },
                { icon: "🍽️", title: "Cargás tu menú", desc: "Usás nuestra interfaz sencilla o subís un Excel con todos tus productos de una. Agregás fotos, precios y categorías.", n: "2" },
                { icon: "📲", title: "Tus clientes lo ven", desc: "Tu menú queda disponible en menudigitalapp.com.ar/tu-local/menu. Lo compartís por WhatsApp, Instagram o imprimís el QR.", n: "3" },
              ].map((s, i) => (
                <div className={`${styles.step} ${styles.reveal}`} key={i} data-hover>
                  <div className={styles.stepNum}>{s.n}</div>
                  <div className={styles.stepIcon}>{s.icon}</div>
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepDesc}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── PARALLAX BANNER ── */}
        <div className={styles.parBanner}>
          <div id="parBg"   className={styles.parBannerBg} />
          <div id="parGrid" className={styles.parBannerGrid} />
          <div className={styles.parBannerText}>
            <div className={styles.parBannerBig}>Sin papel.</div>
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section className={styles.features} id="features">
          <div className={styles.sectionInner}>
            <div className={styles.reveal}>
              <div className={styles.eyebrow}>Funcionalidades</div>
              <h2 className={styles.sectionH2}>
                Todo lo que necesitás.<br /><em>Nada que sobre.</em>
              </h2>
            </div>
            <div className={styles.featGrid}>
              {[
                { icon: "⚡", title: "Actualizaciones instantáneas", desc: "Cambiá precios, ocultá platos agotados o agregá el especial del día. Se actualiza en tiempo real para todos tus clientes." },
                { icon: "📊", title: "Carga masiva por Excel", desc: "¿Tenés 80 productos? Completá la plantilla y subila. El sistema detecta qué cambió y te muestra un resumen antes de confirmar." },
                { icon: "🎨", title: "Diseño a tu imagen", desc: "Elegí entre múltiples templates y personalizá con el logo y los colores de tu local. Tu menú, tu identidad." },
                { icon: "🗂️", title: "Secciones y categorías", desc: "Organizá tu menú como más te guste: secciones generales, categorías, extras y destacados. La estructura que necesite tu negocio." },
                { icon: "🕐", title: "Ofertas programadas", desc: "Configurá un precio de oferta con fechas de inicio y fin. Se activa y desactiva solo, sin que tengas que acordarte." },
                { icon: "📱", title: "Funciona en cualquier celular", desc: "Sin descargas, sin apps. Tus clientes entran desde el navegador y ven el menú al instante, desde cualquier dispositivo." },
              ].map((f, i) => (
                <div className={`${styles.featCard} ${styles.reveal}`} key={i} data-hover>
                  <div className={styles.featIcon}>{f.icon}</div>
                  <div className={styles.featTitle}>{f.title}</div>
                  <div className={styles.featDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── QR DEMO ── */}
        <section className={styles.qrSection}>
          <div className={styles.qrInner}>
            <div className={styles.reveal}>
              <QRFrame />
            </div>
            <div className={styles.reveal}>
              <div className={styles.eyebrow}>Sin complicaciones</div>
              <h2 className={styles.sectionH2}>
                Un QR.<br /><em>Todo tu menú.</em>
              </h2>
              <p className={styles.qrDesc}>
                Imprimís el código QR y lo ponés en la mesa, en la barra o en la puerta. Cada escaneo lleva al menú actualizado al instante. Sin links raros, sin descargas, sin fricción.
              </p>
              <ul className={styles.qrList}>
                <li>Funciona con la cámara nativa del celular</li>
                <li>Se abre en el navegador, sin instalar nada</li>
                <li>Un QR para todas las mesas o uno por mesa</li>
                <li>Descargable en PDF listo para imprimir</li>
              </ul>
              <button className={styles.btnPrimary} onClick={() => openBilling()}>
                Quiero mi QR gratis →
              </button>
            </div>
          </div>
        </section>

        {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

        {/* ── REVIEWS ── */}
        <section className={styles.reviews} id="reviews">
          <div className={styles.sectionInner}>
            <div className={styles.reveal}>
              <div className={styles.eyebrow}>Reseñas</div>
              <h2 className={styles.sectionH2}>
                Lo que dicen los locales<br /><em>que ya lo usan.</em>
              </h2>
            </div>
            <div className={styles.revGrid}>
              {REVIEWS.map((r, i) => (
                <div className={`${styles.revCard} ${styles.reveal}`} key={i} data-hover>
                  <div className={styles.revStars}>{"★".repeat(r.stars)}</div>
                  <p className={styles.revText}>"{r.text}"</p>
                  <div className={styles.revFooter}>
                    <div className={styles.revAvatar}>{r.initial}</div>
                    <div>
                      <div className={styles.revName}>{r.name}</div>
                      <div className={styles.revBiz}>{r.business} · {r.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ABOUT ── */}
        <section className={styles.about} id="about">
          <div className={styles.aboutInner}>
            <div className={`${styles.aboutText} ${styles.reveal}`}>
              <div className={styles.eyebrow}>Quiénes somos</div>
              <h2 className={styles.sectionH2}>
                Construido por gente<br /><em>que ama la gastronomía.</em>
              </h2>
              <p className={styles.aboutP}>
                Somos un equipo argentino que creció entre mesas, cocinas y cartas laminadas. Sabemos lo que cuesta imprimir el menú cada vez que cambia un precio, y la cara que pone el mozo cuando el cliente pide algo que ya no hay.
              </p>
              <p className={styles.aboutP}>
                Menú Digital nació para resolver eso: una herramienta simple, pensada para dueños de locales reales, no para técnicos. Si podés mandar un WhatsApp, podés manejar tu menú digital.
              </p>
              <div className={styles.aboutPills}>
                <span className={styles.pill}>🇦🇷 100% argentino</span>
                <span className={styles.pill}>💬 Soporte en español</span>
                <span className={styles.pill}>🔒 Datos seguros</span>
              </div>
            </div>
            <div className={styles.aboutVisual}>
              {[
                { icon: "🤝", title: "Soporte real", desc: "Respondemos por WhatsApp. Sin tickets, sin esperas de 48hs." },
                { icon: "📈", title: "Siempre mejorando", desc: "Escuchamos a nuestros clientes y lanzamos mejoras cada mes." },
                { icon: "🔒", title: "Tus datos, seguros", desc: "Información encriptada y respaldada todos los días." },
                { icon: "💰", title: "Sin sorpresas", desc: "Precio fijo mensual. Sin comisiones por venta ni costos ocultos." },
              ].map((c, i) => (
                <div className={`${styles.aboutCard} ${styles.reveal}`} key={i} data-hover>
                  <div className={styles.aboutCardIcon}>{c.icon}</div>
                  <div className={styles.aboutCardTitle}>{c.title}</div>
                  <div className={styles.aboutCardDesc}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className={styles.finalCta}>
          <div className={styles.reveal}>
            <h2 className={styles.finalCtaH2}>
              Tu menú digital,<br /><em>hoy mismo.</em>
            </h2>
            <p className={styles.finalCtaSub}>Sin contratos. Sin instalaciones. Listo en minutos.</p>
            <button
              className={styles.btnPrimary}
              style={{ fontSize: 18, padding: "18px 48px" }}
              onClick={() => openBilling()}
            >
              Ver planes y precios →
            </button>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className={styles.footer}>
          <div className={styles.footInner}>
            <div className={styles.footLogo}>Menú Digital</div>
            <div className={styles.footLinks}>
              <Link to="/terminos">Términos</Link>
              <Link to="/privacidad">Privacidad</Link>
              <Link to="/contacto">Contacto</Link>
              <Link to="/contacto">Soporte</Link>
            </div>
            <div className={styles.footCopy}>© 2026 Menú Digital. Hecho en Argentina 🇦🇷</div>
          </div>
        </footer>

      </div>

      {/* ── BILLING POPUP ── */}
      {billingOpen && (
        <div
          className={styles.overlay}
          onClick={(e) => e.target === e.currentTarget && setBillingOpen(false)}
        >
          <div className={styles.billing}>
            <div className={styles.billingHeader}>
              <div>
                <div className={styles.billingTitle}>Elegí tu plan</div>
                <div className={styles.billingSub}>
                  Todos incluyen menú digital completo. Cancelás cuando quieras.
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setBillingOpen(false)}>✕</button>
            </div>

            <div className={styles.plansGrid}>
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={[
                    styles.planCard,
                    plan.highlight ? styles.highlightCard : "",
                    selectedPlan?.id === plan.id ? styles.selected : "",
                  ].join(" ")}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {plan.badge && <div className={styles.planBadge}>{plan.badge}</div>}
                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planPrice}>
                    <span>$</span>{plan.price.toLocaleString("es-AR")}
                  </div>
                  <div className={styles.planPeriod}>{plan.period}</div>
                  <ul className={styles.planFeat}>
                    {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className={styles.billingFooter}>
              <div className={styles.billingSummary}>
                <div>
                  <div className={styles.billingTotal}>Total a pagar</div>
                  <div className={styles.billingPlanName}>
                    Plan {selectedPlan?.name} · {selectedPlan?.period}
                  </div>
                </div>
                <div className={styles.billingAmount}>
                  ${selectedPlan?.price.toLocaleString("es-AR")}
                </div>
              </div>
              <button
  className={styles.payBtn}
  onClick={goRegister}
>
  {selectedPlan?.id === "gratis" ? (
    <>Continuar con plan gratuito →</>
  ) : (
    <>Crear cuenta y elegir plan →</>
  )}
</button>
              <div className={styles.paySafe}>🔒 Pago seguro · Tus datos están protegidos</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}