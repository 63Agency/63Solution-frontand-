import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseLeadsFilterOptions, type LeadsFilters } from "./types";

export async function fetchLeadsFilterOptionsFromRpc(): Promise<{
  filters: LeadsFilters;
  raw: unknown;
}> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_leads_filter_options");

  if (error) {
    throw new Error(error.message || "get_leads_filter_options RPC failed");
  }

  console.log("[leads] RPC options", JSON.stringify(data));

  const filters = parseLeadsFilterOptions(data);
  console.log(
    "[leads] options out",
    filters.lists.length,
    filters.statuses.length,
  );

  return { filters, raw: data };
}
