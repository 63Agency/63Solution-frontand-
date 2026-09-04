const DRAFT_KEY = "bulk-send-draft";
const PENDING_IMPORT_KEY = "bulk-send-pending-import";

export type BulkSendSendMode = "text" | "template";

/** Contact importé depuis les Leads (téléphone et/ou email). */
export type BulkSendImportContact = {
  phone: string;
  name: string;
  email?: string;
};

export type BulkSendDraft = {
  phonesRaw: string;
  message: string;
  leadsImportCount: number;
  sendMode?: BulkSendSendMode;
  selectedTemplateId?: string;
  /** Noms des leads importés, clé = chiffres normalisés du téléphone. */
  contactNamesByPhone?: Record<string, string>;
  /** Emails des leads, clé = chiffres normalisés du téléphone. */
  contactEmailsByPhone?: Record<string, string>;
  /** Contacts email-only (pas de téléphone valide). */
  emailOnlyContacts?: Array<{ email: string; name: string }>;
};

function normalizePhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `212${digits.slice(1)}`;
  }
  return digits;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  const email = normalizeEmail(value);
  return email.includes("@") && email.includes(".");
}

function parsePhonesRaw(raw: string): string[] {
  const parts = raw
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const digits = normalizePhoneDigits(part);
    if (digits.length < 9) continue;
    if (seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
  }
  return out;
}

function parseStringMap(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

/** Fusionne des contacts importés dans un brouillon (téléphones + noms + emails). */
export function mergeContactsIntoDraft(
  draft: BulkSendDraft,
  contacts: BulkSendImportContact[],
): { draft: BulkSendDraft; added: number } {
  const current = parsePhonesRaw(draft.phonesRaw);
  const seenPhones = new Set(current);
  const names: Record<string, string> = { ...(draft.contactNamesByPhone ?? {}) };
  const emails: Record<string, string> = { ...(draft.contactEmailsByPhone ?? {}) };
  const emailOnly = [...(draft.emailOnlyContacts ?? [])];
  const seenEmails = new Set(
    emailOnly.map((c) => normalizeEmail(c.email)).filter(Boolean),
  );
  for (const email of Object.values(emails)) {
    if (email) seenEmails.add(normalizeEmail(email));
  }

  const addedPhones: string[] = [];
  let addedEmailOnly = 0;

  for (const contact of contacts) {
    const digits = normalizePhoneDigits(contact.phone ?? "");
    const name = contact.name.trim();
    const email =
      typeof contact.email === "string" && isValidEmail(contact.email)
        ? normalizeEmail(contact.email)
        : "";

    if (digits.length >= 9) {
      if (name) names[digits] = name;
      if (email) emails[digits] = email;
      if (!seenPhones.has(digits)) {
        seenPhones.add(digits);
        addedPhones.push(digits);
      }
      continue;
    }

    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      emailOnly.push({ email, name: name || email.split("@")[0] || "Client" });
      addedEmailOnly += 1;
    }
  }

  const added = addedPhones.length + addedEmailOnly;

  return {
    added,
    draft: {
      ...draft,
      phonesRaw:
        addedPhones.length > 0
          ? [...current, ...addedPhones].join("\n")
          : draft.phonesRaw,
      leadsImportCount: draft.leadsImportCount + added,
      contactNamesByPhone: names,
      contactEmailsByPhone: emails,
      emailOnlyContacts: emailOnly,
    },
  };
}

export function saveBulkSendDraft(draft: BulkSendDraft): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadBulkSendDraft(): BulkSendDraft | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BulkSendDraft;
    if (typeof parsed.phonesRaw !== "string" || typeof parsed.message !== "string")
      return null;
    const sendMode =
      parsed.sendMode === "template" || parsed.sendMode === "text"
        ? parsed.sendMode
        : "text";

    const emailOnlyContacts = Array.isArray(parsed.emailOnlyContacts)
      ? parsed.emailOnlyContacts
          .filter(
            (row): row is { email: string; name: string } =>
              !!row &&
              typeof row === "object" &&
              typeof row.email === "string" &&
              isValidEmail(row.email),
          )
          .map((row) => ({
            email: normalizeEmail(row.email),
            name:
              typeof row.name === "string" && row.name.trim()
                ? row.name.trim()
                : row.email.split("@")[0] || "Client",
          }))
      : undefined;

    return {
      phonesRaw: parsed.phonesRaw,
      message: parsed.message,
      leadsImportCount:
        typeof parsed.leadsImportCount === "number" ? parsed.leadsImportCount : 0,
      sendMode,
      selectedTemplateId:
        typeof parsed.selectedTemplateId === "string"
          ? parsed.selectedTemplateId
          : undefined,
      contactNamesByPhone: parseStringMap(parsed.contactNamesByPhone),
      contactEmailsByPhone: parseStringMap(parsed.contactEmailsByPhone),
      emailOnlyContacts,
    };
  } catch {
    return null;
  }
}

function emptyDraft(): BulkSendDraft {
  return {
    phonesRaw: "",
    message: "",
    leadsImportCount: 0,
    sendMode: "text",
    contactNamesByPhone: {},
    contactEmailsByPhone: {},
    emailOnlyContacts: [],
  };
}

/**
 * Enregistre les contacts à importer ET les fusionne immédiatement dans le brouillon.
 */
export function stashBulkSendImport(contacts: BulkSendImportContact[]): number {
  if (typeof window === "undefined") return 0;
  sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(contacts));

  const base = loadBulkSendDraft() ?? emptyDraft();
  const { draft, added } = mergeContactsIntoDraft(base, contacts);
  saveBulkSendDraft(draft);
  return added;
}

/**
 * Lit et consomme le pending import (pour toast / double-check).
 */
export function consumeBulkSendImport(): BulkSendImportContact[] | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
  sessionStorage.removeItem(PENDING_IMPORT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;

    const contacts: BulkSendImportContact[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        const phone = item.trim();
        if (phone) contacts.push({ phone, name: "" });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const row = item as { phone?: unknown; name?: unknown; email?: unknown };
      const phone = typeof row.phone === "string" ? row.phone.trim() : "";
      const email = typeof row.email === "string" ? row.email.trim() : "";
      if (!phone && !email) continue;
      contacts.push({
        phone,
        name: typeof row.name === "string" ? row.name.trim() : "",
        ...(email ? { email } : {}),
      });
    }
    return contacts.length > 0 ? contacts : null;
  } catch {
    return null;
  }
}

export const BULK_SEND_PATH = "/dashboard/conversations/envoi-multiple";
export const BULK_SEND_IMPORT_PATH =
  "/dashboard/conversations/envoi-multiple/import-leads";

/** Prépare l'écran Envoi multiple pour un contact (mode template). */
export function prepareBulkSendForContact(
  phone: string,
  contactName?: string,
  contactEmail?: string,
): void {
  if (typeof window === "undefined") return;
  const digits = normalizePhoneDigits(phone);
  const names: Record<string, string> = {};
  const emails: Record<string, string> = {};
  const name = contactName?.trim();
  const email =
    contactEmail && isValidEmail(contactEmail)
      ? normalizeEmail(contactEmail)
      : "";
  if (name && digits.length >= 9) names[digits] = name;
  if (email && digits.length >= 9) emails[digits] = email;
  saveBulkSendDraft({
    phonesRaw: digits,
    message: "",
    leadsImportCount: 0,
    sendMode: "template",
    contactNamesByPhone: names,
    contactEmailsByPhone: emails,
    emailOnlyContacts: [],
  });
}
