import { extractPhoneFromLeadText } from "./phone-extract";

export type ClickUpLead = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  list_id: string | null;
  list_name: string;
  created_at: string;
};

export type LeadListOption = {
  listId: string;
  label: string;
  total: number;
};

export type LeadStatusOption = {
  value: string;
  total: number;
};

export type LeadsFilters = {
  lists: LeadListOption[];
  statuses: LeadStatusOption[];
  /** @deprecated use lists */
  listNames?: string[];
};

export type LeadsApiResponse = {
  leads: ClickUpLead[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters?: LeadsFilters;
};

export function mapClickUpLeadRow(row: Record<string, unknown>): ClickUpLead {
  const name = String(row.name ?? row.full_name ?? row.lead_name ?? "").trim();
  const phoneRaw = row.phone ?? row.phone_number ?? row.telephone ?? null;
  let phone = phoneRaw == null || phoneRaw === "" ? null : String(phoneRaw).trim();

  if (!phone && name) {
    phone = extractPhoneFromLeadText(name);
  }

  const listIdRaw = row.list_id ?? row.listId ?? null;
  const listId =
    listIdRaw == null || listIdRaw === "" ? null : String(listIdRaw).trim();

  return {
    id: String(row.id ?? ""),
    name,
    phone,
    status: String(row.status ?? "unknown").trim() || "unknown",
    list_id: listId,
    list_name: String(row.list_name ?? row.listName ?? "").trim(),
    created_at: String(row.created_at ?? row.createdAt ?? ""),
  };
}

export function parseLeadsFilterOptions(raw: unknown): LeadsFilters {
  const empty: LeadsFilters = { lists: [], statuses: [] };
  if (!raw || typeof raw !== "object") return empty;

  const data = raw as {
    lists?: unknown;
    statuses?: unknown;
  };

  const lists: LeadListOption[] = [];
  if (Array.isArray(data.lists)) {
    for (const item of data.lists) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const listId = String(row.list_id ?? row.listId ?? "").trim();
      const label = String(row.label ?? row.list_name ?? row.listName ?? "").trim();
      const total = typeof row.total === "number" ? row.total : Number(row.total) || 0;
      if (!listId || !label) continue;
      lists.push({ listId, label, total });
    }
  }

  const statuses: LeadStatusOption[] = [];
  if (Array.isArray(data.statuses)) {
    for (const item of data.statuses) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const value = String(row.value ?? row.status ?? "").trim();
      const total = typeof row.total === "number" ? row.total : Number(row.total) || 0;
      if (!value) continue;
      statuses.push({ value, total });
    }
  }

  lists.sort((a, b) => a.label.localeCompare(b.label, "fr"));
  statuses.sort((a, b) => a.value.localeCompare(b.value, "fr"));

  return { lists, statuses };
}
