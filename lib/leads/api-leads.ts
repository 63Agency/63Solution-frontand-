import type { ClickUpLead, LeadsApiResponse } from "./types";

export const LEADS_PER_PAGE = 15;
export const LEADS_IMPORT_PAGE_SIZE = 500;

export type FetchLeadsParams = {
  listName?: string | null;
  statuses?: string[];
  hasPhone?: boolean;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
};

export type FetchLeadsForImportParams = {
  listName?: string | null;
  status?: string | null;
  signal?: AbortSignal;
};

export async function fetchLeads({
  listName,
  statuses = [],
  hasPhone = false,
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

  if (hasPhone) {
    params.set("has_phone", "1");
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

/** Charge tous les leads avec téléphone (pagination automatique). */
export async function fetchLeadsForImport({
  listName = null,
  status = null,
  signal,
}: FetchLeadsForImportParams = {}): Promise<{
  leads: ClickUpLead[];
  filters: LeadsApiResponse["filters"];
}> {
  const statuses = status?.trim() ? [status.trim()] : [];
  const first = await fetchLeads({
    listName,
    statuses,
    hasPhone: true,
    page: 1,
    pageSize: LEADS_IMPORT_PAGE_SIZE,
    signal,
  });

  const allLeads = [...first.leads];
  const filters = first.filters;

  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await fetchLeads({
      listName,
      statuses,
      hasPhone: true,
      page,
      pageSize: LEADS_IMPORT_PAGE_SIZE,
      signal,
    });
    allLeads.push(...next.leads);
  }

  return {
    leads: allLeads.filter((lead) => lead.phone?.trim()),
    filters,
  };
}
