import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import { parseBackendApiError } from "../auth/api-errors";
import { normalizeWhatsAppTemplates } from "../whatsapp/whatsapp-templates";
import type {
  EmailBroadcastPayload,
  EmailBroadcastResult,
  EmailBroadcastResultItem,
  EmailRecipient,
  EmailTemplate,
  EmailTemplateMapping,
  FetchEmailRecipientsParams,
} from "./types";
import {
  BUILTIN_EMAIL_TEMPLATES,
  mapWhatsAppTemplatesToEmail,
} from "./email-templates";

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

function parseEmailTemplate(row: unknown, index: number): EmailTemplate | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const name = String(r.name ?? r.templateName ?? r.slug ?? "").trim();
  const subject = String(r.subject ?? r.title ?? "").trim();
  const html = String(r.html ?? r.body ?? r.content ?? "").trim();
  if (!subject && !html) return null;
  const id = String(r.id ?? r.templateId ?? name ?? `email-template-${index}`).trim();
  return {
    id: id || `email-template-${index}`,
    name: name || subject || `Template ${index + 1}`,
    subject: subject || "(sans objet)",
    html: html || `<p>${subject}</p>`,
  };
}

/**
 * Templates email = même catalogue que WhatsApp bulk,
 * réécrits en version professionnelle (objet + HTML).
 * Source : /api/whatsapp/templates → adaptation front.
 * Fallback : GET /email/templates Nest, puis builtins.
 */
export async function fetchEmailTemplates(
  signal?: AbortSignal,
): Promise<EmailTemplate[]> {
  const token = getStoredAccessToken();

  try {
    const res = await fetch("/api/whatsapp/templates", {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
      signal,
    });
    if (res.ok) {
      const raw = await res.json().catch(() => null);
      const wa = normalizeWhatsAppTemplates(
        Array.isArray(raw)
          ? raw
          : raw && typeof raw === "object"
            ? raw
            : [],
      );
      const mapped = mapWhatsAppTemplatesToEmail(wa);
      if (mapped.length > 0) return mapped;
    }
  } catch (e) {
    if (signal?.aborted) throw e;
  }

  const base = getApiBaseUrl();
  if (base) {
    try {
      const res = await fetch(`${base}/email/templates`, {
        method: "GET",
        headers: buildAuthHeaders(),
        credentials: "include",
        cache: "no-store",
        signal,
      });
      if (res.ok) {
        const raw = await res.json().catch(() => null);
        const rows = Array.isArray(raw)
          ? raw
          : raw &&
              typeof raw === "object" &&
              Array.isArray((raw as { templates?: unknown }).templates)
            ? (raw as { templates: unknown[] }).templates
            : [];
        const templates = rows
          .map((row, index) => parseEmailTemplate(row, index))
          .filter((t): t is EmailTemplate => t !== null);
        if (templates.length > 0) return templates;
      }
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }

  return [...BUILTIN_EMAIL_TEMPLATES];
}

/**
 * GET /email/templates/:waTemplateName
 * → version email enregistrée pour ce template WhatsApp.
 * 404 / introuvable → { found: false, subject: "", html: "" }.
 */
export async function fetchEmailTemplateMapping(
  waTemplateName: string,
  signal?: AbortSignal,
): Promise<EmailTemplateMapping> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const name = waTemplateName.trim();
  if (!name) {
    return { waTemplateName: "", subject: "", html: "", found: false };
  }

  const res = await fetch(
    `${base}/email/templates/${encodeURIComponent(name)}`,
    {
      method: "GET",
      headers: buildAuthHeaders(),
      credentials: "include",
      cache: "no-store",
      signal,
    },
  );

  if (res.status === 404) {
    return { waTemplateName: name, subject: "", html: "", found: false };
  }
  if (!res.ok) {
    return parseBackendApiError(res, `GET /email/templates/${name}`);
  }

  const raw = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!raw || typeof raw !== "object") {
    return { waTemplateName: name, subject: "", html: "", found: false };
  }

  const subject = String(raw.subject ?? raw.title ?? "").trim();
  const html = String(raw.html ?? raw.body ?? raw.content ?? "").trim();
  const found =
    raw.found === true ||
    Boolean(subject || html) ||
    raw.exists === true;

  return {
    waTemplateName: name,
    subject,
    html,
    found: found && Boolean(subject || html),
  };
}

/**
 * PUT /email/templates/:waTemplateName
 * Body: { subject, html }
 * → enregistre la version email par défaut pour ce template WA.
 */
export async function saveEmailTemplateMapping(
  waTemplateName: string,
  payload: { subject: string; html: string },
): Promise<EmailTemplateMapping> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const name = waTemplateName.trim();
  if (!name) throw new Error("Nom du template WhatsApp manquant.");

  const subject = payload.subject.trim();
  const html = payload.html.trim();
  if (!subject) throw new Error("Le sujet est obligatoire.");
  if (!html) throw new Error("Le corps de l'email est obligatoire.");

  const res = await fetch(
    `${base}/email/templates/${encodeURIComponent(name)}`,
    {
      method: "PUT",
      headers: buildAuthHeaders(),
      credentials: "include",
      body: JSON.stringify({ subject, html }),
    },
  );

  if (!res.ok) {
    return parseBackendApiError(res, `PUT /email/templates/${name}`);
  }

  const raw = (await res.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  return {
    waTemplateName: name,
    subject:
      typeof raw?.subject === "string" && raw.subject.trim()
        ? raw.subject.trim()
        : subject,
    html:
      typeof raw?.html === "string" && raw.html.trim()
        ? raw.html.trim()
        : typeof raw?.body === "string" && raw.body.trim()
          ? raw.body.trim()
          : html,
    found: true,
  };
}

/**
 * POST /email/broadcast
 * Body: { subject, html, recipients: [{ email, name }], templateId?, templateName? }
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

  const body: Record<string, unknown> = { subject, html, recipients };
  if (payload.templateId?.trim()) body.templateId = payload.templateId.trim();
  if (payload.templateName?.trim()) body.templateName = payload.templateName.trim();

  const res = await fetch(`${base}/email/broadcast`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return parseBackendApiError(res, "POST /email/broadcast");
  }

  const raw = await res.json().catch(() => null);
  return parseBroadcastResult(raw, recipients.length);
}
