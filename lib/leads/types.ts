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
  total?: number;
};

export type LeadStatusOption = {
  value: string;
  total?: number;
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
  limit: number;
  offset: number;
  totalPages: number;
  filters?: LeadsFilters;
};

export type LeadsMeta = {
  statuses: string[];
  lists: { id: string; name: string }[];
};

export type LeadsStats = {
  total: number;
  byStatus: Record<string, number>;
};

export type LeadsSyncResult = {
  ok: boolean;
  synced: number;
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

export function parseLeadsMeta(raw: unknown): LeadsMeta {
  const empty: LeadsMeta = { statuses: [], lists: [] };
  if (!raw || typeof raw !== "object") return empty;

  const data = raw as { statuses?: unknown; lists?: unknown };
  const statuses = Array.isArray(data.statuses)
    ? data.statuses
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];

  const lists: LeadsMeta["lists"] = [];
  if (Array.isArray(data.lists)) {
    for (const item of data.lists) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? row.listId ?? row.list_id ?? "").trim();
      const name = String(row.name ?? row.label ?? row.list_name ?? row.listName ?? "").trim();
      if (!id || !name) continue;
      lists.push({ id, name });
    }
  }

  statuses.sort((a, b) => a.localeCompare(b, "fr"));
  lists.sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return { statuses, lists };
}

export function metaToFilters(meta: LeadsMeta, stats?: LeadsStats | null): LeadsFilters {
  return {
    lists: meta.lists.map((list) => ({
      listId: list.id,
      label: list.name,
    })),
    statuses: meta.statuses.map((value) => ({
      value,
      total: stats?.byStatus[value],
    })),
  };
}

export function parseLeadsStats(raw: unknown): LeadsStats {
  if (!raw || typeof raw !== "object") {
    return { total: 0, byStatus: {} };
  }
  const data = raw as { total?: unknown; byStatus?: unknown; by_status?: unknown };
  const total = typeof data.total === "number" ? data.total : Number(data.total) || 0;
  const byStatusRaw = data.byStatus ?? data.by_status;
  const byStatus: Record<string, number> = {};
  if (byStatusRaw && typeof byStatusRaw === "object") {
    for (const [key, value] of Object.entries(byStatusRaw as Record<string, unknown>)) {
      const count = typeof value === "number" ? value : Number(value) || 0;
      if (key.trim()) byStatus[key.trim()] = count;
    }
  }
  return { total, byStatus };
}

/** @deprecated Préférer parseLeadsMeta */
export function parseLeadsFilterOptions(raw: unknown): LeadsFilters {
  const meta = parseLeadsMeta(raw);
  return metaToFilters(meta);
}
