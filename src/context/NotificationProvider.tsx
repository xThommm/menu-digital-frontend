import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  NotificationContext,
  type NotificationOptions,
  type NotificationType,
} from "./NotificationContext";
import styles from "./NotificationProvider.module.css";

interface NotificationItem extends NotificationOptions {
  id: number;
}

const DEFAULT_DURATION: Record<NotificationType, number> = {
  success: 4_000,
  error: 6_000,
  info: 4_500,
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const nextIdRef = useRef(1);
  const lastRef = useRef<{ key: string; at: number } | null>(null);

  const dismiss = useCallback((id: number) => {
    setItems(current => current.filter(item => item.id !== id));
  }, []);

  const notify = useCallback((options: NotificationOptions) => {
    const message = options.message.trim();
    if (!message) return;

    const key = `${options.type}:${message}`;
    const now = Date.now();
    if (lastRef.current?.key === key && now - lastRef.current.at < 800) return;
    lastRef.current = { key, at: now };

    const id = nextIdRef.current++;
    const duration = options.duration ?? DEFAULT_DURATION[options.type];
    setItems(current => [...current.slice(-3), { ...options, message, id }]);
    window.setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const value = useMemo(() => ({
    notify,
    success: (message: string, duration?: number) => notify({ type: "success", message, duration }),
    error: (message: string, duration?: number) => notify({ type: "error", message, duration }),
    info: (message: string, duration?: number) => notify({ type: "info", message, duration }),
  }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className={styles.viewport} aria-label="Notificaciones">
        {items.map(item => (
          <div
            key={item.id}
            className={`${styles.notice} ${styles[item.type]}`}
            role={item.type === "error" ? "alert" : "status"}
          >
            <span className={styles.icon} aria-hidden="true">
              {item.type === "success" ? "✓" : item.type === "error" ? "!" : "i"}
            </span>
            <p className={styles.message}>{item.message}</p>
            <button
              type="button"
              className={styles.close}
              onClick={() => dismiss(item.id)}
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}
