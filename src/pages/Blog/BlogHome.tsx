import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown } from "lucide-react";
import BlogLayout from "./BlogLayout";
import GifClip from "../../components/Common/GifClip/GifClip";
import { BLOG_FAQ_GROUPS, MENU_QR_GUIDE } from "./blogContent";
import styles from "./Blog.module.css";

export default function BlogHome() {
  return (
    <BlogLayout>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>Guías y preguntas</p>
        <h1>Guías para crear y administrar <em>tu menú digital.</em></h1>
        <p className={styles.lead}>
          Encontrá respuestas y consejos prácticos para llevar la carta de tu
          restaurante, bar o cafetería al celular de tus clientes.
        </p>
      </div>

      <section className={styles.guides} aria-labelledby="guias-titulo">
        <div className={styles.sectionHeading}>
          <h2 id="guias-titulo">Empezá por lo esencial</h2>
          <span className={styles.kicker}>Para tu local</span>
        </div>
        <article className={styles.guideCard}>
          <GifClip
            className={styles.guideClip}
            ratio="1/1"
            alt="Vista previa de la guía: qué es un menú digital QR"
          />
          <div>
            <p className={styles.eyebrow}>Guía para empezar</p>
            <h3><Link to={MENU_QR_GUIDE.path}>{MENU_QR_GUIDE.title}</Link></h3>
            <p>{MENU_QR_GUIDE.excerpt}</p>
            <Link className={styles.textLink} to={MENU_QR_GUIDE.path}>
              Leer guía <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </section>

      <section className={styles.faqSection} id="preguntas" aria-labelledby="preguntas-titulo">
        <div>
          <p className={styles.eyebrow}>Respuestas simples</p>
          <h2 id="preguntas-titulo">Preguntas frecuentes</h2>
          <p>Las dudas más comunes sobre la carta QR, los pedidos, los cobros y las reservas de tu local.</p>
          <Link className={styles.textLink} to="/contacto">Contactanos si te quedó una duda <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div>
          {BLOG_FAQ_GROUPS.map((group) => (
            <div key={group.title} className={styles.faqGroup}>
              <h3 className={styles.faqGroupTitle}>{group.title}</h3>
              <div className={styles.faqList}>
                {group.items.map((faq) => (
                  <details key={faq.question} className={styles.faqItem}>
                    <summary>{faq.question}<ChevronDown size={20} aria-hidden="true" /></summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </BlogLayout>
  );
}
