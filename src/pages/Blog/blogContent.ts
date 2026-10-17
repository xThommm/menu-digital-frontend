export const BLOG_PATH = "/blog";

export const MENU_QR_GUIDE = {
  path: "/blog/que-es-un-menu-digital-qr",
  title: "Qué es un menú digital QR y cómo funciona",
  description:
    "Conocé cómo funciona un menú digital QR, en qué se diferencia de un PDF y cómo actualizar la carta de tu restaurante sin cambiar el código.",
  excerpt:
    "Conocé cómo lo consultan tus clientes, qué necesitás para empezar y cómo actualizar tu carta sin cambiar el QR.",
};

export const BLOG_META = {
  title: "Guías y preguntas sobre menús digitales QR | Menú Digital App",
  description:
    "Guías y respuestas para crear y administrar la carta digital de tu restaurante, bar o cafetería. Aprendé a compartir tu menú y mantenerlo actualizado.",
};

// Todas las preguntas frecuentes viven acá (la landing solo enlaza a
// /blog#preguntas). RouteSeo arma el FAQPage del blog desde BLOG_FAQS, así
// el dato estructurado no se desincroniza del texto visible.
export const BLOG_FAQ_GROUPS = [
  {
    title: "La carta QR",
    items: [
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
        question: "¿Mis clientes necesitan descargar una aplicación?",
        answer:
          "No. Pueden abrir la carta desde el navegador del celular, sin instalar una aplicación ni crear una cuenta.",
      },
      {
        question: "¿Necesitan conexión a internet?",
        answer:
          "Sí. Necesitan conexión para abrir la carta y consultar su contenido actualizado.",
      },
      {
        question: "¿Tengo que cambiar el QR cuando actualizo los precios?",
        answer:
          "No, mientras mantengas el mismo enlace del menú. Podés modificar productos, precios, ofertas y disponibilidad sin volver a imprimir el código. Si cambiás la dirección de tu carta, revisá y reemplazá los QR que apunten a la anterior.",
      },
      {
        question: "¿Puedo usar el mismo QR en todas las mesas?",
        answer:
          "Sí. Podés imprimir el mismo código QR y colocarlo en distintas mesas, en la barra o en la puerta.",
      },
      {
        question: "¿Puedo compartir la carta sin usar el QR?",
        answer:
          "Sí. Podés enviar el enlace por WhatsApp o publicarlo en tus redes sociales.",
      },
      {
        question: "¿Puedo cargar muchos productos de una sola vez?",
        answer:
          "Según el plan disponible, podés utilizar la carga masiva mediante Excel para incorporar o actualizar una gran cantidad de productos de forma más rápida.",
      },
    ],
  },
  {
    title: "Pedidos y cobros",
    items: [
      {
        question: "¿Puedo recibir pedidos por WhatsApp?",
        answer:
          "Sí. Tus clientes arman el pedido desde la carta y lo envían por WhatsApp a tu negocio, eligiendo delivery o take away según las modalidades que ofrezcas. No cobramos comisión por pedido.",
      },
      {
        question: "¿Puedo recibir pedidos desde la mesa?",
        answer:
          "Sí, con el plan Pro. Imprimís un QR general o uno por mesa: el cliente pide desde el celular y el pedido entra a tu panel y a la pantalla del sector que lo prepara. Tus mozos también pueden tomar pedidos desde su celular.",
      },
      {
        question: "¿Puedo cobrar los pedidos de delivery y take away online?",
        answer:
          "Sí, con el plan Pro conectás tu propia cuenta de Mercado Pago y el cliente paga desde la carta. La plata va directo a tu cuenta: Menú Digital App no cobra comisión, solo aplican las tarifas de Mercado Pago.",
      },
    ],
  },
  {
    title: "Reservas y tu local",
    items: [
      {
        question: "¿Mis clientes pueden reservar mesa online?",
        answer:
          "Sí, con el plan Pro tu página suma el botón «Reservar mesa». El cliente completa el formulario, recibe un código y ve en vivo cuando confirmás su reserva. Vos las manejás desde el panel y, si el horario no está disponible, podés proponerle otro.",
      },
      {
        question: "¿Sirve para cafeterías y bares además de restaurantes?",
        answer:
          "Sí. Menú Digital App está pensado para restaurantes, cafeterías, bares, rotiserías y otros negocios gastronómicos que necesiten publicar y actualizar su carta online.",
      },
    ],
  },
];

export const BLOG_FAQS = BLOG_FAQ_GROUPS.flatMap((group) => group.items);
