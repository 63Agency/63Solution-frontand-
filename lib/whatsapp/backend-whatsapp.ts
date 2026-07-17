import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import type {
  BulkWhatsAppSendOptions,
  BulkWhatsAppSendPayload,
  BulkWhatsAppSendResult,
  BulkWhatsAppSendResultItem,
  SendWhatsAppMessagePayload,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppMessagesPage,
  WhatsAppTemplateComponent,
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

function normalizeDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) digits = `212${digits.slice(1)}`;
  return digits;
}

function findConversationByPhone(
  conversations: WhatsAppConversation[],
  digits: string,
): WhatsAppConversation | undefined {
  return conversations.find((c) => {
    const d = normalizeDigits(c.phoneNumber);
    return d === digits || d.endsWith(digits) || digits.endsWith(d);
  });
}

function parseBulkResult(raw: unknown): BulkWhatsAppSendResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const resultsRaw = Array.isArray(o.results) ? o.results : [];
  const results: BulkWhatsAppSendResultItem[] = resultsRaw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const phoneNumber = String(r.phoneNumber ?? r.phone ?? "");
    if (!phoneNumber) return [];

    const item: BulkWhatsAppSendResultItem = {
      phoneNumber,
      success: r.success === true || r.ok === true,
    };
    if (typeof r.conversationId === "string") {
      item.conversationId = r.conversationId;
    }
    if (typeof r.messageId === "string") {
      item.messageId = r.messageId;
    }
    if (typeof r.error === "string") {
      item.error = r.error;
    }
    return [item];
  });

  if (results.length === 0) return null;
  const sent =
    typeof o.sent === "number" ? o.sent : results.filter((r) => r.success).length;
  const failed =
    typeof o.failed === "number" ? o.failed : results.filter((r) => !r.success).length;
  return { sent, failed, results };
}

/**
 * Envoi à plusieurs numéros.
 * Essaie POST /whatsapp/broadcast, sinon envoi conversation par conversation.
 * En mode template, `recipients[].variable1` (ou `variable1`) remplace {{1}}.
 */
export async function sendBulkWhatsAppMessages(
  payload: BulkWhatsAppSendPayload,
  options: BulkWhatsAppSendOptions = {},
): Promise<BulkWhatsAppSendResult> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const isTemplateSend = Boolean(payload.templateName?.trim());
  const text = payload.text?.trim() ?? "";

  if (!isTemplateSend && !text) {
    throw new Error("Le message ne peut pas être vide.");
  }
  if (isTemplateSend && !payload.templateName?.trim()) {
    throw new Error("Sélectionnez un template WhatsApp.");
  }

  const phoneNumbers = (
    payload.recipients && payload.recipients.length > 0
      ? payload.recipients.map((r) => r.phoneNumber)
      : payload.phoneNumbers
  )
    .map((p) => normalizeDigits(p))
    .filter((d) => d.length >= 9);

  const uniquePhones: string[] = [];
  const seen = new Set<string>();
  for (const phone of phoneNumbers) {
    if (seen.has(phone)) continue;
    seen.add(phone);
    uniquePhones.push(phone);
  }

  if (uniquePhones.length === 0) {
    throw new Error("Ajoutez au moins un numéro valide.");
  }

  const total = uniquePhones.length;
  const reportProgress = (completed: number) => {
    options.onProgress?.(completed, total);
  };

  const variable1ByPhone = new Map<string, string>();
  for (const recipient of payload.recipients ?? []) {
    const phone = normalizeDigits(recipient.phoneNumber);
    const name = recipient.variable1?.trim();
    if (phone.length >= 9 && name) {
      variable1ByPhone.set(phone, name);
    }
  }

  const sharedVariable1 =
    payload.variable1?.trim() ||
    payload.components
      ?.find((c) => String(c.type ?? "").toLowerCase() === "body")
      ?.parameters?.find((p) => typeof p.text === "string" && p.text.trim())
      ?.text?.trim() ||
    "";

  const resolveVariable1 = (phone: string): string =>
    variable1ByPhone.get(phone) || sharedVariable1;

  async function postBroadcast(body: Record<string, unknown>): Promise<BulkWhatsAppSendResult | null> {
    for (const path of ["/whatsapp/broadcast", "/whatsapp/messages/bulk"]) {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: buildAuthHeaders(),
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.status === 404) continue;
      if (!res.ok) {
        return parseApiError(res, `POST ${path}`);
      }
      const parsed = parseBulkResult(await res.json().catch(() => null));
      if (parsed) return parsed;
    }
    return null;
  }

  if (isTemplateSend) {
    const templateName = payload.templateName!.trim();
    const templateLanguage = payload.templateLanguage ?? "fr";
    const results: BulkWhatsAppSendResultItem[] = [];

    // Le backend applique un seul variable1 par requête → un envoi par destinataire
    // quand les noms diffèrent (cas normal après import Leads).
    for (let index = 0; index < uniquePhones.length; index += 1) {
      const phone = uniquePhones[index];
      const variable1 = resolveVariable1(phone);
      const components: WhatsAppTemplateComponent[] =
        variable1.length > 0
          ? [
              {
                type: "body",
                parameters: [{ type: "text", text: variable1 }],
              },
            ]
          : Array.isArray(payload.components)
            ? payload.components
            : [];

      try {
        const parsed = await postBroadcast({
          phoneNumbers: [phone],
          templateName,
          templateLanguage,
          components,
          ...(variable1 ? { variable1 } : {}),
        });
        if (!parsed) {
          throw new Error(
            "L'envoi par template nécessite POST /whatsapp/broadcast côté backend.",
          );
        }
        results.push(...parsed.results);
      } catch (e) {
        if (e instanceof Error && e.message.includes("POST /whatsapp")) {
          throw e;
        }
        results.push({
          phoneNumber: phone,
          success: false,
          error: e instanceof Error ? e.message : "Échec envoi",
        });
      }
      reportProgress(index + 1);
    }

    const sent = results.filter((r) => r.success).length;
    return { sent, failed: results.length - sent, results };
  }

  const body = { phoneNumbers: uniquePhones, text };
  const broadcastResult = await postBroadcast(body);
  if (broadcastResult) {
    reportProgress(total);
    return broadcastResult;
  }

  const conversations = await fetchWhatsAppConversations();
  const results: BulkWhatsAppSendResultItem[] = [];

  for (let index = 0; index < uniquePhones.length; index += 1) {
    const phone = uniquePhones[index];
    const conv = findConversationByPhone(conversations, phone);
    if (!conv) {
      results.push({
        phoneNumber: phone,
        success: false,
        error:
          "Aucune conversation pour ce numéro. Le contact doit avoir déjà écrit sur WhatsApp.",
      });
      reportProgress(index + 1);
      continue;
    }
    try {
      const sent = await sendWhatsAppMessage(conv.id, { text });
      results.push({
        phoneNumber: phone,
        success: true,
        conversationId: conv.id,
        messageId: sent.id,
      });
    } catch (e) {
      results.push({
        phoneNumber: phone,
        success: false,
        conversationId: conv.id,
        error: e instanceof Error ? e.message : "Échec envoi",
      });
    }
    reportProgress(index + 1);
  }

  const sent = results.filter((r) => r.success).length;
  return { sent, failed: results.length - sent, results };
}
