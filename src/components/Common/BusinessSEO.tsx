import { useEffect } from "react";
import type { ContactInfo, LandingVisibility, Media } from "../../types/index";
import { resolveLandingVisibility } from "../../lib/landingVisibility";

const SITE_URL = "https://www.menudigitalapp.com.ar";
const DEFAULT_IMAGE =
  "https://www.menudigitalapp.com.ar/brand/menu-digital-logo-512.png";

// Solo lo que este componente lee del negocio. Es estructural a propósito: le
// entra tanto el User de la landing (contacto y media completos, con
// landingVisibility) como el PublicMenuUser de la carta, que llega recortado
// (sin mail, con solo la primera imagen y sin landingVisibility).
type BusinessSEOUser = {
  contactInfo?: Partial<Pick<ContactInfo, "businessName" | "address" | "number" | "mail">>;
  media?: Partial<Media>;
  landingVisibility?: LandingVisibility;
};

type BusinessSEOProps = {
  user: BusinessSEOUser;
  slug: string;
  page: "landing" | "menu";
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

function setProperty(property: string, content: string) {
  let meta = document.querySelector(
    `meta[property="${property}"]`
  ) as HTMLMetaElement | null;

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function setCanonical(url: string) {
  let canonical = document.querySelector(
    'link[rel="canonical"]'
  ) as HTMLLinkElement | null;

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

// Cambia el favicon del sitio por el logo del local mientras se ve su landing
// o su carta. En vez de agregar un <link> nuevo se reescriben los de
// index.html: con varios rel="icon" cada navegador elige uno distinto (por
// tamaño o tipo) y podría quedarse con el de Menú Digital. Devuelve la
// función que deja los originales como estaban, para cuando se sale de la
// página del local (el resto del sitio sigue con el favicon por defecto).
function applyBusinessFavicon(url: string) {
  const links = Array.from(
    document.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"], link[rel="apple-touch-icon"]'
    )
  );

  const originals = links.map((link) => ({
    link,
    href: link.getAttribute("href"),
    type: link.getAttribute("type"),
    sizes: link.getAttribute("sizes"),
  }));

  for (const link of links) {
    link.setAttribute("href", url);
    // Cloudinary lo guarda como PNG (ver faviconStorage en el backend).
    if (link.rel === "icon") link.setAttribute("type", "image/png");
    link.removeAttribute("sizes");
  }

  return () => {
    for (const { link, href, type, sizes } of originals) {
      if (href === null) link.removeAttribute("href");
      else link.setAttribute("href", href);
      if (type === null) link.removeAttribute("type");
      else link.setAttribute("type", type);
      if (sizes === null) link.removeAttribute("sizes");
      else link.setAttribute("sizes", sizes);
    }
  };
}

export default function BusinessSEO({
  user,
  slug,
  page,
}: BusinessSEOProps) {
  const favicon = user.media?.favicon?.trim() || "";

  useEffect(() => {
    if (!favicon) return;
    return applyBusinessFavicon(favicon);
  }, [favicon]);

  useEffect(() => {
    const info = user.contactInfo;
    // Lo que el dueño ocultó de la landing tampoco va a los datos
    // estructurados (Google los indexa igual que el texto visible). La carta
    // no manda landingVisibility, así que ahí resuelve todo visible.
    const visible = resolveLandingVisibility(user.landingVisibility);

    const businessName =
      info?.businessName?.trim() || "Menú Digital";

    const address = visible.address ? info?.address?.trim() : "";

    const baseUrl = `${SITE_URL}/${slug}`;

    const canonical =
      page === "menu"
        ? `${baseUrl}/menu`
        : baseUrl;

    const title =
      page === "menu"
        ? `Menú de ${businessName} | Carta y precios`
        : `${businessName} | Menú Digital`;

    const description =
      page === "menu"
        ? `Consultá el menú de ${businessName}${
            address ? ` en ${address}` : ""
          }. Mirá productos, categorías, precios, ofertas y disponibilidad actualizada.`
        : `Conocé ${businessName}${
            address ? ` en ${address}` : ""
          }. Consultá ubicación, contacto y accedé a su menú digital online.`;

    const image =
      user.media?.backgroundPicture ||
      user.media?.pictures?.[0] ||
      DEFAULT_IMAGE;

    // SEO principal
    document.title = title;

    setMeta("description", description);
    setMeta("robots", "index, follow");

    setCanonical(canonical);

    // Open Graph
    setProperty("og:type", "website");
    setProperty("og:locale", "es_AR");
    setProperty("og:site_name", "Menú Digital App");
    setProperty("og:title", title);
    setProperty("og:description", description);
    setProperty("og:url", canonical);
    setProperty("og:image", image);

    // Twitter / X
    // El logo es cuadrado: la tarjeta grande (~2:1) lo recortaría arriba y abajo.
    setMeta("twitter:card", image === DEFAULT_IMAGE ? "summary" : "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // Schema.org
    const previousSchema = document.querySelector(
      'script[data-business-seo="true"]'
    );

    previousSchema?.remove();

    const schema = document.createElement("script");

    schema.type = "application/ld+json";
    schema.setAttribute("data-business-seo", "true");

    const structuredData =
      page === "landing"
        ? {
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            name: businessName,
            url: baseUrl,
            description,
            ...(address
              ? {
                  address: address,
                }
              : {}),
            ...(visible.phone && info?.number
              ? {
                  telephone: String(info.number),
                }
              : {}),
            ...(visible.mail && info?.mail
              ? {
                  email: info.mail,
                }
              : {}),
            ...(image
              ? {
                  image: image,
                }
              : {}),
          }
        : {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            url: canonical,
            description,
            isPartOf: {
              "@type": "WebSite",
              name: "Menú Digital App",
              url: SITE_URL,
            },
            about: {
              "@type": "LocalBusiness",
              name: businessName,
              url: baseUrl,
            },
          };

    schema.textContent = JSON.stringify(structuredData);
    document.head.appendChild(schema);

    return () => {
      schema.remove();
    };
  }, [user, slug, page]);

  return null;
}