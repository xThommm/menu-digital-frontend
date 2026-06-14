import { useEffect } from "react";
import { Link } from "react-router-dom";
import styles from "./Legal.module.css";

export default function Privacy() {
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
            Privacidad y<br />
            <em>Cookies</em>
          </h1>
          <p className={styles.subtitle}>
            Última actualización: junio de 2026
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.container}>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>1. Responsable del tratamiento</h2>
            <p>
              <strong>MenuDigitalApp</strong>, con domicilio en la Ciudad Autónoma de Buenos Aires,
              República Argentina, es responsable del tratamiento de los datos personales que recopilamos
              a través de la Plataforma. Podés contactarnos en{" "}
              <a href="mailto:menudigitalapp@gmail.com" className={styles.link}>
                menudigitalapp@gmail.com
              </a>
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>2. Datos que recopilamos</h2>
            <p>Recopilamos los siguientes tipos de datos:</p>
            <ul className={styles.list}>
              <li>
                <strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña al registrarte.
              </li>
              <li>
                <strong>Datos del local:</strong> nombre del establecimiento, dirección, logo e información
                del menú que cargás voluntariamente.
              </li>
              <li>
                <strong>Datos de pago:</strong> procesados íntegramente por MercadoPago. No almacenamos
                datos de tarjetas ni información financiera sensible.
              </li>
              <li>
                <strong>Datos de uso:</strong> estadísticas de visitas a tu menú digital (cantidad de
                escaneos, dispositivos, horarios), disponibles según tu plan.
              </li>
              <li>
                <strong>Datos técnicos:</strong> dirección IP, tipo de navegador y sistema operativo,
                recopilados automáticamente para garantizar el correcto funcionamiento del servicio.
              </li>
            </ul>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>3. Finalidad del tratamiento</h2>
            <p>Usamos tus datos para:</p>
            <ul className={styles.list}>
              <li>Prestar y mejorar el servicio contratado</li>
              <li>Gestionar tu cuenta y procesar pagos</li>
              <li>Enviarte notificaciones relacionadas con tu suscripción</li>
              <li>Brindarte soporte técnico</li>
              <li>Cumplir obligaciones legales vigentes en Argentina</li>
            </ul>
            <p>
              No utilizamos tus datos para publicidad de terceros ni los vendemos bajo ninguna circunstancia.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>4. Política de cookies</h2>
            <p>
              Utilizamos cookies y tecnologías similares para mejorar tu experiencia. A continuación
              describimos los tipos que usamos:
            </p>

            <div className={styles.cookieTable}>
              <div className={styles.cookieRow + " " + styles.cookieHeader}>
                <span>Tipo</span>
                <span>Finalidad</span>
                <span>Duración</span>
              </div>
              <div className={styles.cookieRow}>
                <span><strong>Esenciales</strong></span>
                <span>Sesión de usuario, seguridad y funcionamiento básico de la Plataforma</span>
                <span>Sesión</span>
              </div>
              <div className={styles.cookieRow}>
                <span><strong>Funcionales</strong></span>
                <span>Recordar preferencias de configuración y último plan seleccionado</span>
                <span>30 días</span>
              </div>
              <div className={styles.cookieRow}>
                <span><strong>Analíticas</strong></span>
                <span>Estadísticas de uso agregadas y anónimas para mejorar el servicio</span>
                <span>90 días</span>
              </div>
            </div>

            <p>
              Podés desactivar las cookies no esenciales desde la configuración de tu navegador. Ten en
              cuenta que esto puede afectar algunas funcionalidades de la Plataforma.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>5. Compartición de datos</h2>
            <p>
              No compartimos tus datos personales con terceros salvo en los siguientes casos:
            </p>
            <ul className={styles.list}>
              <li>
                <strong>MercadoPago:</strong> exclusivamente para procesar pagos de suscripciones.
              </li>
              <li>
                <strong>Proveedores de infraestructura:</strong> servicios de hosting y almacenamiento
                que operan bajo estrictos acuerdos de confidencialidad.
              </li>
              <li>
                <strong>Obligaciones legales:</strong> cuando sea requerido por autoridad competente
                conforme a la legislación argentina.
              </li>
            </ul>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>6. Tus derechos</h2>
            <p>
              De acuerdo con la Ley N° 25.326 de Protección de Datos Personales de la República
              Argentina, tenés derecho a:
            </p>
            <ul className={styles.list}>
              <li>Acceder a tus datos personales en cualquier momento</li>
              <li>Rectificar datos incorrectos o incompletos</li>
              <li>Solicitar la supresión de tus datos</li>
              <li>Oponerte al tratamiento de tus datos con fines comerciales</li>
            </ul>
            <p>
              Para ejercer cualquiera de estos derechos, escribinos a{" "}
              <a href="mailto:menudigitalapp@gmail.com" className={styles.link}>
                menudigitalapp@gmail.com
              </a>{" "}
              indicando tu solicitud. Responderemos en un plazo máximo de 5 días hábiles.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>7. Seguridad</h2>
            <p>
              Implementamos medidas técnicas y organizativas para proteger tus datos contra accesos
              no autorizados, pérdida o alteración. Toda la información se transmite mediante
              conexiones cifradas (HTTPS) y los datos sensibles se almacenan encriptados.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>8. Retención de datos</h2>
            <p>
              Conservamos tus datos mientras tu cuenta esté activa. Ante la cancelación, los datos
              se eliminan en un plazo de 30 días, salvo obligación legal de conservarlos por un
              período mayor.
            </p>
          </section>

          <div className={styles.divider} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>9. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta política periódicamente. Te notificaremos los cambios relevantes
              por correo electrónico con al menos 10 días de anticipación.
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
