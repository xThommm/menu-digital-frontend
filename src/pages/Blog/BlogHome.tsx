import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import BlogLayout from "./BlogLayout";
import { BLOG_FAQS, MENU_QR_GUIDE } from "./blogContent";
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
          <div className={styles.guideIcon} aria-hidden="true"><BookOpen size={38} /></div>
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
          <h2 id="preguntas-titulo">Antes de crear tu carta</h2>
          <p>Las dudas más comunes sobre cómo compartir y consultar un menú digital QR.</p>
          <Link className={styles.textLink} to="/contacto">Contactanos si te quedó una duda <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
        <div className={styles.faqList}>
          {BLOG_FAQS.map((faq) => (
            <details key={faq.question} className={styles.faqItem}>
              <summary>{faq.question}<ChevronDown size={20} aria-hidden="true" /></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </BlogLayout>
  );
}
