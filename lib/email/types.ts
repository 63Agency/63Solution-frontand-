export type EmailRecipient = {
  email: string;
  name: string;
};

export type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html: string;
};

/** Mapping email lié à un template WhatsApp (`GET/PUT /email/templates/:waTemplateName`). */
export type EmailTemplateMapping = {
  waTemplateName: string;
  subject: string;
  html: string;
  found: boolean;
};

export type FetchEmailRecipientsParams = {
  listId?: string | null;
  status?: string | null;
  signal?: AbortSignal;
};

export type EmailBroadcastPayload = {
  subject: string;
  html: string;
  recipients: EmailRecipient[];
  /** Si envoi depuis un template catalogue. */
  templateId?: string;
  templateName?: string;
};

export type EmailBroadcastResultItem = {
  email: string;
  success: boolean;
  error?: string;
  name?: string;
};

export type EmailBroadcastResult = {
  sent: number;
  failed: number;
  total: number;
  results: EmailBroadcastResultItem[];
};
