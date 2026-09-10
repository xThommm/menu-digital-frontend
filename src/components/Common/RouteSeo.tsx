import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { BLOG_META, BLOG_PATH, MENU_QR_GUIDE } from "../../pages/Blog/blogContent";

const SITE_URL = "https://www.menudigitalapp.com.ar";

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  canonical?: string;
  socialType?: "website" | "article";
  structuredData?: Record<string, unknown>;
};

function setMeta(name: string, content: string) {
  let meta = document.querySelector(
    `meta[name="${name}"]`
  ) as HTMLMetaElement | null;

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function setCanonical(url?: string) {
  let canonical = document.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;

  // Si la página no tiene canonical, eliminamos cualquier
  // canonical que haya quedado de la ruta anterior.
  if (!url) {
    canonical?.remove();
    return;
  }

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

function getSeoConfig(pathname: string): SeoConfig {
  // React Router acepta mayúsculas y barra final: ambas variantes comparten canonical.
  const blogPath = pathname.toLowerCase().replace(/\/+$/, "");
  if (blogPath === BLOG_PATH || blogPath === MENU_QR_GUIDE.path) {
    const isArticle = blogPath === MENU_QR_GUIDE.path;
    const title = isArticle ? `${MENU_QR_GUIDE.title} | Menú Digital App` : BLOG_META.title;
    const description = isArticle ? MENU_QR_GUIDE.description : BLOG_META.description;
    const canonical = `${SITE_URL}${blogPath}`;

    return {
      title,
      description,
      canonical,
      robots: "index, follow",
      socialType: isArticle ? "article" : "website",
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": isArticle ? "Article" : "CollectionPage",
            "@id": `${canonical}#${isArticle ? "article" : "webpage"}`,
            url: canonical,
            name: isArticle ? MENU_QR_GUIDE.title : "Guías y preguntas",
            ...(isArticle ? {
              headline: MENU_QR_GUIDE.title,
              mainEntityOfPage: canonical,
              author: { "@id": `${SITE_URL}/#organization` },
            } : {}),
            description,
            inLanguage: "es-AR",
            publisher: { "@id": `${SITE_URL}/#organization` },
            isPartOf: { "@id": `${SITE_URL}/#website` },
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: `${SITE_URL}/` },
              { "@type": "ListItem", position: 2, name: "Guías y preguntas", item: `${SITE_URL}${BLOG_PATH}` },
              ...(isArticle ? [{ "@type": "ListItem", position: 3, name: MENU_QR_GUIDE.title, item: canonical }] : []),
            ],
          },
        ],
      },
    };
  }

  // ─────────────────────────────────────────────
  // HOME
  // ─────────────────────────────────────────────

  if (pathname === "/") {
    return {
      title: "Menú Digital QR para Restaurantes | Menú Digital App",
      description:
        "Creá un menú digital QR para tu restaurante, bar o cafetería. Actualizá productos, precios y ofertas al instante y compartí tu carta desde cualquier celular.",
      robots: "index, follow",
      canonical: `${SITE_URL}/`,
    };
  }

  // ─────────────────────────────────────────────
  // PÁGINAS PÚBLICAS
  // ─────────────────────────────────────────────

  if (pathname === "/terminos") {
    return {
      title: "Términos y Condiciones | Menú Digital App",
      description:
        "Consultá los términos y condiciones de uso de Menú Digital App.",
      robots: "index, follow",
      canonical: `${SITE_URL}/terminos`,
    };
  }

  if (pathname === "/privacidad") {
    return {
      title: "Política de Privacidad | Menú Digital App",
      description:
        "Consultá cómo Menú Digital App trata y protege la información de sus usuarios.",
      robots: "index, follow",
      canonical: `${SITE_URL}/privacidad`,
    };
  }

  if (pathname === "/contacto") {
    return {
      title: "Contacto | Menú Digital App",
      description:
        "Contactate con Menú Digital App para consultas, soporte o información sobre nuestros menús digitales QR.",
      robots: "index, follow",
      canonical: `${SITE_URL}/contacto`,
    };
  }

  if (pathname === "/arrepentimiento") {
    return {
      title: "Botón de Arrepentimiento | Menú Digital App",
      description:
        "Solicitá el arrepentimiento de una contratación realizada en Menú Digital App.",
      robots: "index, follow",
      canonical: `${SITE_URL}/arrepentimiento`,
    };
  }

  if (pathname === "/baja") {
    return {
      title: "Baja de Servicio | Menú Digital App",
      description:
        "Solicitá la baja de tu servicio de Menú Digital App.",
      robots: "index, follow",
      canonical: `${SITE_URL}/baja`,
    };
  }

  // ─────────────────────────────────────────────
  // LOGIN
  // ─────────────────────────────────────────────

  if (pathname === "/login") {
    return {
      title: "Iniciar sesión | Menú Digital App",
      description:
        "Ingresá a tu cuenta de Menú Digital App.",
      robots: "noindex, follow",
    };
  }

  // ─────────────────────────────────────────────
  // REGISTRO
  // ─────────────────────────────────────────────

  if (
    pathname === "/register" ||
    pathname === "/register/plans" ||
    pathname === "/register/success"
  ) {
    return {
      title: "Crear cuenta | Menú Digital App",
      description:
        "Creá tu cuenta en Menú Digital App.",
      robots: "noindex, follow",
    };
  }

  if (pathname === "/verificar-email") {
    return {
      title: "Verificar email | Menú Digital App",
      description:
        "Verificá tu correo electrónico.",
      robots: "noindex, follow",
    };
  }

  // ─────────────────────────────────────────────
  // ADMIN
  // ─────────────────────────────────────────────

  if (
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  ) {
    return {
      title: "Administración | Menú Digital App",
      description:
        "Panel interno de administración.",
      robots: "noindex, nofollow",
    };
  }

  // ─────────────────────────────────────────────
  // SELLERS
  // ─────────────────────────────────────────────

  if (
    pathname === "/sellers" ||
    pathname.startsWith("/sellers/")
  ) {
    return {
      title: "Panel de vendedor | Menú Digital App",
      description:
        "Panel privado de vendedores.",
      robots: "noindex, nofollow",
    };
  }

  // ─────────────────────────────────────────────
  // PANEL DEL CLIENTE
  // ─────────────────────────────────────────────

  if (
    pathname === "/dashboard" ||
    pathname === "/menu/editor" ||
    pathname === "/user/editor" ||
    pathname === "/estadisticas"
  ) {
    return {
      title: "Panel | Menú Digital App",
      description:
        "Panel privado de Menú Digital App.",
      robots: "noindex, nofollow",
    };
  }

  // ─────────────────────────────────────────────
  // TENANTS / RUTAS DESCONOCIDAS
  // ─────────────────────────────────────────────
  //
  // Inicialmente cualquier /:slug queda noindex.
  //
  // Si BusinessSEO comprueba que realmente existe
  // el negocio, cambia posteriormente a:
  //
  // index, follow
  // canonical real
  // title real
  // description real
  //
  // Si no existe, permanece noindex.
  // ─────────────────────────────────────────────

  return {
    title: "Menú Digital | Menú Digital App",
    description:
      "Consultá negocios y menús digitales en Menú Digital App.",
    robots: "noindex, follow",
  };
}

export default function RouteSEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const config = getSeoConfig(pathname);

    document.title = config.title;

    setMeta("description", config.description);
    setMeta("robots", config.robots);

    setCanonical(config.canonical);

    if (!config.socialType || !config.structuredData) return;

    // El blog también actualiza las vistas al compartir. Al salir, restaura
    // estas etiquetas para no dejar los datos del artículo en otra página.
    const socialTags = [
      ["property", "og:title", config.title],
      ["property", "og:description", config.description],
      ["property", "og:url", config.canonical!],
      ["property", "og:type", config.socialType],
      ["property", "og:image", `${SITE_URL}/brand/menu-digital-logo-mark.svg`],
      ["property", "og:image:alt", "Menú Digital App"],
      ["name", "twitter:title", config.title],
      ["name", "twitter:description", config.description],
      ["name", "twitter:image", `${SITE_URL}/brand/menu-digital-logo-mark.svg`],
      ["name", "twitter:image:alt", "Menú Digital App"],
    ];
    const restoreTags = socialTags.map(([attribute, name, content]) => {
      const existing = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`);
      const previous = existing?.getAttribute("content");
      const meta = existing ?? document.createElement("meta");
      meta.setAttribute(attribute, name);
      meta.setAttribute("content", content);
      if (!existing) document.head.appendChild(meta);
      return () => {
        if (!existing) meta.remove();
        else if (previous == null) meta.removeAttribute("content");
        else meta.setAttribute("content", previous);
      };
    });

    const schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.dataset.blogSeo = "true";
    schema.textContent = JSON.stringify(config.structuredData);
    document.head.appendChild(schema);

    return () => {
      schema.remove();
      restoreTags.forEach((restore) => restore());
    };
  }, [pathname]);

  return null;
}
