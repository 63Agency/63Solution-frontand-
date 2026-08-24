export type EmailRecipient = {
  email: string;
  name: string;
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
