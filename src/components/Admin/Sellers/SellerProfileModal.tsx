import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { Seller } from "../../../api/adminSellers";
import { formatPaymentDate } from "../../../lib/adminPayments";
import { formatDateAR } from "../../../lib/dates";
import s from "./AdminSellers.module.css";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

// Ficha de solo lectura del vendedor ("Ver perfil" del menú contextual). Para
// editar sigue estando el panel desplegable de la fila.
export default function SellerProfileModal({ seller, onClose }: { seller: Seller; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const role = seller.influencer ? "Influencer" : "Vendedor";
  const details: [string, string][] = [
    ["Código", seller.code],
    ["DNI", seller.dni],
    ["Mail", seller.mail],
    ["Teléfono", seller.number ? String(seller.number) : "Sin cargar"],
    ["Perfil", seller.influencer ? role : `${role} · ${seller.receivesLeads ? "recibe leads" : "sin reparto de leads"}`],
    ["Admin", seller.admin ? "Sí" : "No"],
    ["Vendedor desde", formatDateAR(seller.startDate, { calendarDate: true, fallback: "Sin definir" })],
    ["Alta", formatPaymentDate(seller.createdAt)],
  ];

  return (
    <div
      className={s.modalOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="seller-profile-title"
    >
      <div className={s.modal} onClick={(event) => event.stopPropagation()}>
        <div className={s.profileHeader}>
          {seller.profilePicture
            ? <img className={s.profileAvatar} src={seller.profilePicture} alt="" />
            : <span className={s.profileAvatar} aria-hidden="true">{initials(seller.name)}</span>}
          <div className={s.rowName}>
            <h2 id="seller-profile-title" className={s.modalTitle}>{seller.name}</h2>
            <span>
              <span className={`${s.statusBadge} ${seller.active ? s.statusOk : s.statusMuted}`}>
                {seller.active ? "Activo" : "Dado de baja"}
              </span>
            </span>
          </div>
        </div>

        <dl className={s.meta}>
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={s.profileValue}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className={s.modalActions}>
          {seller.active && !seller.influencer && (
            <Link className={s.secondaryButton} to={`/sellers?sellerID=${seller._id}`}>
              Ver sus comisiones
            </Link>
          )}
          <button className={s.primaryButton} type="button" onClick={onClose} autoFocus>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
