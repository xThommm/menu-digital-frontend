import { useState, type ReactNode } from "react";
import type { PublicMenuItem } from "../../../../types/index";
import { useReveal } from "../../../../hooks/useReveal";
import { highlightPrice } from "../../../../lib/landingHighlights";
import type { ShowcaseData } from "./useLandingHighlights";
import styles from "./UserHome.module.css";

// Secciones de la portada con la plantilla Inmersiva: franja de servicios,
// vidriera de platos, aviso de oferta y cierre. Todo sale de datos que el
// local ya cargó; una sección sin datos no se dibuja.

const fmt = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

// Título de sección: una línea chica con filetes a los costados y el título
// con la tipografía del diseño (`titleClass`).
export function SectionHead({ eyebrow, title, titleClass }: { eyebrow: string; title: string; titleClass: string }) {
  return (
    <div className={styles.sectionHead}>
      <p className={styles.sectionEyebrow}>{eyebrow}</p>
      <h2 className={`${titleClass} ${styles.sectionTitle}`}>{title}</h2>
    </div>
  );
}

export interface ServiceItem {
  key: string;
  icon: ReactNode;
  title: string;
  detail: string;
}

export function ServiceStrip({ items }: { items: ServiceItem[] }) {
  return (
    <ul className={styles.services} aria-label="Servicios del local">
      {items.map(item => (
        <li key={item.key} className={styles.service}>
          <span className={styles.serviceIcon} aria-hidden>{item.icon}</span>
          <span className={styles.serviceText}>
            <strong>{item.title}</strong>
            <span>{item.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PriceTag({ item, hidePrices }: { item: PublicMenuItem; hidePrices: boolean }) {
  const price = highlightPrice(item, { hidePrices });
  if (!price) return null;
  return (
    <span className={styles.pickPrice}>
      {price.from && <span className={styles.pickFrom}>Desde </span>}
      {fmt(price.current)}
      {price.previous != null && <span className={styles.pickOld}>{fmt(price.previous)}</span>}
    </span>
  );
}

function PickCard({ item, index, hidePrices, onOpen }: { item: PublicMenuItem; index: number; hidePrices: boolean; onOpen: () => void }) {
  const [imgError, setImgError] = useState(false);
  const { ref, revealed } = useReveal<HTMLLIElement>();
  if (imgError) return null; // Sin foto no hay tarjeta: la vidriera es de fotos.
  const discount = highlightPrice(item, { hidePrices })?.discount;

  return (
    <li
      ref={ref}
      className={`${styles.pick} t-reveal ${revealed ? "t-reveal-in" : ""}`}
      style={{ "--reveal-delay": `${Math.min(index * 0.06, 0.3)}s` } as React.CSSProperties}
    >
      {/* Toda la tarjeta lleva a la carta: el pedido se arma ahí. */}
      <button type="button" className={styles.pickButton} onClick={onOpen} aria-label={`${item.title}: ver en la carta`}>
        <span className={styles.pickMedia}>
          <img src={item.image} alt="" loading="lazy" decoding="async" onError={() => setImgError(true)} />
          {discount != null && <span className={styles.pickBadge}>-{discount}%</span>}
        </span>
        <span className={styles.pickBody}>
          <span className={`${styles.pickName} t-family-heading`}>{item.title}</span>
          {item.description && <span className={styles.pickDesc}>{item.description}</span>}
          <span className={styles.pickFoot}>
            <PriceTag item={item} hidePrices={hidePrices} />
            <span className={styles.pickArrow} aria-hidden>→</span>
          </span>
        </span>
      </button>
    </li>
  );
}

export function Highlights({ data, titleClass, onOpenMenu }: { data: ShowcaseData; titleClass: string; onOpenMenu: () => void }) {
  if (data.picks.length === 0) return null;
  return (
    <section className={styles.picksSection} aria-label="Platos de la carta">
      <SectionHead eyebrow="De nuestra carta" title="Para ir eligiendo" titleClass={titleClass} />
      <ul className={styles.picks}>
        {data.picks.map((item, index) => (
          <PickCard key={item._id} item={item} index={index} hidePrices={data.hidePrices} onOpen={onOpenMenu} />
        ))}
      </ul>
      <button type="button" className={styles.picksMore} onClick={onOpenMenu}>
        Ver la carta completa <span aria-hidden>→</span>
      </button>
    </section>
  );
}

export function OfferBanner({ item, titleClass, onOpenMenu }: { item: PublicMenuItem; titleClass: string; onOpenMenu: () => void }) {
  const [imgError, setImgError] = useState(false);
  const price = highlightPrice(item, { hidePrices: false });
  if (!price || price.previous == null) return null;

  return (
    <section className={styles.offer} aria-label="Oferta">
      <div className={styles.offerText}>
        <p className={styles.offerEyebrow}>Oferta de hoy</p>
        <h2 className={`${titleClass} ${styles.offerTitle}`}>{item.title}</h2>
        {item.description && <p className={styles.offerDesc}>{item.description}</p>}
        <p className={styles.offerPrices}>
          <strong>{fmt(price.current)}</strong>
          <span className={styles.pickOld}>{fmt(price.previous)}</span>
          <span className={styles.offerBadge}>-{price.discount}%</span>
        </p>
        <button type="button" className="t-btn" onClick={onOpenMenu}>Pedir en la carta →</button>
      </div>
      {item.image && !imgError && (
        <img className={styles.offerImg} src={item.image} alt="" loading="lazy" decoding="async" onError={() => setImgError(true)} />
      )}
    </section>
  );
}

export function ClosingBand({
  businessName, address, titleClass, menuLabel, onOpenMenu,
}: {
  businessName: string;
  address?: string;
  titleClass: string;
  menuLabel: string;
  onOpenMenu: () => void;
}) {
  return (
    <footer className={styles.closing}>
      <SectionHead eyebrow="Te esperamos" title={businessName} titleClass={titleClass} />
      {address && <p className={styles.closingAddress}>{address}</p>}
      <div className={styles.closingActions}>
        <button type="button" className="t-btn" onClick={onOpenMenu}>{menuLabel}</button>
        {address && (
          <a
            className={styles.reserveBtn}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Cómo llegar
          </a>
        )}
      </div>
    </footer>
  );
}
