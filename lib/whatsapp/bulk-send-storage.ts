const DRAFT_KEY = "bulk-send-draft";
const PENDING_IMPORT_KEY = "bulk-send-pending-import";

export type BulkSendSendMode = "text" | "template";

/** Contact importé depuis les Leads (téléphone + nom pour les variables template). */
export type BulkSendImportContact = {
  phone: string;
  name: string;
};

export type BulkSendDraft = {
  phonesRaw: string;
  message: string;
  leadsImportCount: number;
  sendMode?: BulkSendSendMode;
  selectedTemplateId?: string;
  /** Noms des leads importés, clé = chiffres normalisés du téléphone. */
  contactNamesByPhone?: Record<string, string>;
};

function normalizePhoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("0")) {
    digits = `212${digits.slice(1)}`;
  }
  return digits;
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

/** Fusionne des contacts importés dans un brouillon (téléphones + noms). */
export function mergeContactsIntoDraft(
  draft: BulkSendDraft,
  contacts: BulkSendImportContact[],
): { draft: BulkSendDraft; added: number } {
  const current = parsePhonesRaw(draft.phonesRaw);
  const seen = new Set(current);
  const names: Record<string, string> = { ...(draft.contactNamesByPhone ?? {}) };
  const addedPhones: string[] = [];

  for (const contact of contacts) {
    const digits = normalizePhoneDigits(contact.phone);
    if (digits.length < 9) continue;
    const name = contact.name.trim();
    if (name) names[digits] = name;
    if (seen.has(digits)) continue;
    seen.add(digits);
    addedPhones.push(digits);
  }

  return {
    added: addedPhones.length,
    draft: {
      ...draft,
      phonesRaw:
        addedPhones.length > 0 ? [...current, ...addedPhones].join("\n") : draft.phonesRaw,
      leadsImportCount: draft.leadsImportCount + addedPhones.length,
      contactNamesByPhone: names,
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
    if (typeof parsed.phonesRaw !== "string" || typeof parsed.message !== "string") return null;
    const sendMode =
      parsed.sendMode === "template" || parsed.sendMode === "text"
        ? parsed.sendMode
        : "text";

    const contactNamesByPhone =
      parsed.contactNamesByPhone &&
      typeof parsed.contactNamesByPhone === "object" &&
      !Array.isArray(parsed.contactNamesByPhone)
        ? Object.fromEntries(
            Object.entries(parsed.contactNamesByPhone).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
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
      contactNamesByPhone,
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
  };
}

/**
 * Enregistre les contacts à importer ET les fusionne immédiatement dans le brouillon.
 * Le merge draft évite la perte de données si React Strict Mode invoque 2× le mount effect
 * (consume destructif + rechargement d’un ancien brouillon vide).
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
 * Les numéros sont déjà dans le brouillon après `stashBulkSendImport`.
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
      // Ancien format : string[] de téléphones uniquement
      if (typeof item === "string") {
        const phone = item.trim();
        if (phone) contacts.push({ phone, name: "" });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const row = item as { phone?: unknown; name?: unknown };
      if (typeof row.phone !== "string" || !row.phone.trim()) continue;
      contacts.push({
        phone: row.phone.trim(),
        name: typeof row.name === "string" ? row.name.trim() : "",
      });
    }
    return contacts.length > 0 ? contacts : null;
  } catch {
    return null;
  }
}

export const BULK_SEND_PATH = "/dashboard/conversations/envoi-multiple";
export const BULK_SEND_IMPORT_PATH = "/dashboard/conversations/envoi-multiple/import-leads";
