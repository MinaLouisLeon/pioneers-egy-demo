import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

export type PioneersSupabaseClient = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Supabase client for React client components.
 *
 * Sessions live in cookies (not localStorage) so the same session is readable
 * by server components, route handlers, and middleware.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.",
    );
  }

  return createBrowserClient<Database>(url, key);
}
