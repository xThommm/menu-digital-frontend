import { useEffect } from "react";
import type { User } from "../../types/index";

const SITE_URL = "https://www.menudigitalapp.com.ar";
const DEFAULT_IMAGE =
  "https://www.menudigitalapp.com.ar/brand/menu-digital-logo-mark.svg";

type BusinessSEOProps = {
  user: User;
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

export default function BusinessSEO({
  user,
  slug,
  page,
}: BusinessSEOProps) {
  useEffect(() => {
    const info = user.contactInfo;

    const businessName =
      info?.businessName?.trim() || "Menú Digital";

    const address = info?.address?.trim();

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
    setMeta("twitter:card", "summary_large_image");
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
            ...(info?.number
              ? {
                  telephone: String(info.number),
                }
              : {}),
            ...(info?.mail
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