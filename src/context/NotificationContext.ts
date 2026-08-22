import { createContext } from "react";

export type NotificationType = "success" | "error" | "info";

export interface NotificationOptions {
  type: NotificationType;
  message: string;
  duration?: number;
}

export interface NotificationContextValue {
  notify: (options: NotificationOptions) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);
