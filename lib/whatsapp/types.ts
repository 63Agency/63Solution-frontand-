export type WhatsAppMessageDirection = "inbound" | "outbound";

export type WhatsAppMessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type WhatsAppMessageType = "text" | "image" | "document" | "audio" | "video";

export type WhatsAppConversation = {
  id: string;
  phoneNumber: string;
  contactName?: string;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
  status?: "open" | "closed";
  source?: string;
  /** Id Meta (wa_id) — le backend peut encore exposer `watiContactId` (colonne historique). */
  metaContactId?: string;
  /** @deprecated Alias rétrocompat — même valeur que metaContactId */
  watiContactId?: string;
};

export type WhatsAppMessage = {
  id: string;
  conversationId: string;
  direction: WhatsAppMessageDirection;
  body: string;
  type: WhatsAppMessageType;
  status: WhatsAppMessageStatus;
  /** Id message Meta (wamid…) — le backend peut encore exposer `watiMessageId`. */
  metaMessageId?: string;
  /** @deprecated Alias rétrocompat — même valeur que metaMessageId */
  watiMessageId?: string;
  sentAt?: string;
  createdAt: string;
};

export type SendWhatsAppMessagePayload = {
  text: string;
};

export type WhatsAppMessagesPage = {
  items: WhatsAppMessage[];
  nextCursor?: string | null;
};

export type BulkWhatsAppSendPayload = {
  phoneNumbers: string[];
  text: string;
};

export type BulkWhatsAppSendOptions = {
  onProgress?: (completed: number, total: number) => void;
};

export type BulkWhatsAppSendResultItem = {
  phoneNumber: string;
  success: boolean;
  conversationId?: string;
  messageId?: string;
  error?: string;
};

export type BulkWhatsAppSendResult = {
  sent: number;
  failed: number;
  results: BulkWhatsAppSendResultItem[];
};
