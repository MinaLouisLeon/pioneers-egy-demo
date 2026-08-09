import { createClient, processLock, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Storage adapter contract — matches @react-native-async-storage/async-storage.
 * Injected rather than imported so this package stays free of native
 * dependencies and can still be type-checked in a Node/web context.
 */
export type NativeStorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type NativeSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client for the Expo app.
 *
 * - `storage` persists the session in AsyncStorage across app restarts.
 * - `detectSessionInUrl: false` — there is no URL bar to parse on native.
 * - `lock: processLock` serialises concurrent refreshes, which otherwise race
 *   when several screens mount at once.
 *
 * Call `startAutoRefresh()` / `stopAutoRefresh()` from an AppState listener;
 * see apps/mobile/lib/supabase.ts.
 */
export function createSupabaseNativeClient(storage: NativeStorageAdapter): NativeSupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.",
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
}
