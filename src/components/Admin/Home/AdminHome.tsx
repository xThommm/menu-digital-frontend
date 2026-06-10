import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import styles from "./AdminHome.module.css";

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

  const handlePay = async (plan: Plan) => {
  console.log(plan);

  setPaying(true);

  await new Promise((r) => setTimeout(r, 1800));

  setPaying(false);
  setBillingOpen(false);

  navigate("/admin");
};

  const openBilling = (plan?: Plan) => {
    setSelectedPlan(plan || PLANS[1]);
    setBillingOpen(true);
  };

  return (
    <>
      <div className={styles.hpage}>

        {/* NAV */}
        <nav className={styles.nav}>
          <a className={styles.navLogo} href="/">Menú<span>Digital</span></a>
          <div className={styles.navActions}>
            <Link to="/register" className={styles.navRegister}>Crear cuenta</Link>
            <button className={styles.navCta} onClick={() => openBilling()}>Ver precios</button>
          </div>
        </nav>

        {/* HERO */}
        <section className={styles.hero} ref={heroRef}>
          <div className={styles.heroInner}>
            <div>
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
              <div className={styles.mockPhone}>
                <div className={styles.mockScreen}>
                  <div className={styles.mockBar} />
                  <div className={styles.mockBiz}>La Pérgola Café</div>
                  <div className={styles.mockLoc}>📍 Palermo, CABA</div>
                  <div className={styles.mockSection}>Pizzas</div>
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
                  <div className={styles.mockSection} style={{ marginTop: 20 }}>Bebidas</div>
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
          </div>
        </section>

        {/* STATS */}
        <div className={styles.stats}>
          {[
            { n: "+500", l: "locales activos" },
            { n: "+80K", l: "consultas por mes" },
            { n: "2 min", l: "para publicar tu menú" },
            { n: "100%", l: "desde el celular" },
          ].map((s, i) => (
            <div className={styles.stat} key={i}>
              <div className={styles.statN}>{s.n}</div>
              <div className={styles.statL}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <section className={styles.how} id="how">
          <div className={styles.sectionTag}>¿Cómo funciona?</div>
          <h2 className={styles.sectionH2}>De cero a menú publicado<br />en tres pasos.</h2>
          <div className={styles.steps}>
            {[
              { icon: "🧾", title: "Elegís tu plan", desc: "Seleccionás el plan que mejor se ajusta a tu negocio. Sin contratos, sin letras chicas. Podés cancelar cuando quieras.", n: "1" },
              { icon: "🍽️", title: "Cargás tu menú", desc: "Usás nuestra interfaz sencilla o subís un Excel con todos tus productos de una. Agregás fotos, precios y categorías.", n: "2" },
              { icon: "📲", title: "Tus clientes lo ven", desc: "Tu menú queda disponible en menudigital.com.ar/tu-local. Lo compartís por WhatsApp, Instagram o imprimís el QR.", n: "3" },
            ].map((s, i) => (
              <div className={styles.step} key={i}>
                <div className={styles.stepNum}>{s.n}</div>
                <div className={styles.stepIcon}>{s.icon}</div>
                <div className={styles.stepTitle}>{s.title}</div>
                <div className={styles.stepDesc}>{s.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className={styles.features}>
          <div className={styles.featuresInner}>
            <div className={styles.sectionTag}>Funcionalidades</div>
            <h2 className={styles.sectionH2}>Todo lo que necesitás.<br />Nada que sobre.</h2>
            <div className={styles.featGrid}>
              {[
                { icon: "⚡", title: "Actualizaciones instantáneas", desc: "Cambiá precios, ocultá platos agotados o agregá el especial del día. Se actualiza en tiempo real para todos tus clientes." },
                { icon: "📊", title: "Carga masiva por Excel", desc: "¿Tenés 80 productos? Completá la plantilla y subila. El sistema detecta qué cambió y te muestra un resumen antes de confirmar." },
                { icon: "🎨", title: "Diseño a tu imagen", desc: "Elegí entre múltiples templates y personalizá con el logo y los colores de tu local. Tu menú, tu identidad." },
                { icon: "🗂️", title: "Secciones y categorías", desc: "Organizá tu menú como más te guste: secciones generales, categorías, extras y destacados. La estructura que necesite tu negocio." },
                { icon: "🕐", title: "Ofertas programadas", desc: "Configurá un precio de oferta con fechas de inicio y fin. Se activa y desactiva solo, sin que tengas que acordarte." },
                { icon: "📱", title: "Funciona en cualquier celular", desc: "Sin descargas, sin apps. Tus clientes entran desde el navegador y ven el menú al instante, desde cualquier dispositivo." },
              ].map((f, i) => (
                <div className={styles.featCard} key={i}>
                  <div className={styles.featIcon}>{f.icon}</div>
                  <div className={styles.featTitle}>{f.title}</div>
                  <div className={styles.featDesc}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REVIEWS */}
        <section className={styles.reviews}>
          <div className={styles.sectionTag}>Reseñas</div>
          <h2 className={styles.sectionH2}>Lo que dicen los locales<br />que ya lo usan.</h2>
          <div className={styles.revGrid}>
            {REVIEWS.map((r, i) => (
              <div className={styles.revCard} key={i}>
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
        </section>

        {/* ABOUT */}
        <section className={styles.about}>
          <div className={styles.aboutInner}>
            <div className={styles.aboutText}>
              <div className={styles.sectionTag}>Quiénes somos</div>
              <h2 className={styles.sectionH2}>Construido por gente<br />que ama la gastronomía.</h2>
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
                <div className={styles.aboutCard} key={i}>
                  <div className={styles.aboutCardIcon}>{c.icon}</div>
                  <div className={styles.aboutCardTitle}>{c.title}</div>
                  <div className={styles.aboutCardDesc}>{c.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className={styles.finalCta}>
          <h2>Tu menú digital,<br /><em>hoy mismo.</em></h2>
          <p>Sin contratos. Sin instalaciones. Listo en minutos.</p>
          <button
            className={styles.btnPrimary}
            style={{ fontSize: 18, padding: "18px 48px" }}
            onClick={() => openBilling()}
          >
            Ver planes y precios →
          </button>
        </section>

      </div>

      {/* BILLING POPUP */}
      {billingOpen && (
        <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && setBillingOpen(false)}>
          <div className={styles.billing}>
            <div className={styles.billingHeader}>
              <div>
                <div className={styles.billingTitle}>Elegí tu plan</div>
                <div className={styles.billingSub}>Todos incluyen menú digital completo. Cancelás cuando quieras.</div>
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
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                    Plan {selectedPlan?.name} · {selectedPlan?.period}
                  </div>
                </div>
                <div className={styles.billingAmount}>
                  ${selectedPlan?.price.toLocaleString("es-AR")}
                </div>
              </div>
              <button
                className={styles.payBtn}
                disabled={paying}
                onClick={() => selectedPlan && handlePay(selectedPlan)}
              >
                {paying ? (
                  <><div className={styles.spinner} /> Procesando pago...</>
                ) : (
                  <>Pagar con MercadoPago →</>
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