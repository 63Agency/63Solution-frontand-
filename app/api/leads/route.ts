import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/client";
import { mapClickUpLeadRow } from "@/lib/leads/types";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const listName = searchParams.get("list_name")?.trim() || null;
    const statuses = parseStatuses(searchParams.get("status"));

    const supabase = createSupabaseClient();

    let query = supabase
      .from("clickup_leads")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

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
      total: count ?? leads.length,
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
