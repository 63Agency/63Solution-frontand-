export type ClickUpLead = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  list_name: string;
  created_at: string;
};

export type LeadsFilters = {
  listNames: string[];
  statuses: string[];
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
  const phoneRaw = row.phone ?? row.phone_number ?? row.telephone ?? null;

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? row.full_name ?? row.lead_name ?? "").trim(),
    phone: phoneRaw == null || phoneRaw === "" ? null : String(phoneRaw),
    status: String(row.status ?? "unknown").trim() || "unknown",
    list_name: String(row.list_name ?? row.listName ?? "").trim(),
    created_at: String(row.created_at ?? row.createdAt ?? ""),
  };
}
