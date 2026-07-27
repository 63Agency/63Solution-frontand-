import {
  fetchBackendLeadById,
  fetchBackendLeads,
  fetchBackendLeadsMeta,
  fetchBackendLeadsStats,
  metaToFilters,
  syncBackendLeads,
} from "./backend-leads";
import type { ClickUpLead, LeadsApiResponse, LeadsMeta, LeadsStats } from "./types";

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

export async function fetchLeadsMeta(signal?: AbortSignal): Promise<LeadsMeta> {
  return fetchBackendLeadsMeta(signal);
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

/** Charge tous les leads avec téléphone via GET /leads (pagination auto). */
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
    const meta = await fetchBackendLeadsMeta(signal);
    filters = metaToFilters(meta);
  } catch {
    filters = { lists: [], statuses: [] };
  }

  return {
    leads: allLeads.filter((lead) => lead.phone?.trim()),
    filters,
  };
}

export { metaToFilters };
