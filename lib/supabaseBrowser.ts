import { createClient } from "@supabase/supabase-js";

export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // IMPORTANT: do not throw here (build-time safety)
  if (!url || !key) return null;

  return createClient(url, key);
}
