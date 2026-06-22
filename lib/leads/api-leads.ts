import type { LeadsApiResponse } from "./types";

export const LEADS_PER_PAGE = 15;

export type FetchLeadsParams = {
  listName?: string | null;
  statuses?: string[];
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
};

export async function fetchLeads({
  listName,
  statuses = [],
  page = 1,
  pageSize = LEADS_PER_PAGE,
  signal,
}: FetchLeadsParams = {}): Promise<LeadsApiResponse> {
  const params = new URLSearchParams();

  if (listName?.trim()) {
    params.set("list_name", listName.trim());
  }

  if (statuses.length > 0) {
    params.set("status", statuses.join(","));
  }

  params.set("page", String(Math.max(1, page)));
  params.set("page_size", String(pageSize));

  const url = `/api/leads?${params.toString()}`;

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
