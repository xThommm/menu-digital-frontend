/**
 * ErrorBoundary.tsx
 * ────────────────────────────────────────────────────────────────────────
 * apiClient.ts y useAsyncAction.ts cubren errores ASÍNCRONOS (fetch falla,
 * el servidor responde 500, etc.). Pero un error de RENDER —por ejemplo
 * `pictures.map(...)` cuando `pictures` llega undefined por algún borde no
 * previsto, o `t.color` cuando `template` no matchea ningún TEMPLATES— no
 * lo atrapa ningún try/catch: tira toda la pantalla en blanco, sin aviso,
 * y el usuario no tiene ninguna acción posible salvo recargar a ciegas.
 *
 * Un Error Boundary es la única forma de atrapar eso en React. Tiene que
 * ser un componente de clase (las funciones no pueden implementar
 * getDerivedStateFromError / componentDidCatch todavía).
 *
 * Uso recomendado: envolver cada editor por separado, no toda la app de
 * una sola vez, así un crash en MenuEditor no te tira también el resto
 * del dashboard:
 *
 *   <ErrorBoundary fallbackTitle="No se pudo mostrar el editor del menú">
 *     <MenuEditorPage />
 *   </ErrorBoundary>
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
  /** Título corto y específico al contexto donde se usa este boundary. */
  fallbackTitle?: string;
  /** Se llama cuando se captura un error — conectar acá a Sentry/logging cuando lo sumes. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Por ahora, log a consola. Cuando sumes Sentry (o similar), este es
    // el único lugar que hay que tocar para reportar todos los crashes
    // de render de toda la app.
    console.error("ErrorBoundary capturó:", error, info.componentStack);
    this.props.onError?.(error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.boundary}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className={styles.title}>
            {this.props.fallbackTitle || "Algo salió mal al mostrar esta sección"}
          </p>
          <p className={styles.subtitle}>
            Tus datos no se perdieron. Probá recargar la página.
          </p>
          <button className={styles.reloadBtn} onClick={this.handleReload} type="button">
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}