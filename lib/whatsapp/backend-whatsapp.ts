import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  SendWhatsAppMessagePayload,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessagesPage,
} from "./types";

function buildAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function parseApiError(res: Response, context: string): Promise<never> {
  const raw = await res.text().catch(() => "");
  let message = raw || `Erreur ${res.status}`;
  try {
    const parsed = JSON.parse(raw) as { message?: string | string[] };
    if (typeof parsed.message === "string") message = parsed.message;
    else if (Array.isArray(parsed.message) && parsed.message.length > 0) {
      message = parsed.message.join(", ");
    }
  } catch {
    /* ignore */
  }
  throw new Error(message || `${context} (${res.status})`);
}

function parseConversation(row: unknown): WhatsAppConversation | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const phoneNumber = String(r.phoneNumber ?? r.whatsappNumber ?? r.waId ?? "");
  if (!id || !phoneNumber) return null;
  return {
    id,
    phoneNumber,
    contactName:
      typeof r.contactName === "string"
        ? r.contactName
        : typeof r.name === "string"
          ? r.name
          : undefined,
    lastMessageText:
      typeof r.lastMessageText === "string"
        ? r.lastMessageText
        : typeof r.lastMessage === "string"
          ? r.lastMessage
          : undefined,
    lastMessageAt:
      typeof r.lastMessageAt === "string"
        ? r.lastMessageAt
        : typeof r.updatedAt === "string"
          ? r.updatedAt
          : undefined,
    unreadCount:
      typeof r.unreadCount === "number"
        ? r.unreadCount
        : typeof r.unread === "number"
          ? r.unread
          : 0,
    status: r.status === "closed" ? "closed" : "open",
    source: typeof r.source === "string" ? r.source : undefined,
    metaContactId:
      typeof r.metaContactId === "string"
        ? r.metaContactId
        : typeof r.watiContactId === "string"
          ? r.watiContactId
          : undefined,
    watiContactId:
      typeof r.watiContactId === "string"
        ? r.watiContactId
        : typeof r.metaContactId === "string"
          ? r.metaContactId
          : undefined,
  };
}

function parseMessage(row: unknown): WhatsAppMessage | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = String(r.id ?? "");
  const conversationId = String(r.conversationId ?? "");
  const direction = r.direction === "outbound" ? "outbound" : "inbound";
  const body = String(r.body ?? r.text ?? "");
  const createdAt = String(r.createdAt ?? r.sentAt ?? new Date().toISOString());
  if (!id || !conversationId) return null;

  const rawStatus = String(r.status ?? "sent").toLowerCase();
  const status =
    rawStatus === "pending" ||
    rawStatus === "sent" ||
    rawStatus === "delivered" ||
    rawStatus === "read" ||
    rawStatus === "failed"
      ? rawStatus
      : "sent";

  const rawType = String(r.type ?? "text").toLowerCase();
  const type =
    rawType === "image" ||
    rawType === "document" ||
    rawType === "audio" ||
    rawType === "video"
      ? rawType
      : "text";

  return {
    id,
    conversationId,
    direction,
    body,
    type,
    status,
    metaMessageId:
      typeof r.metaMessageId === "string"
        ? r.metaMessageId
        : typeof r.watiMessageId === "string"
          ? r.watiMessageId
          : undefined,
    watiMessageId:
      typeof r.watiMessageId === "string"
        ? r.watiMessageId
        : typeof r.metaMessageId === "string"
          ? r.metaMessageId
          : undefined,
    sentAt: typeof r.sentAt === "string" ? r.sentAt : undefined,
    createdAt,
  };
}

/** Liste des conversations WhatsApp (webhook Meta → Nest → Supabase). */
export async function fetchWhatsAppConversations(): Promise<WhatsAppConversation[]> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/whatsapp/conversations`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
  });

  if (res.status === 404) return [];

  if (!res.ok) return parseApiError(res, "GET /whatsapp/conversations");

  const raw = (await res.json().catch(() => null)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? ((raw as { items: unknown[] }).items as unknown[])
      : [];

  return list
    .map((row) => parseConversation(row))
    .filter((v): v is WhatsAppConversation => v !== null);
}

export async function fetchWhatsAppConversation(
  conversationId: string,
): Promise<WhatsAppConversation | null> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(
    `${base}/whatsapp/conversations/${encodeURIComponent(conversationId)}`,
    {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) return parseApiError(res, `GET /whatsapp/conversations/${conversationId}`);

  const raw = await res.json().catch(() => null);
  return parseConversation(raw);
}

/** Messages d’une conversation (pagination optionnelle via cursor). */
export async function fetchWhatsAppMessages(
  conversationId: string,
  options?: { cursor?: string; limit?: number },
): Promise<WhatsAppMessagesPage> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const params = new URLSearchParams();
  if (options?.cursor) params.set("cursor", options.cursor);
  if (options?.limit) params.set("limit", String(options.limit));
  const qs = params.toString() ? `?${params.toString()}` : "";

  const res = await fetch(
    `${base}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages${qs}`,
    {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );

  if (res.status === 404) return { items: [] };

  if (!res.ok) {
    return parseApiError(res, `GET /whatsapp/conversations/${conversationId}/messages`);
  }

  const raw = (await res.json().catch(() => null)) as unknown;
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown[] }).items)
      ? ((raw as { items: unknown[] }).items as unknown[])
      : [];

  const nextCursor =
    raw && typeof raw === "object" && typeof (raw as { nextCursor?: string }).nextCursor === "string"
      ? (raw as { nextCursor: string }).nextCursor
      : null;

  const items = list
    .map((row) => parseMessage(row))
    .filter((v): v is WhatsAppMessage => v !== null)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  return { items, nextCursor };
}

/** Envoie un message (Nest → Meta Graph API, puis enregistrement Supabase). */
export async function sendWhatsAppMessage(
  conversationId: string,
  payload: SendWhatsAppMessagePayload,
): Promise<WhatsAppMessage> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const text = payload.text.trim();
  if (!text) throw new Error("Le message ne peut pas être vide.");

  const res = await fetch(
    `${base}/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: "POST",
      headers: buildAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ text }),
    },
  );

  if (!res.ok) {
    return parseApiError(res, `POST /whatsapp/conversations/${conversationId}/messages`);
  }

  const raw = await res.json().catch(() => null);
  const parsed = parseMessage(raw);
  if (!parsed) throw new Error("Réponse backend invalide après envoi message.");
  return parsed;
}

/** Marque la conversation comme lue (unreadCount → 0). */
export async function markWhatsAppConversationRead(
  conversationId: string,
): Promise<void> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(
    `${base}/whatsapp/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: "PATCH",
      headers: buildAuthHeaders(),
      credentials: "include",
    },
  );

  if (res.status === 404) return;
  if (!res.ok) {
    return parseApiError(res, `PATCH /whatsapp/conversations/${conversationId}/read`);
  }
}

export function getWhatsAppPollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_POLL_MS;
  const n = raw ? Number.parseInt(raw, 10) : 3000;
  return Number.isFinite(n) && n >= 1500 ? n : 3000;
}
