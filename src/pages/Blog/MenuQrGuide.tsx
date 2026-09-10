import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BlogLayout from "./BlogLayout";
import { BLOG_PATH, MENU_QR_GUIDE } from "./blogContent";
import styles from "./Blog.module.css";

const SECTIONS = [
  ["que-es", "Qué es un menú digital QR"],
  ["como-funciona", "Cómo lo usa el cliente"],
  ["menu-o-pdf", "En qué se diferencia de un PDF"],
  ["que-necesitas", "Qué necesitás para empezar"],
  ["actualizar", "Cómo actualizar tu carta"],
  ["donde-colocar", "Dónde colocar el QR"],
];

export default function MenuQrGuide() {
  return (
    <BlogLayout>
      <nav className={styles.breadcrumbs} aria-label="Ruta de navegación">
        <Link to="/">Inicio</Link><span aria-hidden="true">/</span>
        <Link to={BLOG_PATH}>Guías y preguntas</Link><span aria-hidden="true">/</span>
        <span aria-current="page">Menú digital QR</span>
      </nav>

      <article>
        <header className={`${styles.hero} ${styles.articleHero}`}>
          <p className={styles.eyebrow}>Guía para empezar · Por Menú Digital App</p>
          <h1>{MENU_QR_GUIDE.title}</h1>
          <p className={styles.lead}>
            Pasar tu carta al celular empieza por algo simple: un enlace que tus
            clientes puedan abrir. Te contamos cómo funciona, qué necesitás para
            prepararlo y qué revisar antes de llevar el QR a las mesas.
          </p>
        </header>

        <div className={styles.articleLayout}>
          <nav className={styles.contents} aria-label="En esta guía">
            <p className={styles.eyebrow}>En esta guía</p>
            <ol>
              {SECTIONS.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}
            </ol>
          </nav>

          <div className={styles.prose}>
            <section id="que-es">
              <h2>Qué es un menú digital QR</h2>
              <p>
                Un menú digital es una versión online de la carta de un restaurante,
                bar o cafetería. El código QR contiene el enlace que permite abrirla:
                el cliente lo escanea con el celular y consulta los productos y precios
                desde el navegador.
              </p>
              <p>
                El QR es la puerta de entrada; la carta está en la web. Por eso también
                podés compartir el enlace por WhatsApp o en el perfil de Instagram de tu
                local. Puede complementar tu carta impresa para quienes prefieran usarla
                o no tengan conexión.
              </p>
            </section>

            <section id="como-funciona">
              <h2>Cómo lo usa el cliente</h2>
              <ol>
                <li><strong>Escanea el QR.</strong> Apunta la cámara del celular al código y toca el enlace que aparece.</li>
                <li><strong>Abre la carta.</strong> El navegador carga el menú con conexión a internet.</li>
                <li><strong>Consulta los productos.</strong> Recorre las categorías y ve los nombres, descripciones y precios que publicaste.</li>
              </ol>
              <p>
                En Menú Digital App, el cliente no necesita instalar una aplicación ni
                registrarse para consultar la carta. Si tiene dificultades para escanear,
                podés facilitarle el enlace directamente.
              </p>
            </section>

            <section id="menu-o-pdf">
              <h2>En qué se diferencia de un PDF</h2>
              <p>
                Un QR puede abrir tanto un PDF como una carta web. La diferencia está en
                el contenido al que lleva y en cómo lo mantenés actualizado.
              </p>
              <p>
                Con un PDF, normalmente editás el documento y subís una versión nueva.
                Según su diseño, el cliente puede necesitar ampliar la página para leerla
                en el teléfono. Una carta web puede adaptar la presentación al tamaño de
                la pantalla.
              </p>
              <p>
                En MenuDigital administrás los productos desde un panel: editás un precio
                o una descripción y guardás el cambio, sin reemplazar un documento entero.
                Ambos formatos pueden conservar el mismo QR si mantienen el mismo enlace.
              </p>
            </section>

            <section id="que-necesitas">
              <h2>Qué necesitás para empezar</h2>
              <ul>
                <li>Una cuenta en Menú Digital App y los datos de tu local.</li>
                <li>Los nombres y precios de los productos que querés publicar.</li>
                <li>Categorías claras, como entradas, platos principales o bebidas.</li>
                <li>Descripciones y fotografías, si querés sumar información sobre cada producto.</li>
              </ul>
              <p>
                Cargá la carta desde tu panel y revisá el resultado en el celular. Los
                límites de productos y las herramientas disponibles dependen de tu plan;
                podés consultar las opciones en la <a href="/#plans">sección de planes</a>.
                Una vez lista, compartí el enlace de tu menú o el QR que apunta a esa dirección.
              </p>
            </section>

            <section id="actualizar">
              <h2>Cómo actualizar tu carta sin cambiar el QR</h2>
              <p>
                Imaginá que cambia el precio de tu café con leche. Entrás al panel,
                buscás ese producto, modificás el precio y guardás. Al volver a abrir
                o recargar la carta, tus clientes pueden consultar el valor actualizado.
              </p>
              <p>
                No necesitás imprimir otro código por ese cambio: el QR sigue apuntando
                a la misma dirección. Antes de dar por terminada una actualización,
                abrí el menú público y comprobá que el precio se vea como esperabas.
              </p>
              <aside className={styles.note}>
                <strong>Conservá el enlace de tu carta.</strong>
                <p>
                  Cambiar el nombre del negocio puede modificar su dirección pública.
                  Si cambiás el enlace, revisá los QR impresos y los enlaces de tus redes;
                  los anteriores pueden dejar de llevar a tu menú.
                </p>
              </aside>
            </section>

            <section id="donde-colocar">
              <h2>Dónde colocar el QR y qué revisar antes de imprimir</h2>
              <p>
                Las mesas y la barra son lugares prácticos para consultar la carta al
                sentarse. En la vidriera o la entrada, el QR también permite mirar las
                opciones antes de entrar. Acompañalo con una indicación clara, como
                “Escaneá para ver nuestro menú”.
              </p>
              <ul>
                <li>Usá buen contraste y dejá espacio libre alrededor del código.</li>
                <li>Evitá superficies curvas, reflejos o elementos que tapen parte del QR.</li>
                <li>Probá una impresión desde la distancia y con la iluminación reales del lugar.</li>
                <li>Comprobá que abra la carta correcta antes de imprimir varias copias.</li>
              </ul>
              <p>
                Volvé a probarlo cuando cambies la dirección de la carta o renueves los
                carteles. Un QR legible y un menú actualizado hacen más fácil la consulta.
              </p>
            </section>

            <Link className={styles.textLink} to={BLOG_PATH}>
              <ArrowLeft size={18} aria-hidden="true" /> Volver a guías y preguntas
            </Link>
          </div>
        </div>
      </article>
    </BlogLayout>
  );
}
