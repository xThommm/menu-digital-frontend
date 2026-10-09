import { NavLink } from "react-router-dom";
import p from "../panel/panel.module.css";

// Las vistas de Delivery viven bajo una sola entrada de la barra lateral y se
// cambian con estas pestañas.
const TABS = [
  { to: "/pedidos/delivery", label: "Entregas en curso", end: true },
  { to: "/pedidos/delivery/repartidores", label: "Repartidores", end: false },
  { to: "/pedidos/delivery/historial", label: "Historial de envíos", end: false },
];

export default function DeliveryTabs() {
  return (
    <nav className={p.segmented} aria-label="Secciones de Delivery" style={{ alignSelf: "flex-start", flexWrap: "wrap" }}>
      {TABS.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `${p.segment} ${isActive ? p.segmentActive : ""}`}
          style={{ textDecoration: "none" }}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
