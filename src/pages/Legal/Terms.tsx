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
            Última actualización: agosto de 2026
          </p>
        </div>
      </div>

      <main className={styles.main}>
        <div className={styles.container}>

          <section className={styles.section}>
  <h2 className={styles.sectionTitle}>1. Aceptación de los términos</h2>
  <p>
    Al acceder o utilizar los servicios de <strong>MenuDigitalApp</strong> (en adelante, "la Plataforma"),
    con domicilio en la Ciudad Autónoma de Buenos Aires, República Argentina, aceptás en forma plena
    y sin reservas estos Términos y Condiciones. Si no estás de acuerdo con alguna de estas
    disposiciones, te pedimos que no utilices la Plataforma.
  </p>
  <p>
    El uso de la Plataforma implica la aceptación de estos Términos y Condiciones, que constituyen
    un contrato de adhesión en los términos de la Ley N° 24.240 de Defensa del Consumidor y del
    Código Civil y Comercial de la Nación.
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
    <li>Creación y gestión de menús digitales, con límites según el plan elegido</li>
    <li>Generación de códigos QR personalizados</li>
    <li>Landing page personalizada del local</li>
    <li>Pedidos por WhatsApp, sin procesamiento del pedido dentro de la Plataforma</li>
    <li>Herramientas adicionales según las funciones informadas para cada plan en el flujo de contratación</li>
  </ul>
  <p>
    La Plataforma actúa únicamente como herramienta de visualización y gestión de menús.
    No interviene en la relación comercial entre el establecimiento y sus clientes finales,
    ni procesa pedidos, cobros ni entregas.
  </p>
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
    El Usuario declara ser mayor de 18 años o contar con la capacidad legal suficiente para
    contratar y utilizar los servicios ofrecidos por la Plataforma.
  </p>
  <p>
    MenuDigitalApp podrá suspender o cancelar cuentas, con o sin previo aviso, cuando detecte
    actividades que comprometan la seguridad de la Plataforma, incumplan estos Términos y
    Condiciones o constituyan un uso fraudulento, abusivo o contrario a la legislación aplicable.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>4. Planes, precios y pagos</h2>
  <p>
    La Plataforma ofrece tres planes: <strong>Gratis, Básico y Pro</strong>. El plan Gratis no
    requiere pago y permite crear una cuenta con las funciones y límites informados en el flujo
    de registro. Los planes Básico y Pro se adquieren mediante un pago anticipado por un período
    de 1, 3, 6 o 12 meses.
  </p>
  <p>
    Antes de pagar, la Plataforma muestra el plan seleccionado, la duración, el precio mensual
    de referencia, el total a pagar y, cuando corresponda, el ahorro aplicado por elegir un
    período de varios meses. Los precios se expresan en pesos argentinos (ARS) e incluyen los
    impuestos que correspondan, según lo informado en el flujo de compra. Las funciones, límites,
    precios y descuentos aplicables son los que se muestran en ese flujo al momento de confirmar
    la compra.
  </p>
  <p>
    Los pagos se procesan a través de <strong>Mercado Pago</strong>. Al completar el pago,
    aceptás también los términos y condiciones de dicho procesador. MenuDigitalApp no almacena
    datos de tarjetas de crédito ni información financiera sensible. La vigencia del plan
    comienza cuando Mercado Pago aprueba el pago. En una renovación del mismo plan, los meses
    adquiridos se suman a la vigencia existente.
  </p>
  <p>
    La compra de un período no implica renovación automática. Al finalizar la vigencia del plan
    pago, la cuenta pasa al plan Gratis salvo que el Usuario realice una nueva compra. La mera
    falta de uso de la Plataforma no cancela ni extiende el período adquirido.
  </p>
  <p>
    Algunos servicios de la Plataforma dependen de proveedores externos, incluyendo procesadores
    de pago, registradores de dominios y servicios de infraestructura tecnológica. MenuDigitalApp
    no será responsable por interrupciones, modificaciones o fallas atribuibles a dichos terceros.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>5. Derecho de arrepentimiento y baja del servicio</h2>
  <p>
    De conformidad con el artículo 34 de la Ley N° 24.240 de Defensa del Consumidor y el
    artículo 1110 del Código Civil y Comercial de la Nación, el Usuario tiene derecho a
    revocar la aceptación de la contratación de un plan pago dentro de los diez (10) días
    corridos contados desde la fecha de celebración del contrato (aprobación del pago), sin
    necesidad de justificar el motivo y sin costo alguno.
  </p>
  <p>
    Este derecho se ejerce a través del Botón de Arrepentimiento disponible en la Plataforma,
    o enviando un correo a{" "}
    <a href="mailto:menudigitalappsoporte@gmail.com" className={styles.link}>
      menudigitalappsoporte@gmail.com
    </a>
    . Una vez ejercido el derecho de arrepentimiento dentro del plazo legal, MenuDigitalApp
    reembolsará el monto abonado en un plazo razonable, a través del mismo medio de pago utilizado.
  </p>
  <p>
    El derecho de arrepentimiento no aplica cuando el servicio ya haya sido utilizado de manera
    significativa (por ejemplo, publicación activa del menú digital y generación de códigos QR
    en producción), conforme a las excepciones previstas en el artículo 1116 del Código Civil
    y Comercial de la Nación.
  </p>
  <p>
    Asimismo, el Usuario puede solicitar la baja del servicio en cualquier momento a través del
    Botón de Baja de Servicio o por correo electrónico. La baja no genera reembolso por el
    período ya abonado, salvo ejercicio válido del derecho de arrepentimiento.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>6. Uso aceptable</h2>
  <p>Al usar la Plataforma, te comprometés a no:</p>
  <ul className={styles.list}>
    <li>Publicar contenido falso, engañoso, ilegal u ofensivo</li>
    <li>Intentar acceder sin autorización a otras cuentas o sistemas</li>
    <li>Usar la Plataforma para fines distintos a la gestión de menús gastronómicos</li>
    <li>Reproducir, copiar o redistribuir el software sin autorización expresa</li>
    <li>Realizar ingeniería inversa o intentar extraer el código fuente</li>
  </ul>
  <p>
    El Usuario es el único responsable de la información publicada en sus menús digitales,
    incluyendo precios, descripciones, promociones, ingredientes, imágenes, información
    nutricional y cualquier otro contenido cargado en la Plataforma.
  </p>
  <p>
    MenuDigitalApp no verifica ni garantiza la exactitud, legalidad, integridad o actualización
    del contenido publicado por los Usuarios. El Usuario mantiene indemne a MenuDigitalApp
    frente a reclamos de terceros derivados del contenido que publique.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>7. Propiedad intelectual</h2>
  <p>
    Todo el contenido de la Plataforma —incluyendo diseño, código, textos, logos y marca—
    es propiedad exclusiva de MenuDigitalApp y está protegido por las leyes de propiedad
    intelectual de la República Argentina y tratados internacionales aplicables.
  </p>
  <p>
    El contenido que cargás en tu menú (imágenes, descripciones, precios) es de tu propiedad.
    Al subirlo, nos otorgás una licencia no exclusiva, gratuita y limitada para mostrarlo en
    la Plataforma con el único fin de prestar el servicio contratado.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>8. Disponibilidad del servicio</h2>
  <p>
    MenuDigitalApp realiza esfuerzos razonables para mantener la disponibilidad continua de
    la Plataforma. Sin embargo, el servicio podrá verse afectado por tareas de mantenimiento,
    actualizaciones, mejoras técnicas o circunstancias ajenas a nuestro control.
  </p>
  <p>
    La Plataforma podrá ser suspendida temporalmente cuando resulte necesario para preservar
    la seguridad, estabilidad o correcto funcionamiento de los sistemas. En la medida de lo
    posible, se informará con anticipación.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>9. Respaldo y conservación de datos</h2>
  <p>
    Aunque MenuDigitalApp implementa medidas razonables para proteger la información
    almacenada, no garantiza la recuperación de datos eliminados por el Usuario ni la
    ausencia total de pérdidas ocasionadas por fallas técnicas, errores humanos, ataques
    informáticos, eventos de fuerza mayor o problemas en servicios de terceros.
  </p>
  <p>
    El Usuario es responsable de conservar copias de seguridad de la información que
    considere crítica para su actividad comercial.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>10. Limitación de responsabilidad</h2>
  <p>
    MenuDigitalApp no garantiza que la Plataforma opere de manera ininterrumpida, libre de
    errores o completamente exenta de incidentes técnicos.
  </p>
  <p>
    En la máxima medida permitida por la legislación aplicable, MenuDigitalApp no será
    responsable por daños indirectos, lucro cesante, pérdida de ingresos, pérdida de datos,
    pérdida de oportunidades comerciales o cualquier otro perjuicio derivado del uso o
    imposibilidad de uso de la Plataforma, salvo dolo o culpa grave.
  </p>
  <p>
    Nada de lo dispuesto en estos Términos limita o excluye los derechos irrenunciables que
    la Ley de Defensa del Consumidor reconoce al Usuario.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>11. Fuerza mayor</h2>
  <p>
    MenuDigitalApp no será responsable por incumplimientos o interrupciones del servicio
    ocasionados por hechos fuera de su control razonable, incluyendo, entre otros, desastres
    naturales, cortes de energía, fallas de internet, ataques informáticos masivos, conflictos
    laborales, decisiones gubernamentales o fallas de proveedores externos.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>12. Modificaciones</h2>
  <p>
    MenuDigitalApp podrá modificar estos Términos y Condiciones para adaptarlos a cambios
    normativos, operativos o comerciales.
  </p>
  <p>
    Las modificaciones serán comunicadas por los medios que la Plataforma considere
    apropiados, incluyendo correo electrónico o notificaciones dentro del sistema, y
    entrarán en vigencia a partir de la fecha indicada en la comunicación.
  </p>
  <p>
    Cada versión de estos Términos y Condiciones estará identificada mediante una fecha.
    En determinados casos podrá requerirse la aceptación expresa de una nueva versión para
    continuar utilizando la Plataforma o acceder a determinadas funcionalidades.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>13. Jurisdicción y ley aplicable</h2>
  <p>
    Estos Términos se rigen por las leyes de la República Argentina, en particular la Ley
    N° 24.240 de Defensa del Consumidor y el Código Civil y Comercial de la Nación.
  </p>
  <p>
    Ante cualquier controversia, las partes se someten a la jurisdicción de los tribunales
    ordinarios de la Ciudad Autónoma de Buenos Aires o, a opción del consumidor, a los
    tribunales del domicilio real del Usuario al momento de iniciar la acción, conforme a
    la legislación de defensa del consumidor.
  </p>
</section>

<div className={styles.divider} />

<section className={styles.section}>
  <h2 className={styles.sectionTitle}>14. Contacto y reclamos</h2>
  <p>
    Para consultas, reclamos o ejercicio de derechos relacionados con estos Términos y
    Condiciones, podés escribirnos a{" "}
    <a href="mailto:menudigitalappsoporte@gmail.com" className={styles.link}>
      menudigitalappsoporte@gmail.com
    </a>
    .
  </p>
  <p>
    También podés presentar reclamos ante la Dirección Nacional de Defensa del Consumidor
    o las autoridades de defensa del consumidor de tu jurisdicción, a través de los canales
    oficiales disponibles.
  </p>
</section>

<div className={styles.divider} />

        </div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footInner}>
          <span className={styles.footLogo}>Menú Digital</span>
          <div className={styles.footLinks}>
            <Link to="/terminos">Términos</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/contacto">Contacto</Link>
            <Link to="/arrepentimiento">Botón de Arrepentimiento</Link>
            <Link to="/baja">Botón de Baja de Servicio</Link>
          </div>
          <span className={styles.footCopy}>© 2026 MenuDigitalApp. Hecho en Argentina 🇦🇷</span>
        </div>
      </footer>
    </div>
  );
}
