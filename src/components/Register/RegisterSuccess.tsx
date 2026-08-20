import { Link } from "react-router-dom";
import styles from "./RegisterSuccess.module.css";

export default function RegisterSuccessPage() {
  // Limpiar datos temporales
  sessionStorage.removeItem("pendingRegister");

  return (
    <div className={styles.page}>
      <div className={styles.card}>s
        <div className={styles.icon}>✓</div>
        <h1>¡Pago recibido!</h1>
        <p>
          Estamos activando tu cuenta. En unos segundos ya vas a poder iniciar
          sesión con el usuario y contraseña que elegiste.
        </p>
        <Link to="/login" className={styles.btn}>
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  );
}