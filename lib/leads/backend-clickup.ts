import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";

export type ClickUpSyncResult = {
  ok: boolean;
  synced: number;
};

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

/** Déclenche une synchronisation manuelle ClickUp → Supabase (admin uniquement côté API). */
export async function syncClickUpLeads(): Promise<ClickUpSyncResult> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/clickup/sync`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) return parseApiError(res, "POST /clickup/sync");

  const raw = (await res.json().catch(() => null)) as unknown;
  if (!raw || typeof raw !== "object") {
    throw new Error("Réponse de synchronisation invalide.");
  }

  const data = raw as { ok?: unknown; synced?: unknown };
  return {
    ok: data.ok === true,
    synced: typeof data.synced === "number" ? data.synced : 0,
  };
}
