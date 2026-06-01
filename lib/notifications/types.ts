import type { WhatsAppConversation } from "../whatsapp/types";

export type NotificationType = "whatsapp.message" | "system";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
  /** Métadonnées optionnelles (ex. conversation WhatsApp). */
  meta?: {
    conversationId?: string;
    phoneNumber?: string;
  };
};

export type NotificationsPage = {
  items: AppNotification[];
  unreadCount: number;
  /** `api` = endpoint /notifications ; `whatsapp` = dérivé des conversations. */
  source: "api" | "whatsapp";
  /** Présent uniquement si `source === "whatsapp"` (évite un second appel API). */
  conversations?: WhatsAppConversation[];
};
