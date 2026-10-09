import { useHalloweenActive } from "../../hooks/useHalloween";

// Fantasma que flota asomado detrás de la tarjeta de auth. Con `boo` sale
// del todo y dice "¡Buu!" (Login lo dispara cuando fallan las credenciales).
// Va como HERMANO de .auth-surface, no adentro: la tarjeta arma su propio
// contexto de apilado y un hijo nunca queda detrás de su fondo.
export default function Ghost({ boo = false }: { boo?: boolean }) {
  if (!useHalloweenActive()) return null;
  return (
    <div className="hw-ghost" data-boo={boo} aria-hidden="true">
      <span className="hw-ghost-say">¡Buu!</span>
      <svg width="74" height="88" viewBox="0 0 74 88" focusable="false">
        <path
          d="M37 3C18 3 6 17 6 36v44c0 3 3 4 5 2l6-6 7 7c1 1 3 1 4 0l9-8 9 8c1 1 3 1 4 0l7-7 6 6c2 2 5 1 5-2V36C68 17 56 3 37 3z"
          fill="#f4f0ff" fillOpacity="0.9" stroke="#cfc4e6" strokeWidth="1.5"
        />
        <ellipse className="hw-ghost-eye" cx="27" cy="34" rx="4.5" ry="6" fill="#231320" />
        <ellipse className="hw-ghost-eye" cx="47" cy="34" rx="4.5" ry="6" fill="#231320" />
        <ellipse className="hw-ghost-mouth" cx="37" cy="52" rx="5" ry="3" fill="#231320" />
        <circle cx="19" cy="44" r="3.5" fill="#ff7518" fillOpacity="0.35" />
        <circle cx="55" cy="44" r="3.5" fill="#ff7518" fillOpacity="0.35" />
      </svg>
    </div>
  );
}
