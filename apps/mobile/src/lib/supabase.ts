import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";

import { createSupabaseNativeClient } from "@pioneers/supabase/native";

/**
 * Supabase client for the app.
 *
 * The factory lives in @pioneers/supabase so the auth options (AsyncStorage
 * persistence, no URL session detection, processLock) stay in one place; the
 * storage adapter is injected here because the shared package must not depend
 * on a native module.
 */
export const supabase = createSupabaseNativeClient(AsyncStorage);

/**
 * Supabase refreshes the access token on a timer. That timer does not fire
 * reliably while the app is backgrounded, and on resume the token is often
 * already stale — so refreshing is tied to the foreground lifecycle instead.
 */
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

/** Current access token, or null when signed out. Used for API bearer auth. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
