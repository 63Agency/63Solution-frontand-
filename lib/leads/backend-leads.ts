import { getApiBaseUrl, getStoredAccessToken } from "../auth/backend-login";
import { parseBackendApiError } from "../auth/api-errors";
import {
  mapClickUpLeadRow,
  metaToFilters,
  parseLeadsMeta,
  parseLeadsStats,
  type ClickUpLead,
  type LeadsApiResponse,
  type LeadsMeta,
  type LeadsStats,
  type LeadsSyncResult,
} from "./types";

function buildAuthHeaders(): Record<string, string> {
  const token = getStoredAccessToken();
  if (!token) throw new Error("Session expirée. Reconnecte-toi.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

function parseLeadsListResponse(raw: unknown, limit: number, offset: number): LeadsApiResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("Réponse leads invalide.");
  }

  const data = raw as Record<string, unknown>;
  const rows = Array.isArray(data.leads)
    ? data.leads
    : Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.data)
        ? data.data
        : [];

  const resolvedLimit =
    typeof data.limit === "number"
      ? data.limit
      : Number(data.limit) || limit;
  const resolvedOffset =
    typeof data.offset === "number"
      ? data.offset
      : Number(data.offset) || offset;
  const total =
    typeof data.total === "number" ? data.total : Number(data.total) || rows.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, resolvedLimit)));

  return {
    leads: rows.map((row) => mapClickUpLeadRow(row as Record<string, unknown>)),
    total,
    limit: resolvedLimit,
    offset: resolvedOffset,
    totalPages,
  };
}

export type FetchBackendLeadsParams = {
  listId?: string | null;
  statuses?: string[];
  search?: string | null;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

/** GET /leads?status=&listId=&search=&limit=&offset= */
export async function fetchBackendLeads({
  listId = null,
  statuses = [],
  search = null,
  limit = 25,
  offset = 0,
  signal,
}: FetchBackendLeadsParams = {}): Promise<LeadsApiResponse> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const params = new URLSearchParams();
  const resolvedListId = listId?.trim() || null;
  if (resolvedListId) params.set("listId", resolvedListId);
  if (statuses.length > 0) params.set("status", statuses.join(","));
  const trimmedSearch = search?.trim();
  if (trimmedSearch) params.set("search", trimmedSearch);
  params.set("limit", String(Math.max(1, limit)));
  params.set("offset", String(Math.max(0, offset)));

  const res = await fetch(`${base}/leads?${params.toString()}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!res.ok) return parseBackendApiError(res, "GET /leads");
  return parseLeadsListResponse(await res.json().catch(() => null), limit, offset);
}

/** GET /leads/:id */
export async function fetchBackendLeadById(
  id: string,
  signal?: AbortSignal,
): Promise<ClickUpLead> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");
  const trimmed = id.trim();
  if (!trimmed) throw new Error("Identifiant lead manquant.");

  const res = await fetch(`${base}/leads/${encodeURIComponent(trimmed)}`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!res.ok) return parseBackendApiError(res, `GET /leads/${trimmed}`);

  const raw = await res.json().catch(() => null);
  const row =
    raw && typeof raw === "object" && "lead" in (raw as object)
      ? (raw as { lead: unknown }).lead
      : raw;
  if (!row || typeof row !== "object") {
    throw new Error("Réponse lead invalide.");
  }
  return mapClickUpLeadRow(row as Record<string, unknown>);
}

/** GET /leads/meta → { statuses, lists } */
export async function fetchBackendLeadsMeta(signal?: AbortSignal): Promise<LeadsMeta> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/leads/meta`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!res.ok) return parseBackendApiError(res, "GET /leads/meta");
  return parseLeadsMeta(await res.json().catch(() => null));
}

/** GET /leads/stats → { total, byStatus } */
export async function fetchBackendLeadsStats(signal?: AbortSignal): Promise<LeadsStats> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/leads/stats`, {
    method: "GET",
    headers: buildAuthHeaders(),
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!res.ok) return parseBackendApiError(res, "GET /leads/stats");
  return parseLeadsStats(await res.json().catch(() => null));
}

/** POST /leads/sync (préféré) */
export async function syncBackendLeads(): Promise<LeadsSyncResult> {
  const base = getApiBaseUrl();
  if (!base) throw new Error("NEXT_PUBLIC_API_URL manquante.");

  const res = await fetch(`${base}/leads/sync`, {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
  });

  if (!res.ok) return parseBackendApiError(res, "POST /leads/sync");

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

export { metaToFilters };
