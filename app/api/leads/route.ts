import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapClickUpLeadRow, parseLeadsFilterOptions } from "@/lib/leads/types";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_IMPORT_PAGE_SIZE = 500;

function parseHasPhone(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

function parsePageSize(raw: string | null, hasPhone: boolean): number {
  const defaultSize = hasPhone ? MAX_IMPORT_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const maxSize = hasPhone ? MAX_IMPORT_PAGE_SIZE : MAX_PAGE_SIZE;
  const value = Number.parseInt(raw ?? String(defaultSize), 10);
  if (!Number.isFinite(value) || value < 1) return defaultSize;
  return Math.min(value, maxSize);
}

function parseStatuses(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parsePage(raw: string | null): number {
  const value = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const listId =
      searchParams.get("list_id")?.trim() ||
      searchParams.get("listId")?.trim() ||
      null;
    const statuses = parseStatuses(searchParams.get("status"));
    const hasPhone = parseHasPhone(searchParams.get("has_phone"));
    const page = parsePage(searchParams.get("page"));
    const pageSize = parsePageSize(searchParams.get("page_size"), hasPhone);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createSupabaseServerClient();

    let query = supabase
      .from("clickup_leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (listId) {
      query = query.eq("list_id", listId);
    }

    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }

    if (hasPhone) {
      query = query.or(
        "phone.neq.,name.ilike.%📞%,name.ilike.%+212%,name.ilike.%+32%,name.ilike.%06%,name.ilike.%07%",
      );
    }

    const [{ data, error, count }, filterRpc] = await Promise.all([
      query,
      supabase.rpc("get_leads_filter_options"),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (filterRpc.error) {
      console.error("[leads] get_leads_filter_options failed:", filterRpc.error.message);
      return NextResponse.json(
        { error: filterRpc.error.message || "Filter options RPC failed" },
        { status: 500 },
      );
    }

    let leads = (data ?? []).map((row) => mapClickUpLeadRow(row as Record<string, unknown>));

    if (hasPhone) {
      leads = leads.filter((lead) => lead.phone?.trim());
    }

    const total = count ?? leads.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filters = parseLeadsFilterOptions(filterRpc.data);

    console.log(
      `[leads] filter options: lists=${filters.lists.length} statuses=${filters.statuses.length}`,
    );

    return NextResponse.json({
      leads,
      total,
      page,
      pageSize,
      totalPages,
      filters,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while fetching leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
