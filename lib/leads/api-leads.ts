import {
  fetchBackendLeadById,
  fetchBackendLeads,
  fetchBackendLeadsStats,
  syncBackendLeads,
} from "./backend-leads";
import type { ClickUpLead, LeadsApiResponse, LeadsFilters, LeadsMeta, LeadsStats } from "./types";

export const LEADS_PER_PAGE = 25;
export const LEADS_IMPORT_PAGE_SIZE = 500;

export type FetchLeadsParams = {
  listId?: string | null;
  statuses?: string[];
  search?: string | null;
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
};

export type FetchLeadsForImportParams = {
  listId?: string | null;
  status?: string | null;
  signal?: AbortSignal;
};

export async function fetchLeads({
  listId = null,
  statuses = [],
  search = null,
  page = 1,
  pageSize = LEADS_PER_PAGE,
  signal,
}: FetchLeadsParams = {}): Promise<LeadsApiResponse> {
  const limit = pageSize;
  const offset = (Math.max(1, page) - 1) * limit;
  return fetchBackendLeads({
    listId,
    statuses,
    search,
    limit,
    offset,
    signal,
  });
}

export async function fetchLeadsFilters(signal?: AbortSignal): Promise<LeadsFilters> {
  const res = await fetch("/api/leads/meta", {
    method: "GET",
    cache: "no-store",
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Impossible de charger les filtres leads (${res.status}).`);
  }

  return (await res.json()) as LeadsFilters;
}

export async function fetchLeadsMeta(signal?: AbortSignal): Promise<LeadsMeta> {
  const filters = await fetchLeadsFilters(signal);
  return {
    statuses: filters.statuses.map((status) => status.value),
    lists: filters.lists.map((list) => ({
      id: list.listId,
      name: list.label,
      total: list.total,
    })),
  };
}

export async function fetchLeadsStats(signal?: AbortSignal): Promise<LeadsStats> {
  return fetchBackendLeadsStats(signal);
}

export async function syncLeads() {
  return syncBackendLeads();
}

/** GET /leads/:id */
export async function fetchLeadById(id: string, signal?: AbortSignal): Promise<ClickUpLead> {
  return fetchBackendLeadById(id, signal);
}

/** Charge tous les leads avec téléphone ou email via GET /leads (pagination auto). */
export async function fetchLeadsForImport({
  listId = null,
  status = null,
  signal,
}: FetchLeadsForImportParams = {}): Promise<{
  leads: ClickUpLead[];
  filters: LeadsApiResponse["filters"];
}> {
  const statuses = status?.trim() ? [status.trim()] : [];
  const allLeads: ClickUpLead[] = [];
  let offset = 0;
  let total = Infinity;
  let filters: LeadsApiResponse["filters"];

  while (offset < total) {
    const batch = await fetchBackendLeads({
      listId,
      statuses,
      limit: LEADS_IMPORT_PAGE_SIZE,
      offset,
      signal,
    });
    allLeads.push(...batch.leads);
    total = batch.total;
    offset += batch.leads.length;
    if (batch.leads.length === 0) break;
  }

  try {
    filters = await fetchLeadsFilters(signal);
  } catch {
    filters = { lists: [], statuses: [] };
  }

  return {
    leads: allLeads.filter(
      (lead) => lead.phone?.trim() || lead.email?.trim(),
    ),
    filters,
  };
}
