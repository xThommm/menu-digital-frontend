import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  highlight: boolean;
  features: string[];
  badge?: string;
}

// ─────────────────────────────────────────────
// DATOS
// ─────────────────────────────────────────────
const PLANS: Plan[] = [
  {
    id: "mensual",
    name: "Mensual",
    price: 4999,
    period: "por mes",
    highlight: false,
    features: [
      "Menú digital ilimitado",
      "Landing page del local",
      "Carga masiva por Excel",
      "Soporte por WhatsApp",
    ],
  },
  {
    id: "semestral",
    name: "Semestral",
    price: 24999,
    period: "cada 6 meses",
    highlight: true,
    badge: "Más elegido",
    features: [
      "Todo lo del plan mensual",
      "2 meses gratis",
      "Estadísticas de visitas",
      "Prioridad en soporte",
    ],
  },
  {
    id: "anual",
    name: "Anual",
    price: 39999,
    period: "por año",
    highlight: false,
    features: [
      "Todo lo del plan semestral",
      "4 meses gratis",
      "Dominio personalizado",
      "Onboarding personalizado",
    ],
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
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();
  const [billingOpen, setBillingOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paying, setPaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Simula el proceso de pago y redirige al login
  const handlePay = async (plan: Plan) => {
    setPaying(true);
    await new Promise((r) => setTimeout(r, 1800));
    setPaying(false);
    setBillingOpen(false);
    navigate("/register");
  };

  const openBilling = (plan?: Plan) => {
    setSelectedPlan(plan || PLANS[1]);
    setBillingOpen(true);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --cream:   #f5dbdb;
          --warm:    #F0E8D8;
          --brown:   #3D2B1F;
          --amber:   #C8842A;
          --amber-l: #E8A84A;
          --green:   #2D4A3E;
          --green-l: #3D6B5A;
          --muted:   #8A7060;
          --white:   #FFFFFF;
          --shadow:  rgba(61,43,31,0.12);
        }

        .hpage {
          font-family: 'DM Sans', sans-serif;
          background: var(--cream);
          color: var(--brown);
          overflow-x: hidden;
        }

        /* ── NAV ── */
        .nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 48px;
          background: rgba(250,247,242,0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(61,43,31,0.08);
        }
        .nav-logo {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 700;
          color: var(--brown); text-decoration: none;
          letter-spacing: -0.5px;
        }
        .nav-logo span { color: var(--amber); }
        .nav-cta {
          background: var(--brown); color: var(--cream);
          border: none; border-radius: 8px;
          padding: 10px 24px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 500; cursor: pointer;
          transition: background 0.2s;
        }
        .nav-cta:hover { background: var(--amber); }

        /* ── HERO ── */
        .hero {
          min-height: 100vh;
          display: flex; align-items: center;
          padding: 120px 48px 80px;
          position: relative; overflow: hidden;
        }
        .hero::before {
          content: '';
          position: absolute; top: -200px; right: -200px;
          width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(200,132,42,0.15) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero::after {
          content: '';
          position: absolute; bottom: -100px; left: -100px;
          width: 400px; height: 400px; border-radius: 50%;
          background: radial-gradient(circle, rgba(45,74,62,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        .hero-inner {
          max-width: 1200px; margin: 0 auto; width: 100%;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
        }
        .hero-tag {
          display: inline-block;
          background: var(--warm); border: 1px solid rgba(200,132,42,0.3);
          color: var(--amber); font-size: 12px; font-weight: 500;
          padding: 6px 16px; border-radius: 100px; letter-spacing: 0.08em;
          text-transform: uppercase; margin-bottom: 28px;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.6s 0.1s, transform 0.6s 0.1s;
        }
        .hero-tag.vis { opacity: 1; transform: translateY(0); }
        .hero-h1 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(42px, 5vw, 68px);
          font-weight: 900; line-height: 1.05;
          letter-spacing: -2px; margin-bottom: 24px;
          opacity: 0; transform: translateY(30px);
          transition: opacity 0.7s 0.2s, transform 0.7s 0.2s;
        }
        .hero-h1.vis { opacity: 1; transform: translateY(0); }
        .hero-h1 em { color: var(--amber); font-style: normal; }
        .hero-sub {
          font-size: 18px; line-height: 1.65; color: var(--muted);
          max-width: 480px; margin-bottom: 40px;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s 0.35s, transform 0.7s 0.35s;
        }
        .hero-sub.vis { opacity: 1; transform: translateY(0); }
        .hero-btns {
          display: flex; gap: 16px; flex-wrap: wrap;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s 0.5s, transform 0.7s 0.5s;
        }
        .hero-btns.vis { opacity: 1; transform: translateY(0); }
        .btn-primary {
          background: var(--amber); color: var(--white);
          border: none; border-radius: 10px;
          padding: 16px 36px; font-family: 'DM Sans', sans-serif;
          font-size: 16px; font-weight: 500; cursor: pointer;
          transition: background 0.2s, transform 0.15s;
        }
        .btn-primary:hover { background: var(--amber-l); transform: translateY(-2px); }
        .btn-secondary {
          background: transparent; color: var(--brown);
          border: 1.5px solid rgba(61,43,31,0.25); border-radius: 10px;
          padding: 16px 36px; font-family: 'DM Sans', sans-serif;
          font-size: 16px; font-weight: 500; cursor: pointer;
          transition: border-color 0.2s, transform 0.15s;
        }
        .btn-secondary:hover { border-color: var(--brown); transform: translateY(-2px); }

        /* Hero visual */
        .hero-visual {
          opacity: 0; transform: translateX(40px);
          transition: opacity 0.9s 0.4s, transform 0.9s 0.4s;
        }
        .hero-visual.vis { opacity: 1; transform: translateX(0); }
        .mock-phone {
          width: 260px; margin: 0 auto;
          background: var(--brown); border-radius: 36px;
          padding: 12px; box-shadow: 0 40px 80px rgba(61,43,31,0.35);
          position: relative;
        }
        .mock-screen {
          background: var(--cream); border-radius: 26px;
          overflow: hidden; padding: 20px 16px;
          min-height: 480px;
        }
        .mock-bar { width: 60px; height: 4px; background: var(--brown); border-radius: 2px; margin: 0 auto 20px; }
        .mock-biz { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 4px; }
        .mock-loc { font-size: 11px; color: var(--muted); text-align: center; margin-bottom: 20px; }
        .mock-section { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--amber); margin-bottom: 10px; }
        .mock-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 0; border-bottom: 1px solid rgba(61,43,31,0.08);
        }
        .mock-item-name { font-size: 12px; font-weight: 500; }
        .mock-item-desc { font-size: 10px; color: var(--muted); margin-top: 2px; }
        .mock-item-price { font-size: 13px; font-weight: 600; color: var(--amber); white-space: nowrap; }
        .mock-badge {
          display: inline-block; background: rgba(200,132,42,0.12);
          color: var(--amber); font-size: 9px; font-weight: 600;
          padding: 2px 8px; border-radius: 100px; margin-top: 4px;
        }

        /* ── STATS ── */
        .stats {
          background: var(--brown); padding: 60px 48px;
          display: flex; justify-content: center; gap: 80px; flex-wrap: wrap;
        }
        .stat { text-align: center; color: var(--cream); }
        .stat-n {
          font-family: 'Playfair Display', serif;
          font-size: 48px; font-weight: 900; color: var(--amber-l);
          line-height: 1;
        }
        .stat-l { font-size: 14px; color: rgba(250,247,242,0.6); margin-top: 6px; }

        /* ── HOW IT WORKS ── */
        .how { padding: 100px 48px; max-width: 1200px; margin: 0 auto; }
        .section-tag {
          font-size: 11px; font-weight: 600; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--amber); margin-bottom: 16px;
        }
        .section-h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 4vw, 48px); font-weight: 800;
          line-height: 1.1; letter-spacing: -1px; margin-bottom: 64px;
        }
        .steps { display: grid; grid-template-columns: repeat(3,1fr); gap: 40px; }
        .step {
          background: var(--white); border-radius: 16px;
          padding: 36px 32px; border: 1px solid rgba(61,43,31,0.08);
          position: relative; overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .step:hover { transform: translateY(-6px); box-shadow: 0 20px 40px var(--shadow); }
        .step-num {
          font-family: 'Playfair Display', serif;
          font-size: 80px; font-weight: 900;
          color: rgba(200,132,42,0.1); position: absolute;
          top: -10px; right: 20px; line-height: 1;
        }
        .step-icon { font-size: 32px; margin-bottom: 20px; }
        .step-title { font-size: 18px; font-weight: 600; margin-bottom: 10px; }
        .step-desc { font-size: 14px; color: var(--muted); line-height: 1.65; }

        /* ── FEATURES ── */
        .features {
          background: var(--green); padding: 100px 48px;
          color: var(--cream);
        }
        .features-inner { max-width: 1200px; margin: 0 auto; }
        .features .section-tag { color: var(--amber-l); }
        .features .section-h2 { color: var(--cream); }
        .feat-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 24px; }
        .feat-card {
          background: rgba(250,247,242,0.06); border: 1px solid rgba(250,247,242,0.1);
          border-radius: 14px; padding: 28px;
          transition: background 0.25s;
        }
        .feat-card:hover { background: rgba(250,247,242,0.1); }
        .feat-icon { font-size: 28px; margin-bottom: 14px; }
        .feat-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: var(--cream); }
        .feat-desc { font-size: 14px; color: rgba(250,247,242,0.6); line-height: 1.6; }

        /* ── REVIEWS ── */
        .reviews { padding: 100px 48px; max-width: 1200px; margin: 0 auto; }
        .rev-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 24px; }
        .rev-card {
          background: var(--white); border-radius: 16px;
          padding: 32px; border: 1px solid rgba(61,43,31,0.08);
          transition: transform 0.25s;
        }
        .rev-card:hover { transform: translateY(-4px); }
        .rev-stars { color: var(--amber); font-size: 16px; margin-bottom: 16px; }
        .rev-text { font-size: 15px; line-height: 1.7; color: var(--brown); margin-bottom: 24px; font-style: italic; }
        .rev-footer { display: flex; align-items: center; gap: 14px; }
        .rev-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: var(--amber); color: var(--white);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700;
          flex-shrink: 0;
        }
        .rev-name { font-size: 14px; font-weight: 600; }
        .rev-biz { font-size: 12px; color: var(--muted); margin-top: 2px; }

        /* ── WHO WE ARE ── */
        .about {
          background: var(--warm); padding: 100px 48px;
        }
        .about-inner {
          max-width: 1200px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center;
        }
        .about-text .section-h2 { margin-bottom: 24px; }
        .about-p { font-size: 16px; color: var(--muted); line-height: 1.75; margin-bottom: 16px; }
        .about-pills { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 32px; }
        .pill {
          background: var(--white); border: 1px solid rgba(61,43,31,0.12);
          border-radius: 100px; padding: 8px 20px;
          font-size: 13px; font-weight: 500; color: var(--brown);
        }
        .about-visual {
          display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
        }
        .about-card {
          background: var(--white); border-radius: 14px; padding: 28px 24px;
          border: 1px solid rgba(61,43,31,0.08);
        }
        .about-card-icon { font-size: 28px; margin-bottom: 12px; }
        .about-card-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; }
        .about-card-desc { font-size: 13px; color: var(--muted); line-height: 1.55; }

        /* ── FINAL CTA ── */
        .final-cta {
          background: var(--brown); padding: 100px 48px; text-align: center;
        }
        .final-cta h2 {
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 5vw, 60px); font-weight: 900;
          color: var(--cream); letter-spacing: -2px; line-height: 1.05;
          margin-bottom: 20px;
        }
        .final-cta h2 em { color: var(--amber-l); font-style: normal; }
        .final-cta p { font-size: 18px; color: rgba(250,247,242,0.6); margin-bottom: 40px; }

        /* ── BILLING OVERLAY ── */
        .overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(30,20,10,0.7); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          animation: fadeIn 0.2s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .billing {
          background: var(--cream); border-radius: 24px;
          width: 100%; max-width: 860px; max-height: 90vh; overflow-y: auto;
          padding: 48px;
          animation: slideUp 0.3s ease;
        }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .billing-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 36px;
        }
        .billing-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 800; letter-spacing: -1px;
        }
        .billing-sub { font-size: 15px; color: var(--muted); margin-top: 6px; }
        .close-btn {
          background: rgba(61,43,31,0.08); border: none;
          width: 36px; height: 36px; border-radius: 50%;
          cursor: pointer; font-size: 18px; display: flex;
          align-items: center; justify-content: center;
          flex-shrink: 0; transition: background 0.2s;
        }
        .close-btn:hover { background: rgba(61,43,31,0.16); }
        .plans-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 16px; margin-bottom: 32px; }
        .plan-card {
          border: 2px solid rgba(61,43,31,0.12); border-radius: 16px;
          padding: 24px 20px; cursor: pointer; position: relative;
          transition: border-color 0.2s, transform 0.15s;
        }
        .plan-card:hover { transform: translateY(-3px); }
        .plan-card.selected { border-color: var(--amber); background: rgba(200,132,42,0.04); }
        .plan-card.highlight-card { background: var(--brown); border-color: var(--brown); color: var(--cream); }
        .plan-card.highlight-card.selected { border-color: var(--amber-l); }
        .plan-badge {
          position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
          background: var(--amber); color: var(--white);
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 4px 14px; border-radius: 100px;
          white-space: nowrap;
        }
        .plan-name { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
        .plan-price {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 800; line-height: 1;
        }
        .plan-price span { font-size: 16px; font-family: 'DM Sans', sans-serif; font-weight: 400; }
        .plan-period { font-size: 11px; color: var(--muted); margin: 4px 0 16px; }
        .plan-card.highlight-card .plan-period { color: rgba(250,247,242,0.5); }
        .plan-feat { font-size: 12px; color: var(--muted); line-height: 1.8; }
        .plan-card.highlight-card .plan-feat { color: rgba(250,247,242,0.7); }
        .plan-feat li { list-style: none; padding-left: 16px; position: relative; }
        .plan-feat li::before { content: '✓'; position: absolute; left: 0; color: var(--amber); font-weight: 700; }
        .plan-card.highlight-card .plan-feat li::before { color: var(--amber-l); }
        .billing-footer { border-top: 1px solid rgba(61,43,31,0.1); padding-top: 28px; }
        .billing-summary {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
        }
        .billing-total { font-size: 15px; color: var(--muted); }
        .billing-amount {
          font-family: 'Playfair Display', serif;
          font-size: 28px; font-weight: 800; color: var(--brown);
        }
        .pay-btn {
          width: 100%; background: var(--amber); color: var(--white);
          border: none; border-radius: 12px; padding: 18px;
          font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600;
          cursor: pointer; transition: background 0.2s, transform 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 10px;
        }
        .pay-btn:hover:not(:disabled) { background: var(--amber-l); transform: translateY(-2px); }
        .pay-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .pay-safe { text-align: center; font-size: 12px; color: var(--muted); margin-top: 12px; }

        /* Spinner */
        .spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .nav { padding: 16px 24px; }
          .hero { padding: 100px 24px 60px; }
          .hero-inner { grid-template-columns: 1fr; gap: 48px; }
          .mock-phone { width: 220px; }
          .stats { padding: 48px 24px; gap: 40px; }
          .how, .reviews, .about-inner { padding: 60px 24px; }
          .how { padding: 60px 24px; }
          .steps, .rev-grid, .feat-grid { grid-template-columns: 1fr; }
          .about-inner { grid-template-columns: 1fr; }
          .about-visual { display: none; }
          .features { padding: 60px 24px; }
          .final-cta { padding: 60px 24px; }
          .billing { padding: 28px 20px; }
          .plans-grid { grid-template-columns: 1fr; }
          .billing-title { font-size: 24px; }
        }
      `}</style>

      <div className="hpage">

        {/* NAV */}
        <nav className="nav">
          <a className="nav-logo" href="/">Menú<span>Digital</span></a>
          <button className="nav-cta" onClick={() => openBilling()}>Ver precios</button>
        </nav>

        {/* HERO */}
        <section className="hero" ref={heroRef}>
          <div className="hero-inner">
            <div>
              <div className={`hero-tag ${visible ? "vis" : ""}`}>🇦🇷 Hecho para gastronomía argentina</div>
              <h1 className={`hero-h1 ${visible ? "vis" : ""}`}>
                Tu menú,<br />en el <em>celular</em><br />de tus clientes.
              </h1>
              <p className={`hero-sub ${visible ? "vis" : ""}`}>
                Creá tu menú digital en minutos. Actualizá precios, ocultá platos agotados y dejá que tus clientes lo vean desde cualquier dispositivo — sin descargar nada.
              </p>
              <div className={`hero-btns ${visible ? "vis" : ""}`}>
                <button className="btn-primary" onClick={() => openBilling()}>
                  Empezar ahora →
                </button>
                <button className="btn-secondary" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
                  ¿Cómo funciona?
                </button>
              </div>
            </div>
            <div className={`hero-visual ${visible ? "vis" : ""}`}>
              <div className="mock-phone">
                <div className="mock-screen">
                  <div className="mock-bar" />
                  <div className="mock-biz">La Pérgola Café</div>
                  <div className="mock-loc">📍 Palermo, CABA</div>
                  <div className="mock-section">Pizzas</div>
                  {[
                    { name: "Napolitana", desc: "Tomate y mozzarella", price: "$2.800", badge: "⭐ Destacada" },
                    { name: "Fugazza", desc: "Cebolla y mozzarella", price: "$2.600" },
                    { name: "Especial", desc: "Ingredientes de estación", price: "$3.200" },
                  ].map((item, i) => (
                    <div className="mock-item" key={i}>
                      <div>
                        <div className="mock-item-name">{item.name}</div>
                        <div className="mock-item-desc">{item.desc}</div>
                        {item.badge && <div className="mock-badge">{item.badge}</div>}
                      </div>
                      <div className="mock-item-price">{item.price}</div>
                    </div>
                  ))}
                  <div className="mock-section" style={{ marginTop: 20 }}>Bebidas</div>
                  {[
                    { name: "Agua mineral", desc: "500ml", price: "$800" },
                    { name: "Gaseosa", desc: "Lata 354ml", price: "$950" },
                  ].map((item, i) => (
                    <div className="mock-item" key={i}>
                      <div>
                        <div className="mock-item-name">{item.name}</div>
                        <div className="mock-item-desc">{item.desc}</div>
                      </div>
                      <div className="mock-item-price">{item.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}
        <div className="stats">
          {[
            { n: "+500", l: "locales activos" },
            { n: "+80K", l: "consultas por mes" },
            { n: "2 min", l: "para publicar tu menú" },
            { n: "100%", l: "desde el celular" },
          ].map((s, i) => (
            <div className="stat" key={i}>
              <div className="stat-n">{s.n}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <section className="how" id="how">
          <div className="section-tag">¿Cómo funciona?</div>
          <h2 className="section-h2">De cero a menú publicado<br />en tres pasos.</h2>
          <div className="steps">
            {[
              { icon: "🧾", title: "Elegís tu plan", desc: "Seleccionás el plan que mejor se ajusta a tu negocio. Sin contratos, sin letras chicas. Podés cancelar cuando quieras.", n: "1" },
              { icon: "🍽️", title: "Cargás tu menú", desc: "Usás nuestra interfaz sencilla o subís un Excel con todos tus productos de una. Agregás fotos, precios y categorías.", n: "2" },
              { icon: "📲", title: "Tus clientes lo ven", desc: "Tu menú queda disponible en menudigital.com.ar/tu-local. Lo compartís por WhatsApp, Instagram o imprimís el QR.", n: "3" },
            ].map((s, i) => (
              <div className="step" key={i}>
                <div className="step-num">{s.n}</div>
                <div className="step-icon">{s.icon}</div>
                <div className="step-title">{s.title}</div>
                <div className="step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="features">
          <div className="features-inner">
            <div className="section-tag">Funcionalidades</div>
            <h2 className="section-h2">Todo lo que necesitás.<br />Nada que sobre.</h2>
            <div className="feat-grid">
              {[
                { icon: "⚡", title: "Actualizaciones instantáneas", desc: "Cambiá precios, ocultá platos agotados o agregá el especial del día. Se actualiza en tiempo real para todos tus clientes." },
                { icon: "📊", title: "Carga masiva por Excel", desc: "¿Tenés 80 productos? Completá la plantilla y subila. El sistema detecta qué cambió y te muestra un resumen antes de confirmar." },
                { icon: "🎨", title: "Diseño a tu imagen", desc: "Elegí entre múltiples templates y personalizá con el logo y los colores de tu local. Tu menú, tu identidad." },
                { icon: "🗂️", title: "Secciones y categorías", desc: "Organizá tu menú como más te guste: secciones generales, categorías, extras y destacados. La estructura que necesite tu negocio." },
                { icon: "🕐", title: "Ofertas programadas", desc: "Configurá un precio de oferta con fechas de inicio y fin. Se activa y desactiva solo, sin que tengas que acordarte." },
                { icon: "📱", title: "Funciona en cualquier celular", desc: "Sin descargas, sin apps. Tus clientes entran desde el navegador y ven el menú al instante, desde cualquier dispositivo." },
              ].map((f, i) => (
                <div className="feat-card" key={i}>
                  <div className="feat-icon">{f.icon}</div>
                  <div className="feat-title">{f.title}</div>
                  <div className="feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REVIEWS */}
        <section className="reviews">
          <div className="section-tag">Reseñas</div>
          <h2 className="section-h2">Lo que dicen los locales<br />que ya lo usan.</h2>
          <div className="rev-grid">
            {REVIEWS.map((r, i) => (
              <div className="rev-card" key={i}>
                <div className="rev-stars">{"★".repeat(r.stars)}</div>
                <p className="rev-text">"{r.text}"</p>
                <div className="rev-footer">
                  <div className="rev-avatar">{r.initial}</div>
                  <div>
                    <div className="rev-name">{r.name}</div>
                    <div className="rev-biz">{r.business} · {r.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ABOUT */}
        <section className="about">
          <div className="about-inner">
            <div className="about-text">
              <div className="section-tag">Quiénes somos</div>
              <h2 className="section-h2">Construido por gente<br />que ama la gastronomía.</h2>
              <p className="about-p">
                Somos un equipo argentino que creció entre mesas, cocinas y cartas laminadas. Sabemos lo que cuesta imprimir el menú cada vez que cambia un precio, y la cara que pone el mozo cuando el cliente pide algo que ya no hay.
              </p>
              <p className="about-p">
                Menú Digital nació para resolver eso: una herramienta simple, pensada para dueños de locales reales, no para técnicos. Si podés mandar un WhatsApp, podés manejar tu menú digital.
              </p>
              <div className="about-pills">
                <span className="pill">🇦🇷 100% argentino</span>
                <span className="pill">💬 Soporte en español</span>
                <span className="pill">🔒 Datos seguros</span>
              </div>
            </div>
            <div className="about-visual">
              {[
                { icon: "🤝", title: "Soporte real", desc: "Respondemos por WhatsApp. Sin tickets, sin esperas de 48hs." },
                { icon: "📈", title: "Siempre mejorando", desc: "Escuchamos a nuestros clientes y lanzamos mejoras cada mes." },
                { icon: "🔒", title: "Tus datos, seguros", desc: "Información encriptada y respaldada todos los días." },
                { icon: "💰", title: "Sin sorpresas", desc: "Precio fijo mensual. Sin comisiones por venta ni costos ocultos." },
              ].map((c, i) => (
                <div className="about-card" key={i}>
                  <div className="about-card-icon">{c.icon}</div>
                  <div className="about-card-title">{c.title}</div>
                  <div className="about-card-desc">{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta">
          <h2>Tu menú digital,<br /><em>hoy mismo.</em></h2>
          <p>Sin contratos. Sin instalaciones. Listo en minutos.</p>
          <button className="btn-primary" style={{ fontSize: 18, padding: "18px 48px" }} onClick={() => openBilling()}>
            Ver planes y precios →
          </button>
        </section>

      </div>

      {/* BILLING POPUP */}
      {billingOpen && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setBillingOpen(false)}>
          <div className="billing">
            <div className="billing-header">
              <div>
                <div className="billing-title">Elegí tu plan</div>
                <div className="billing-sub">Todos incluyen menú digital completo. Cancelás cuando quieras.</div>
              </div>
              <button className="close-btn" onClick={() => setBillingOpen(false)}>✕</button>
            </div>

            <div className="plans-grid">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`plan-card ${plan.highlight ? "highlight-card" : ""} ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                  onClick={() => setSelectedPlan(plan)}
                >
                  {plan.badge && <div className="plan-badge">{plan.badge}</div>}
                  <div className="plan-name">{plan.name}</div>
                  <div className="plan-price">
                    <span>$</span>{plan.price.toLocaleString("es-AR")}
                  </div>
                  <div className="plan-period">{plan.period}</div>
                  <ul className="plan-feat">
                    {plan.features.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>

            <div className="billing-footer">
              <div className="billing-summary">
                <div>
                  <div className="billing-total">Total a pagar</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    Plan {selectedPlan?.name} · {selectedPlan?.period}
                  </div>
                </div>
                <div className="billing-amount">
                  ${selectedPlan?.price.toLocaleString("es-AR")}
                </div>
              </div>
              <button
                className="pay-btn"
                disabled={paying}
                onClick={() => selectedPlan && handlePay(selectedPlan)}
              >
                {paying ? (
                  <><div className="spinner" /> Procesando pago...</>
                ) : (
                  <>Pagar con MercadoPago →</>
                )}
              </button>
              <div className="pay-safe">🔒 Pago seguro · Tus datos están protegidos</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}