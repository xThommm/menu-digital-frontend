import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Legal.module.css";

export default function Terms() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <Link to="/" className={styles.navLogo}>
          Menú<span> Digital</span>
        </Link>
        <Link to="/" className={styles.navBack}>
          ← Volver al inicio
        </Link>
      </nav>

      <div className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroGrid} />
        <div className={styles.heroContent}>
          <div className={styles.eyebrow}>Legal</div>
          <h1 className={styles.title}>
            Términos y<br />
            <em>Condiciones</em>
          </h1>
          <p className={styles.subtitle}>
            Última actualización: junio de 2026
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.container}>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Aceptación de los términos</h2>
            <p>
              Al acceder o utilizar los servicios de <strong>MenuDigitalApp</strong> (en adelante "la Plataforma"),
              con domicilio en la Ciudad Autónoma de Buenos Aires, República Argentina, aceptás en forma plena
              y sin reservas estos Términos y Condiciones. Si no estás de acuerdo con alguna de estas
              disposiciones, te pedimos que no utilices la Plataforma.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Descripción del servicio</h2>
            <p>
              MenuDigitalApp es una plataforma digital que permite a propietarios de establecimientos
              gastronómicos crear, gestionar y publicar menús digitales accesibles mediante código QR.
              Los servicios incluyen, pero no se limitan a:
            </p>
            <ul className={styles.list}>
              <li>Creación y gestión de menús digitales ilimitados</li>
              <li>Generación de códigos QR personalizados</li>
              <li>Carga masiva de productos mediante archivos Excel</li>
              <li>Landing page personalizada del local</li>
              <li>Estadísticas de visitas (planes Semestral y Anual)</li>
              <li>Dominio personalizado (plan Anual)</li>
            </ul>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Registro y cuenta</h2>
            <p>
              Para acceder a la Plataforma, debés crear una cuenta con información veraz, completa y
              actualizada. Sos responsable de mantener la confidencialidad de tus credenciales de acceso
              y de todas las actividades que ocurran bajo tu cuenta.
            </p>
            <p>
              MenuDigitalApp se reserva el derecho de suspender o cancelar cuentas que incumplan estos
              términos, contengan información falsa o sean utilizadas de manera fraudulenta.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Planes y pagos</h2>
            <p>
              La Plataforma ofrece tres planes de suscripción: Mensual, Semestral y Anual. Los precios
              están expresados en pesos argentinos (ARS) e incluyen IVA cuando corresponda.
            </p>
            <p>
              Los pagos se procesan a través de <strong>MercadoPago</strong>. Al completar el pago,
              aceptás también los términos y condiciones de dicho procesador. MenuDigitalApp no almacena
              datos de tarjetas de crédito ni información financiera sensible.
            </p>
            <p>
              Podés cancelar tu suscripción en cualquier momento. La cancelación tendrá efecto al
              finalizar el período pago vigente, sin reembolso proporcional por el tiempo no utilizado.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Uso aceptable</h2>
            <p>Al usar la Plataforma, te comprometés a no:</p>
            <ul className={styles.list}>
              <li>Publicar contenido falso, engañoso, ilegal u ofensivo</li>
              <li>Intentar acceder sin autorización a otros cuentas o sistemas</li>
              <li>Usar la Plataforma para fines distintos a la gestión de menús gastronómicos</li>
              <li>Reproducir, copiar o redistribuir el software sin autorización expresa</li>
              <li>Realizar ingeniería inversa o intentar extraer el código fuente</li>
            </ul>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Propiedad intelectual</h2>
            <p>
              Todo el contenido de la Plataforma —incluyendo diseño, código, textos, logos y marca—
              es propiedad exclusiva de MenuDigitalApp y está protegido por las leyes de propiedad
              intelectual de la República Argentina y tratados internacionales aplicables.
            </p>
            <p>
              El contenido que cargás en tu menú (imágenes, descripciones, precios) es de tu propiedad.
              Al subirlo, nos otorgás una licencia no exclusiva para mostrarlo en la Plataforma con el
              único fin de prestar el servicio contratado.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Limitación de responsabilidad</h2>
            <p>
              MenuDigitalApp no garantiza la disponibilidad ininterrumpida del servicio, aunque se
              compromete a mantener una disponibilidad razonable. En ningún caso seremos responsables
              por daños indirectos, pérdida de ganancias o perjuicios derivados del uso o imposibilidad
              de uso de la Plataforma.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Modificaciones</h2>
            <p>
              Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento.
              Los cambios serán notificados por correo electrónico con al menos 15 días de anticipación.
              El uso continuado de la Plataforma luego de dicho plazo implica la aceptación de los nuevos términos.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Jurisdicción y ley aplicable</h2>
            <p>
              Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier
              controversia, las partes se someten a la jurisdicción de los Tribunales Ordinarios
              de la Ciudad Autónoma de Buenos Aires, con renuncia expresa a cualquier otro fuero
              que pudiera corresponder.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>10. Contacto</h2>
            <p>
              Para consultas sobre estos Términos y Condiciones, podés escribirnos a{" "}
              <a href="mailto:menudigitalapp@gmail.com" className={styles.link}>
                menudigitalapp@gmail.com
              </a>
            </p>
          </section>

        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span className={styles.footLogo}>Menú Digital</span>
          <div className={styles.footLinks}>
            <Link to="/terminos">Términos</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/contacto">Contacto</Link>
          </div>
          <span className={styles.footCopy}>© 2026 MenuDigitalApp. Hecho en Argentina 🇦🇷</span>
        </div>
      </footer>
    </div>
  );
}
