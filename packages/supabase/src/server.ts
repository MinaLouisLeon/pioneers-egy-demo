import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/** Minimal shape of Next.js' `cookies()` store that we actually depend on. */
export type CookieStore = {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
};

/**
 * Supabase client for React Server Components, server actions and route
 * handlers.
 *
 * `setAll` is wrapped in try/catch because Server Components are not allowed to
 * mutate cookies. That is safe here: `middleware.ts` refreshes the session on
 * every request, so a refresh dropped in an RSC render is always re-applied on
 * the next navigation.
 */
export function createSupabaseServerClient(cookieStore: CookieStore) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.",
    );
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — see note above.
        }
      },
    },
  });
}

/**
 * Client bound to a bearer token instead of cookies. Used by route handlers
 * serving the Expo app, which authenticates with an Authorization header.
 *
 * RLS still applies: the token is passed through as the request's JWT.
 */
export function createSupabaseBearerClient(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createServerClient<Database>(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
