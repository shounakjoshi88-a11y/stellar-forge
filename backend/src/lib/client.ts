import { createClient } from "@supabase/supabase-js";

export function createSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_API_SECRET;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_API_SECRET must be set in backend/.env");
  }
  return createClient(url, key);
}
