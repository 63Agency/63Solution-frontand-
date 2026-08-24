import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import { parseBackendApiError } from "../auth/api-errors";
import type {
  EmailBroadcastPayload,
  EmailBroadcastResult,
  EmailBroadcastResultItem,
  EmailRecipient,
  FetchEmailRecipientsParams,
} from "./types";

function buildAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function parseRecipient(row: unknown): EmailRecipient | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const email = String(r.email ?? r.mail ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) return null;
  const name =
    typeof r.name === "string" && r.name.trim()
      ? r.name.trim()
      : typeof r.contactName === "string" && r.contactName.trim()
        ? r.contactName.trim()
        : email.split("@")[0] || "Client";
  return { email, name };
}

function parseBroadcastResultItem(row: unknown): EmailBroadcastResultItem | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const email = String(r.email ?? r.to ?? "")
    .trim()
    .toLowerCase();
  if (!email) return null;
  const success =
    r.success === true ||
    r.ok === true ||
    String(r.status ?? "").toLowerCase() === "sent" ||
    String(r.status ?? "").toLowerCase() === "envoyé";
  return {
    email,
    success,
    name: typeof r.name === "string" ? r.name : undefined,
    error:
      typeof r.error === "string"
        ? r.error
        : typeof r.message === "string" && !success
          ? r.message
          : undefined,
  };
}

function parseBroadcastResult(raw: unknown, fallbackTotal: number): EmailBroadcastResult {
  if (!raw || typeof raw !== "object") {
    return { sent: 0, failed: fallbackTotal, total: fallbackTotal, results: [] };
  }
  const o = raw as Record<string, unknown>;
  const resultsRaw = Array.isArray(o.results) ? o.results : [];
  const results = resultsRaw
    .map(parseBroadcastResultItem)
    .filter((v): v is EmailBroadcastResultItem => v !== null);

  const sent =
    typeof o.sent === "number" ? o.sent : results.filter((r) => r.success).length;
  const failed =
    typeof o.failed === "number"
      ? o.failed
      : results.filter((r) => !r.success).length;
  const total =
    typeof o.total === "number"
      ? o.total
      : results.length > 0
        ? results.length
        : fallbackTotal;

  return { sent, failed, total, results };
}

/**
 * GET /email/recipients?listId=&status=
 * → destinataires avec email pour l’envoi groupé.
 */
export async function fetchEmailRecipients({
  listId = null,
  status = null,
  signal,
}: FetchEmailRecipientsParams = {}): Promise<EmailRecipient[]> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const params = new URLSearchParams();
  if (listId?.trim()) params.set("listId", listId.trim());
  if (status?.trim()) params.set("status", status.trim());
  const qs = params.toString();

  const res = await fetch(
    `${base}/email/recipients${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
      cache: "no-store",
      signal,
    },
  );

  if (!res.ok) {
    return parseBackendApiError(res, "GET /email/recipients");
  }

  const raw = await res.json().catch(() => null);
  const rows = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { recipients?: unknown }).recipients)
      ? (raw as { recipients: unknown[] }).recipients
      : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
        ? (raw as { items: unknown[] }).items
        : [];

  const seen = new Set<string>();
  const recipients: EmailRecipient[] = [];
  for (const row of rows) {
    const parsed = parseRecipient(row);
    if (!parsed || seen.has(parsed.email)) continue;
    seen.add(parsed.email);
    recipients.push(parsed);
  }
  return recipients;
}

/**
 * POST /email/broadcast
 * Body: { subject, html, recipients: [{ email, name }] }
 * → { sent, failed, total, results[] }
 */
export async function sendEmailBroadcast(
  payload: EmailBroadcastPayload,
): Promise<EmailBroadcastResult> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const subject = payload.subject.trim();
  const html = payload.html.trim();
  if (!subject) throw new Error("Le sujet est obligatoire.");
  if (!html) throw new Error("Le corps de l'email est obligatoire.");

  const recipients = payload.recipients
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      name: r.name.trim() || "Client",
    }))
    .filter((r) => r.email.includes("@"));

  if (recipients.length === 0) {
    throw new Error("Ajoutez au moins un destinataire avec email.");
  }

  const res = await fetch(`${base}/email/broadcast`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ subject, html, recipients }),
  });

  if (!res.ok) {
    return parseBackendApiError(res, "POST /email/broadcast");
  }

  const raw = await res.json().catch(() => null);
  return parseBroadcastResult(raw, recipients.length);
}
