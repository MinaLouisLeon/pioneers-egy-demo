import { createSupabaseBrowserClient } from "@pioneers/supabase/browser";

/**
 * Memoised browser client. `createBrowserClient` is cheap but each instance
 * registers its own auth listener, so sharing one avoids duplicate refreshes
 * across components.
 */
let client: ReturnType<typeof createSupabaseBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  client ??= createSupabaseBrowserClient();
  return client;
}
