import { NextResponse } from "next/server";
import { fetchLeadsFilterOptionsFromRpc } from "@/lib/leads/rpc-filter-options";

/** GET /api/leads/meta — options de filtres via RPC Supabase (source de vérité). */
export async function GET() {
  try {
    const { filters } = await fetchLeadsFilterOptionsFromRpc();
    return NextResponse.json(filters);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error while fetching lead meta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
