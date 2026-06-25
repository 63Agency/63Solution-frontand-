const DRAFT_KEY = "bulk-send-draft";
const PENDING_IMPORT_KEY = "bulk-send-pending-import";

export type BulkSendDraft = {
  phonesRaw: string;
  message: string;
  leadsImportCount: number;
};

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
    return {
      phonesRaw: parsed.phonesRaw,
      message: parsed.message,
      leadsImportCount:
        typeof parsed.leadsImportCount === "number" ? parsed.leadsImportCount : 0,
    };
  } catch {
    return null;
  }
}

export function stashBulkSendImport(phones: string[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_IMPORT_KEY, JSON.stringify(phones));
}

export function consumeBulkSendImport(): string[] | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PENDING_IMPORT_KEY);
  sessionStorage.removeItem(PENDING_IMPORT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return null;
  }
}

export const BULK_SEND_PATH = "/dashboard/conversations/envoi-multiple";
export const BULK_SEND_IMPORT_PATH = "/dashboard/conversations/envoi-multiple/import-leads";
