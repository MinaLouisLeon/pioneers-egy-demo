import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@pioneers/supabase/server";

/**
 * Supabase client bound to the request's cookies.
 *
 * `cookies()` is async from Next 15 onwards, so every caller must await this.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createSupabaseServerClient(cookieStore);
}
