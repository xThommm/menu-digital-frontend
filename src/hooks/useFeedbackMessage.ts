import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { NotificationType } from "../context/NotificationContext";
import { useNotifications } from "../context/useNotifications";

export function useFeedbackMessage(
  type: Extract<NotificationType, "success" | "error">,
  initialValue: string | (() => string) = "",
) {
  const initialRef = useRef<string | null>(null);
  if (initialRef.current === null) {
    initialRef.current = typeof initialValue === "function" ? initialValue() : initialValue;
  }

  const [message, setMessageState] = useState(initialRef.current);
  const messageRef = useRef(message);
  const notifications = useNotifications();
  const notify = notifications[type];
  const initialNotifiedRef = useRef(false);

  useEffect(() => {
    if (!initialNotifiedRef.current && initialRef.current) {
      initialNotifiedRef.current = true;
      notify(initialRef.current);
    }
  }, [notify]);

  const setMessage = useCallback((value: SetStateAction<string>) => {
    const next = typeof value === "function" ? value(messageRef.current) : value;
    messageRef.current = next;
    setMessageState(next);
    if (next) notify(next);
  }, [notify]);

  return [message, setMessage] as const;
}
