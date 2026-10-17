import s from "./CopperBackground.module.css";

// Fondo "Copper Current" (oscuro) / "Sunset Haze" (claro), diseñado en
// pryzm.design y recreado en CSS: vetas del acento difuminadas sobre el
// color de base, con grano encima. No pinta ningún color propio: quien lo
// usa define --copper-base y --copper-accent (y opcionalmente --copper-k),
// así sigue el tema claro/oscuro y el acento del panel sin JS.

interface Props {
  className?: string;
}

export default function CopperBackground({ className = "" }: Props) {
  return (
    <div className={`${s.root} ${className}`} aria-hidden="true">
      <div className={s.field}>
        <span className={`${s.streak} ${s.main}`} />
        <span className={`${s.streak} ${s.low}`} />
        <span className={`${s.streak} ${s.corner}`} />
        <span className={`${s.streak} ${s.foot}`} />
        <span className={`${s.streak} ${s.far}`} />
      </div>
      <div className={s.grain} />
    </div>
  );
}
