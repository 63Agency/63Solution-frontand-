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
  watiContactId?: string;
};

export type WhatsAppMessage = {
  id: string;
  conversationId: string;
  direction: WhatsAppMessageDirection;
  body: string;
  type: WhatsAppMessageType;
  status: WhatsAppMessageStatus;
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
