import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Service-role client. **Bypasses RLS entirely.**
 *
 * Only ever construct this inside a route handler that has already verified the
 * caller is an admin, or inside the public certificate-verify route where the
 * token itself is the credential. Never import this into a client component —
 * `SUPABASE_SERVICE_ROLE_KEY` is server-only and has no NEXT_PUBLIC_ prefix, so
 * importing it in the browser bundle would throw at build time rather than leak.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — required for admin operations.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
