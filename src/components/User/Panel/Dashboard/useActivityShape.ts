import { useCallback, useState } from "react";
import { readJson, writeJson } from "../../../../features/orders/lib/storage";
import { EMPTY_ACTIVITY_SHAPE, isActivityShape, type ActivityShape } from "./todayActivity";

const storageKey = (userId: string) => `md:dash-activity:${userId}`;

/**
 * Qué tarjetas de pedidos y reservas tenían datos la última vez que este
 * usuario abrió el inicio en este navegador, y cómo anotarlo para la próxima.
 * La primera vez no hay ninguna.
 */
export function useLastActivityShape(userId: string | undefined): [ActivityShape, (shape: ActivityShape) => void] {
  const [last] = useState(() => (userId ? readJson(storageKey(userId), isActivityShape) : null) ?? EMPTY_ACTIVITY_SHAPE);
  const remember = useCallback((shape: ActivityShape) => {
    if (userId) writeJson(storageKey(userId), shape);
  }, [userId]);
  return [last, remember];
}
