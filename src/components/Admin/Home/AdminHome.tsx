import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  MapPin,
  Pizza,
  Star,
  Coffee,
  ClipboardCheck,
  UtensilsCrossed,
  QrCode,
  Zap,
  FileSpreadsheet,
  Palette,
  FolderTree,
  Clock,
  Smartphone,
  Handshake,
  TrendingUp,
  ShieldCheck,
  Wallet,
  Sun,
  Moon,
  MessageCircle,
  Mail,
  X,
  type LucideIcon,
} from "lucide-react";
import BrandMark from "../../Common/BrandMark";
import styles from "./AdminHome.module.css";
import { usePlans } from "../../../hooks/usePlans";
import { useAuthTheme } from "../../../hooks/useAuthTheme";
import { getPlanFeatureLabels } from "../../../lib/plans";
import Spinner from "../../Common/Spinner";

const SITE_URL = "https://www.menudigitalapp.com.ar";
const QR_REGISTER_SRC = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${SITE_URL}/register`;

const CONTACT_WHATSAPP_NUMBER = "5491123329630"; // +54 9 11 2332-9630
const CONTACT_INSTAGRAM_URL = "https://www.instagram.com/menudigitalapp_/";
const CONTACT_FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61593738855931";
const CONTACT_EMAIL = "menudigitalappsoporte@gmail.com";

const CONTACT_CHANNELS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    href: `https://wa.me/${CONTACT_WHATSAPP_NUMBER}`,
    icon: <WhatsAppIcon />,
    itemClass: styles.contactWhatsapp,
  },
  {
    key: "instagram",
    label: "Instagram",
    href: CONTACT_INSTAGRAM_URL,
    icon: <InstagramIcon />,
    itemClass: styles.contactInstagram,
  },
  {
    key: "facebook",
    label: "Facebook",
    href: CONTACT_FACEBOOK_URL,
    icon: <FacebookIcon />,
    itemClass: styles.contactFacebook,
  },
  {
    key: "email",
    label: "Email",
    href: `mailto:${CONTACT_EMAIL}`,
    icon: <Mail />,
    itemClass: styles.contactEmail,
  },
];

// ─────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────

// const REVIEWS = [
//   {
//     name: "Martina Sosa",
//     business: "La Pérgola Café",
//     location: "Palermo, CABA",
//     text: "Antes imprimíamos el menú cada semana porque cambiábamos los precios. Ahora en dos minutos lo tenemos actualizado y los clientes lo escanean con el celular.",
//     stars: 5,
//     initial: "M",
//   },
//   {
//     name: "Roberto Funes",
//     business: "Don Funes Parrilla",
//     location: "Lanús, GBA Sur",
//     text: "Pensé que era complicado pero me ayudaron a cargarlo todo desde un Excel. Mis clientes me dicen que el menú se ve muy prolijo. Vale cada peso.",
//     stars: 5,
//     initial: "R",
//   },
//   {
//     name: "Camila Ríos",
//     business: "Café del Ángel",
//     location: "Córdoba Capital",
//     text: "Lo que más me gusta es poder ocultar lo que se agotó sin borrarlo. Y el diseño quedó igual que la estética del local. Lo recomiendo a todos mis colegas.",
//     stars: 5,
//     initial: "C",
//   },
//   {
//     name: "Hernán Vidal",
//     business: "Sushi Nakamura",
//     location: "Rosario, Santa Fe",
//     text: "Tenemos más de 80 productos y la carga masiva por Excel nos ahorró horas de trabajo. El soporte responde rápido y siempre resuelven.",
//     stars: 5,
//     initial: "H",
//   },
// ];

type IconCard = { icon: LucideIcon; title: string; desc: string; n?: string };

const STEPS: IconCard[] = [
  { icon: ClipboardCheck, title: "Elegís tu plan", desc: "Seleccionás el plan que mejor se ajusta a tu negocio. Sin contratos, sin letras chicas.", n: "1" },
  { icon: UtensilsCrossed, title: "Cargás tu menú", desc: "Usás nuestra interfaz sencilla o subís un Excel con todos tus productos de una. Agregás fotos, precios y categorías.", n: "2" },
  { icon: QrCode, title: "Tus clientes lo ven", desc: "Tu menú queda disponible en menudigitalapp.com.ar/tu-local/menu. Lo compartís por WhatsApp, Instagram o imprimís el QR.", n: "3" },
];

const FEATURES: IconCard[] = [
  { icon: Zap, title: "Actualizaciones instantáneas", desc: "Cambiá precios, ocultá platos agotados o agregá el especial del día. Se actualiza en tiempo real para todos tus clientes." },
  { icon: FileSpreadsheet, title: "Carga masiva por Excel", desc: "¿Tenés 80 productos? Completá la plantilla y subila. El sistema detecta qué cambió y te muestra un resumen antes de confirmar." },
  { icon: Palette, title: "Diseño a tu imagen", desc: "Elegí entre múltiples templates y personalizá con el logo y los colores de tu local. Tu menú, tu identidad." },
  { icon: FolderTree, title: "Secciones y categorías", desc: "Organizá tu menú como más te guste: secciones generales, categorías, extras y destacados. La estructura que necesite tu negocio." },
  { icon: Clock, title: "Ofertas programadas", desc: "Configurá un precio de oferta con fechas de inicio y fin. Se activa y desactiva solo, sin que tengas que acordarte." },
  { icon: Smartphone, title: "Funciona en cualquier celular", desc: "Sin descargas, sin apps. Tus clientes entran desde el navegador y ven el menú al instante, desde cualquier dispositivo." },
];

const ABOUT_CARDS: IconCard[] = [
  { icon: Handshake, title: "Soporte real", desc: "Respondemos por WhatsApp. Sin tickets, sin esperas de 48hs." },
  { icon: TrendingUp, title: "Siempre mejorando", desc: "Escuchamos a nuestros clientes y lanzamos mejoras cada mes." },
  { icon: ShieldCheck, title: "Tus datos, seguros", desc: "Información encriptada y respaldada todos los días." },
  { icon: Wallet, title: "Sin sorpresas", desc: "Precio fijo mensual. Sin comisiones por venta ni costos ocultos." },
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
// HOOK: TÍTULO DE PÁGINA (restaura el título anterior al desmontar)
// ─────────────────────────────────────────────
function useDocumentTitle(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    return () => {
      document.title = previousTitle;
    };
  }, [title]);
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
      if (ringRef.current) { ringRef.current.style.width = "52px"; ringRef.current.style.height = "52px"; ringRef.current.style.borderColor = "color-mix(in srgb, var(--auth-amber) 75%, transparent)"; }
    };
    const contract = () => {
      if (dotRef.current) { dotRef.current.style.width = "7px"; dotRef.current.style.height = "7px"; }
      if (ringRef.current) { ringRef.current.style.width = "32px"; ringRef.current.style.height = "32px"; ringRef.current.style.borderColor = "color-mix(in srgb, var(--auth-amber) 45%, transparent)"; }
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
          <div className={styles.mockLoc}><MapPin className={styles.mockIcon} />Palermo, CABA</div>
          <div className={styles.mockSection}><Pizza className={styles.mockIcon} />Pizzas</div>
          {[
            { name: "Napolitana", desc: "Tomate y mozzarella", price: "$2.800", badge: "Destacada" },
            { name: "Fugazza", desc: "Cebolla y mozzarella", price: "$2.600" },
            { name: "Especial", desc: "Ingredientes de estación", price: "$3.200" },
          ].map((item, i) => (
            <div className={styles.mockItem} key={i}>
              <div>
                <div className={styles.mockItemName}>{item.name}</div>
                <div className={styles.mockItemDesc}>{item.desc}</div>
                {item.badge && <div className={styles.mockBadge}><Star className={styles.mockIcon} />{item.badge}</div>}
              </div>
              <div className={styles.mockItemPrice}>{item.price}</div>
            </div>
          ))}
          <div className={styles.mockSection} style={{ marginTop: 16 }}><Coffee className={styles.mockIcon} />Bebidas</div>
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
function QRFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.qrVisual}>
      <div className={styles.qrFrame}>
        <div className={`${styles.qrCorner} ${styles.qrTl}`} />
        <div className={`${styles.qrCorner} ${styles.qrTr}`} />
        <div className={`${styles.qrCorner} ${styles.qrBl}`} />
        <div className={`${styles.qrCorner} ${styles.qrBr}`} />
        <div className={styles.scanLine} />
        {children}
      </div>
      <p className={styles.qrLabel}>↑ Tu QR personalizado</p>
    </div>
  );
}

// ─────────────────────────────────────────────
// ÍCONO: WHATSAPP (lucide no trae el glifo de marca)
// ─────────────────────────────────────────────
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.85 9.85 0 0 0 4.73 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.83c0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.66-1.23-1.46-1.37-1.71-.14-.24-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.14.17-.24.25-.4.08-.16.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43-.14-.01-.31-.01-.48-.01-.16 0-.43.06-.66.31-.23.24-.86.85-.86 2.06 0 1.22.88 2.4 1 2.56.13.16 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.55.1.47-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

// lucide-react no incluye íconos de marca (los sacaron hace varias
// versiones) — mismo patrón que InstagramIcon/FacebookIcon en
// UserHome.tsx: un glifo simple en vez del logo oficial.
function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// SUBCOMPONENTE: BOTÓN FLOTANTE DE CONTACTO
// Despliega los canales de CONTACT_CHANNELS. Se cierra al hacer click
// afuera, al elegir un canal o con Escape (mismo patrón que el dropdown
// mobile del nav, más arriba en este archivo).
// ─────────────────────────────────────────────
function ContactFab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.contactFab} ref={rootRef}>
      {open && (
        <div className={styles.contactPanel} role="menu">
          {CONTACT_CHANNELS.map((c) => (
            <a
              key={c.key}
              href={c.href}
              className={`${styles.contactItem} ${c.itemClass}`}
              target={c.key === "email" ? undefined : "_blank"}
              rel={c.key === "email" ? undefined : "noreferrer"}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className={styles.contactItemIcon}>{c.icon}</span>
              {c.label}
            </a>
          ))}
        </div>
      )}
      <button
        type="button"
        className={styles.contactFabBtn}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Cerrar contacto" : "Contactanos"}
      >
        {open ? <X /> : <MessageCircle />}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
const FAQS = [
  {
    question: "¿Qué es un menú digital QR?",
    answer:
      "Es una carta online a la que los clientes acceden escaneando un código QR con su celular. Permite mostrar productos, categorías, precios, imágenes y otra información del negocio sin depender únicamente de una carta impresa.",
  },
  {
    question: "¿Cómo funciona un menú QR para restaurantes?",
    answer:
      "Creás tu menú digital, cargás los productos y compartís el código QR generado. El cliente escanea el código con la cámara de su celular y la carta se abre directamente en el navegador.",
  },
  {
    question: "¿Tengo que cambiar el código QR si modifico los precios?",
    answer:
      "No. Podés modificar productos, precios, ofertas y disponibilidad sin cambiar el código QR. Los clientes que vuelvan a escanearlo accederán al menú actualizado.",
  },
  {
    question: "¿El cliente tiene que descargar una aplicación?",
    answer:
      "No. El menú funciona desde el navegador del celular, por lo que el cliente no necesita instalar ninguna aplicación ni crear una cuenta.",
  },
  {
    question: "¿Puedo usar el mismo QR en todas las mesas?",
    answer:
      "Sí. Podés imprimir el mismo código QR y colocarlo en distintas mesas, en la barra, en la puerta o compartir el enlace del menú por WhatsApp e Instagram.",
  },
  {
    question: "¿Puedo cargar muchos productos de una sola vez?",
    answer:
      "Según el plan disponible, podés utilizar la carga masiva mediante Excel para incorporar o actualizar una gran cantidad de productos de forma más rápida.",
  },
  {
    question: "¿Sirve para cafeterías y bares además de restaurantes?",
    answer:
      "Sí. Menú Digital App está pensado para restaurantes, cafeterías, bares, rotiserías y otros negocios gastronómicos que necesiten publicar y actualizar su carta online.",
  },
];

export default function HomePage() {
  const catalog = usePlans();
  const [menuOpen, setMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const { theme, toggle: toggleTheme } = useAuthTheme();
  const themeLabel = theme === "dark" ? "Activar tema claro" : "Activar tema oscuro";

  useParallax();
  useReveal();
  useDocumentTitle("Menú Digital QR para Restaurantes | Menú Digital App");

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

  // Detectar si viene de un pago fallido/cancelado en MP
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") === "mp_failure") {
    // Limpiar la URL sin recargar
    window.history.replaceState({}, "", window.location.pathname);
  }
}, []);

  return (
    <>
      <CustomCursor />

      <div className={styles.hpage} data-auth-theme={theme === "light" ? "light" : undefined}>

        {/* ── NAV ── */}
        <nav className={styles.nav} ref={navRef}>
  <a className={styles.navLogo} href="/">
    <BrandMark className={styles.navLogoMark} />
    Menú<span> Digital App</span>
  </a>
 
  {/* Links — ocultos en mobile, sin cambios en desktop */}
  <ul className={styles.navLinks}>
  <li><a href="#how">Cómo funciona</a></li>
  <li><a href="#features">Funciones</a></li>
  <li><a href="#plans">Precios</a></li>
  <li><a href="#faq">Preguntas</a></li>
  <li><a href="#about">Quiénes somos</a></li>
</ul>
 
  {/* Actions — ocultos en mobile, sin cambios en desktop */}
  <div className={styles.navActions}>
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      aria-label={themeLabel}
      title={themeLabel}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
    </button>
    <Link to="/login" className={styles.navLogin}>Iniciar sesión</Link>
    <Link to="/register" className={styles.navRegister}>Crear cuenta</Link>
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
    <a
  href="#faq"
  className={styles.mobileLink}
  onClick={() => setMenuOpen(false)}
>
  Preguntas frecuentes
</a>
    <a href="#about" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
      Quiénes somos
    </a>
    <button
      type="button"
      className={`${styles.mobileLink} ${styles.mobileThemeToggle}`}
      onClick={() => { toggleTheme(); setMenuOpen(false); }}
    >
      {theme === "dark" ? <Sun /> : <Moon />}
      {theme === "dark" ? "Tema claro" : "Tema oscuro"}
    </button>
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
              {/* <div className={`${styles.heroTag} ${visible ? styles.vis : ""}`}>
                🇦🇷 Hecho para gastronomía argentina
              </div> */}
              <h1 className={`${styles.heroH1} ${visible ? styles.vis : ""}`}>
                Menú digital QR<br />
                para <em>restaurantes</em>,<br />
                bares y cafeterías.
              </h1>
              <p className={`${styles.heroSub} ${visible ? styles.vis : ""}`}>
                Creá la carta digital de tu negocio en minutos. Actualizá productos,
                precios, ofertas y disponibilidad, y compartí tu menú con un código QR
                desde cualquier celular — sin apps ni descargas.
              </p>
              <div className={`${styles.heroBtns} ${visible ? styles.vis : ""}`}>
                <button
                  className={styles.btnPrimary}
                  onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
                >
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
        <div className={styles.stats}>
          {[
            { n: "QR", l: "acceso directo desde la mesa" },
            { n: "24/7", l: "tu carta disponible online" },
            { n: "Sin app", l: "se abre desde el navegador" },
            { n: "En vivo", l: "precios y productos actualizados" },
          ].map((s) => (
            <div className={styles.stat} key={s.n}>
              <div className={styles.statN}>{s.n}</div>
              <div className={styles.statL}>{s.l}</div>
            </div>
          ))}
        </div>

{/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

        {/* ── HOW IT WORKS ── */}
        <section className={styles.how} id="how">
          <div className={styles.sectionInner}>
            <div className={styles.reveal}>
              {/* <div className={styles.eyebrow}>¿Cómo funciona?</div> */}
              <h2 className={styles.sectionH2}>
                De cero a menú publicado<br />en <em>tres pasos.</em>
              </h2>
            </div>
            <div className={styles.steps}>
              {STEPS.map((s, i) => (
                <div className={`${styles.step} ${styles.reveal}`} key={i} data-hover>
                  <div className={styles.stepNum}>{s.n}</div>
                  <s.icon className={styles.stepIcon} />
                  <div className={styles.stepTitle}>{s.title}</div>
                  <div className={styles.stepDesc}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

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
              {/* <div className={styles.eyebrow}>Funcionalidades</div> */}
              <h2 className={styles.sectionH2}>
                Todo lo que necesitás.<br /><em>Nada que sobre.</em>
              </h2>
            </div>
            <div className={styles.featGrid}>
              {FEATURES.map((f, i) => (
                <div className={`${styles.featCard} ${styles.reveal}`} key={i} data-hover>
                  <f.icon className={styles.featIcon} />
                  <div className={styles.featTitle}>{f.title}</div>
                  <div className={styles.featDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

{/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />


            {/* ── SEO CONTENT ── */}
            <section className={styles.seoSection} id="menu-digital-qr">
              <div className={styles.sectionInner}>
                <div className={styles.seoIntro}>
                  <div className={styles.reveal}>
                    <h2 className={styles.sectionH2}>
                      ¿Qué es un menú digital QR<br />
                      y por qué usarlo en tu <em>restaurante?</em>
                    </h2>
                  </div>

                  <div className={`${styles.seoText} ${styles.reveal}`}>
                    <p>
                      Un <strong>menú digital QR</strong> reemplaza o complementa la carta
                      impresa de un restaurante, bar o cafetería con una versión online
                      que los clientes pueden abrir directamente desde su celular.
                      Solo tienen que escanear un código QR ubicado en la mesa, la barra,
                      la vidriera o cualquier otro punto del local.
                    </p>

                    <p>
                      Con Menú Digital App podés crear una{" "}
                      <strong>carta digital para tu restaurante</strong> y modificar
                      productos, precios, fotografías, ofertas y disponibilidad sin tener
                      que imprimir nuevamente el menú cada vez que algo cambia.
                    </p>

                    <p>
                      El cliente no necesita descargar ninguna aplicación ni registrarse.
                      Escanea el QR con la cámara del celular y accede inmediatamente a la
                      carta actualizada desde el navegador.
                    </p>
                  </div>
                </div>

                <div className={styles.seoGrid}>
                  <article className={`${styles.seoCard} ${styles.reveal}`}>
                    <h3>Actualizá precios sin reimprimir</h3>
                    <p>
                      Si cambia el precio de un producto, editás la carta desde tu panel
                      y el cambio aparece automáticamente en el menú que ya utilizan tus
                      clientes. El código QR sigue siendo el mismo.
                    </p>
                  </article>

                  <article className={`${styles.seoCard} ${styles.reveal}`}>
                    <h3>Mostrá solo lo que tenés disponible</h3>
                    <p>
                      Podés ocultar temporalmente productos agotados, destacar platos,
                      organizar categorías y publicar ofertas sin eliminar información
                      que después quieras volver a utilizar.
                    </p>
                  </article>

                  <article className={`${styles.seoCard} ${styles.reveal}`}>
                    <h3>Una carta pensada para celulares</h3>
                    <p>
                      El menú se consulta directamente desde el navegador y está diseñado
                      para que los clientes puedan recorrer categorías, productos,
                      fotografías y precios cómodamente desde el teléfono.
                    </p>
                  </article>

                  <article className={`${styles.seoCard} ${styles.reveal}`}>
                    <h3>Para restaurantes, bares y cafeterías</h3>
                    <p>
                      Podés usar Menú Digital App para cartas gastronómicas de distintos
                      tamaños, desde una cafetería con pocos productos hasta restaurantes
                      con múltiples secciones, categorías y variantes.
                    </p>
                  </article>
                </div>

                <div className={`${styles.seoCta} ${styles.reveal}`}>
                  <h3>Creá tu menú digital QR</h3>

                  <p>
                    Empezá con tu carta online, cargá tus productos y compartila con tus
                    clientes mediante un código QR.
                  </p>

                  <Link className={styles.btnPrimary} to="/register?plan=free">
                    Crear mi menú digital →
                  </Link>
                </div>
              </div>
            </section>

            {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />


        {/* ── PLANS ── */}
        <section className={styles.pricing} id="plans">
          <div className={styles.pricingInner}>
            <div className={`${styles.pricingHeader} ${styles.reveal}`}>
              {/* <div className={styles.eyebrow}>Planes y precios</div> */}
              <h2 className={styles.sectionH2}>
                Elegí cómo empezar.<br /><em>Sin sorpresas.</em>
              </h2>
              <p className={styles.pricingSub}>
                Todos incluyen tu menú digital. Podés cambiar de plan cuando quieras.
              </p>
            </div>

            {catalog.isPending && <Spinner label="Cargando planes" />}
            {catalog.isError && <div role="alert"><p>No se pudieron cargar los planes.</p><button className={styles.planCta} onClick={() => void catalog.refetch()} disabled={catalog.isFetching}>Reintentar</button></div>}
            <div className={styles.plansGrid}>
              {!catalog.isError && catalog.data?.map((plan) => (
                <article
                  key={plan.name}
                  className={`${styles.planCard} ${(plan.name === "pro") ? styles.highlightCard : ""} ${styles.revealed}`}
                  data-hover
                >
                  {plan.name === "pro" && <div className={styles.planBadge}>Pro</div>}
                  <div className={styles.planName}>{plan.label}</div>
                  <div className={styles.planPrice}>
                    <span>$</span>{plan.effectivePrice.toLocaleString("es-AR")}
                  </div>
                  <div className={styles.planPeriod}>{plan.name === "free" ? "Sin cargo" : "ARS / mes base"}</div>
                  <ul className={styles.planFeat}>
                    {getPlanFeatureLabels(plan.features).map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  <Link className={styles.planCta} to={`/register?plan=${plan.name}`}>
                    {plan.name === "free" ? "Crear cuenta" : "Pagar y crear cuenta"} →
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

        {/* ── QR DEMO ── */}
<section className={styles.qrSection}>
  <div className={styles.qrInner}>
    <div className={styles.reveal}>
      <QRFrame>
        <img
          src={QR_REGISTER_SRC}
          alt="Código QR para crear tu cuenta en Menú Digital App"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </QRFrame>
    </div>
    <div className={styles.reveal}>
      {/* <div className={styles.eyebrow}>Sin complicaciones</div> */}
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
      <Link className={styles.btnPrimary} to="/register?plan=free">
        Quiero mi QR gratis →
      </Link>
    </div>
  </div>
</section>

        {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />


                  {/* ── FAQ ── */}
          <section className={styles.faqSection} id="faq">
            <div className={styles.faqInner}>
              <div className={`${styles.faqHeader} ${styles.reveal}`}>
                <h2 className={styles.sectionH2}>
                  Preguntas frecuentes sobre<br />
                  <em>menús digitales QR.</em>
                </h2>

                <p className={styles.faqIntro}>
                  Todo lo que necesitás saber antes de crear la carta digital de tu
                  restaurante, bar o cafetería.
                </p>
              </div>

              <div className={styles.faqList}>
                {FAQS.map((faq) => (
                  <details
                    key={faq.question}
                    className={`${styles.faqItem} ${styles.reveal}`}
                  >
                    <summary>{faq.question}</summary>

                    <div className={styles.faqAnswer}>
                      <p>{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </section>


          {/* ── AMBER LINE ── */}
        <div className={styles.amberLine} />

        
        {/* ── ABOUT ── */}
        <section className={styles.about} id="about">
          <div className={styles.aboutInner}>
            <div className={`${styles.aboutText} ${styles.reveal}`}>
              {/* <div className={styles.eyebrow}>Quiénes somos</div> */}
              <h2 className={styles.sectionH2}>
                Construido por gente<br /><em>que ama la gastronomía.</em>
              </h2>
              <p className={styles.aboutP}>
                Somos un equipo argentino que creció entre mesas, cocinas y cartas laminadas. Sabemos lo que cuesta imprimir el menú cada vez que cambia un precio, y la cara que pone el mozo cuando el cliente pide algo que ya no hay.
              </p>
              <p className={styles.aboutP}>
                Menú Digital App nació para resolver eso: una herramienta simple, pensada para dueños de locales reales, no para técnicos. Si podés mandar un WhatsApp, podés manejar tu menú digital.
              </p>
              {/* <div className={styles.aboutPills}>
                <span className={styles.pill}>🇦🇷 100% argentino</span>
                <span className={styles.pill}>💬 Soporte en español</span>
                <span className={styles.pill}>🔒 Datos seguros</span>
              </div> */}
            </div>
            <div className={styles.aboutVisual}>
              {ABOUT_CARDS.map((c, i) => (
                <div className={`${styles.aboutCard} ${styles.reveal}`} key={i} data-hover>
                  <c.icon className={styles.aboutCardIcon} />
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
              onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ver planes y precios →
            </button>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className={styles.footer}>
          <div className={styles.footInner}>
            <div className={styles.footLogo}>
              <BrandMark className={styles.footLogoMark} />
              <span>Menú Digital App</span>
            </div>
            <div className={styles.footLinks}>
              <Link to="/terminos">Términos</Link>
              <Link to="/privacidad">Privacidad</Link>
              <Link to="/contacto">Contacto</Link>
              <Link to="/contacto">Soporte</Link>
              <Link to="/arrepentimiento">Botón de Arrepentimiento</Link>
              <Link to="/baja">Botón de Baja de Servicio</Link>
            </div>
            <div className={styles.footCopy}>© 2026 Menú Digital App. Hecho en Argentina 🇦🇷</div>
          </div>
        </footer>

        <ContactFab />

      </div>
    </>
  );
}
