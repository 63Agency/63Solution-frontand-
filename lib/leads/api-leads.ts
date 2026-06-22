import type { LeadsApiResponse } from "./types";

export type FetchLeadsParams = {
  listName?: string | null;
  statuses?: string[];
  signal?: AbortSignal;
};

export async function fetchLeads({
  listName,
  statuses = [],
  signal,
}: FetchLeadsParams = {}): Promise<LeadsApiResponse> {
  const params = new URLSearchParams();

  if (listName?.trim()) {
    params.set("list_name", listName.trim());
  }

  if (statuses.length > 0) {
    params.set("status", statuses.join(","));
  }

  const qs = params.toString();
  const url = qs ? `/api/leads?${qs}` : "/api/leads";

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Impossible de charger les leads (${res.status}).`);
  }

  return (await res.json()) as LeadsApiResponse;
}
