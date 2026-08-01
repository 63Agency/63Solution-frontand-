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
  /** Meta media id when type is "audio" (also stored in body). */
  mediaId?: string | null;
  /** Cloudinary / public HTTPS URL for image, video, document. */
  mediaUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  status: WhatsAppMessageStatus;
  /** Id message Meta (wamid…) — le backend peut encore exposer `watiMessageId`. */
  metaMessageId?: string;
  /** @deprecated Alias rétrocompat — même valeur que metaMessageId */
  watiMessageId?: string;
  sentAt?: string;
  createdAt: string;
  /** ISO date when the message body was last edited (CRM / Meta). */
  editedAt?: string | null;
  /** Soft-deleted in CRM (or Meta revoke). */
  deletedAt?: string | null;
  isDeleted?: boolean;
  /** Citation affichée (réponse à un message) — UI / optimiste. */
  replyTo?: {
    id: string;
    body: string;
    authorLabel: string;
  } | null;
  /** Client-only: upload progress 0–100 while sending media. */
  uploadProgress?: number | null;
  /** Client-only: upload / send error message. */
  uploadError?: string | null;
};

export type SendWhatsAppMessagePayload = {
  /** Texte ou légende (optionnel si média). */
  text?: string;
  /** Meta wamid ou uuid du message cité (le backend résout vers context.message_id). */
  replyToMessageId?: string;
  type?: WhatsAppMessageType;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
};

export type UpdateWhatsAppMessagePayload = {
  text: string;
};

export type DeleteWhatsAppMessageOptions = {
  /**
   * true = supprimer aussi côté WhatsApp (Meta) pour tous.
   * false / omit = soft-delete CRM seulement (« pour moi »).
   */
  forEveryone?: boolean;
};

export type WhatsAppMessagesPage = {
  items: WhatsAppMessage[];
  nextCursor?: string | null;
};

export type WhatsAppTemplateComponentParameter = {
  type: string;
  text: string;
};

export type WhatsAppTemplateComponent = {
  type: string;
  parameters: WhatsAppTemplateComponentParameter[];
};

export type BulkWhatsAppRecipient = {
  phoneNumber: string;
  /** Remplace {{1}} dans le body du template pour ce destinataire. */
  variable1?: string;
};

export type BulkWhatsAppSendPayload = {
  phoneNumbers: string[];
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  components?: WhatsAppTemplateComponent[];
  /** Valeur partagée {{1}} pour tous les destinataires (fallback). */
  variable1?: string;
  /** Destinataires avec variable1 individuelle (prioritaire pour les leads). */
  recipients?: BulkWhatsAppRecipient[];
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
