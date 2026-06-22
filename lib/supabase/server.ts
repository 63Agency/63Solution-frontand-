import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Server-only — used by API routes; never import from client components. */
export const createSupabaseServerClient = () => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase server environment variables (SUPABASE_SERVICE_ROLE_KEY)");
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
