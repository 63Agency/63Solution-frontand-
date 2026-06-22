import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapClickUpLeadRow } from "@/lib/leads/types";

const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 100;

function parseStatuses(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueSorted(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
}

function parsePage(raw: string | null): number {
  const value = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

function parsePageSize(raw: string | null): number {
  const value = Number.parseInt(raw ?? String(DEFAULT_PAGE_SIZE), 10);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(value, MAX_PAGE_SIZE);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const listName = searchParams.get("list_name")?.trim() || null;
    const statuses = parseStatuses(searchParams.get("status"));
    const page = parsePage(searchParams.get("page"));
    const pageSize = parsePageSize(searchParams.get("page_size"));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const supabase = createSupabaseServerClient();

    let query = supabase
      .from("clickup_leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (listName) {
      query = query.eq("list_name", listName);
    }

    if (statuses.length === 1) {
      query = query.eq("status", statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in("status", statuses);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const leads = (data ?? []).map((row) => mapClickUpLeadRow(row as Record<string, unknown>));

    const total = count ?? leads.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const [{ data: listRows, error: listError }, { data: statusRows, error: statusError }] =
      await Promise.all([
        supabase.from("clickup_leads").select("list_name"),
        supabase.from("clickup_leads").select("status"),
      ]);

    if (listError || statusError) {
      return NextResponse.json(
        { error: listError?.message ?? statusError?.message ?? "Filter query failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      leads,
      total,
      page,
      pageSize,
      totalPages,
      filters: {
        listNames: uniqueSorted((listRows ?? []).map((row) => row.list_name)),
        statuses: uniqueSorted((statusRows ?? []).map((row) => row.status)),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while fetching leads.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
