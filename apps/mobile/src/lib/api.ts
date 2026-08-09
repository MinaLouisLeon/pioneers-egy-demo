import { ApiClient } from "@pioneers/api-client";

import { getAccessToken } from "./supabase";

/**
 * API client for the mobile app.
 *
 * Same client class the web app uses, configured differently: mobile has no
 * cookie jar, so it authenticates with a bearer token, and it must be told
 * where the Next.js routes live.
 *
 * On a physical device EXPO_PUBLIC_API_URL must be the machine's LAN address —
 * "localhost" resolves to the phone itself.
 */
let instance: ApiClient | undefined;

export function getApiClient(): ApiClient {
  instance ??= new ApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000",
    getAccessToken,
  });
  return instance;
}
