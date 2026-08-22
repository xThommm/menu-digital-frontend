import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { NotificationType } from "../context/NotificationContext";
import { useNotifications } from "../context/useNotifications";

export function useFeedbackMessage(
  type: Extract<NotificationType, "success" | "error">,
  initialValue: string | (() => string) = "",
) {
  const [initialMessage] = useState<string>(initialValue);
  const [message, setMessageState] = useState(initialMessage);
  const messageRef = useRef(message);
  const notifications = useNotifications();
  const notify = notifications[type];
  const initialNotifiedRef = useRef(false);

  useEffect(() => {
    if (!initialNotifiedRef.current && initialMessage) {
      initialNotifiedRef.current = true;
      notify(initialMessage);
    }
  }, [initialMessage, notify]);

  const setMessage = useCallback((value: SetStateAction<string>) => {
    const next = typeof value === "function" ? value(messageRef.current) : value;
    messageRef.current = next;
    setMessageState(next);
    if (next) notify(next);
  }, [notify]);

  return [message, setMessage] as const;
}
