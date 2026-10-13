import type { ReactNode } from "react";
import p from "./panel.module.css";

// Aviso de "disponible en el plan Pro" de las secciones de pedidos (el
// backend también lo exige).
export default function ProLock({ title, children, onBack }: { title: string; children: ReactNode; onBack: () => void }) {
  return (
    <div className={p.page}>
      <div className={p.card} style={{ maxWidth: 480, margin: "3rem auto", textAlign: "center" }}>
        <h1 className={p.title}>{title}</h1>
        <p className={p.subtitle} style={{ margin: "0.75rem 0 1.25rem", lineHeight: 1.55 }}>{children}</p>
        <button type="button" className={p.btnPrimary} onClick={onBack}>Ver planes en el panel</button>
      </div>
    </div>
  );
}
