import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://www.menudigitalapp.com.ar";

type SeoConfig = {
  title: string;
  description: string;
  robots: string;
  canonical?: string;
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

  // En páginas noindex no necesitamos canonical
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
  // ─────────────────────────────────────────────
  // HOME
  // ─────────────────────────────────────────────

  if (pathname === "/") {
    return {
        title: "Menú Digital | Menú Digital App",
        description:
          "Consultá negocios y menús digitales en Menú Digital App.",
        robots: "noindex, follow",
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
  // LOGIN / REGISTRO
  // NO QUEREMOS QUE APAREZCAN EN GOOGLE
  // ─────────────────────────────────────────────

  if (pathname === "/login") {
    return {
      title: "Iniciar sesión | Menú Digital App",
      description: "Ingresá a tu cuenta de Menú Digital App.",
      robots: "noindex, follow",
    };
  }

  if (
    pathname === "/register" ||
    pathname === "/register/plans" ||
    pathname === "/register/success"
  ) {
    return {
      title: "Crear cuenta | Menú Digital App",
      description: "Creá tu cuenta en Menú Digital App.",
      robots: "noindex, follow",
    };
  }

  if (pathname === "/verificar-email") {
    return {
      title: "Verificar email | Menú Digital App",
      description: "Verificá tu correo electrónico.",
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
      description: "Panel interno de administración.",
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
      description: "Panel privado de vendedores.",
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
      description: "Panel privado de Menú Digital App.",
      robots: "noindex, nofollow",
    };
  }

  // ─────────────────────────────────────────────
  // TENANTS PÚBLICOS
  //
  // /mi-restaurante
  // /mi-restaurante/menu
  //
  // Más adelante les pondremos SEO dinámico.
  // ─────────────────────────────────────────────

  return {
    title: "Menú Digital | Menú Digital App",
    description:
      "Consultá este negocio y su menú digital en Menú Digital App.",
    robots: "index, follow",
    canonical: `${SITE_URL}${pathname}`,
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
  }, [pathname]);

  return null;
}