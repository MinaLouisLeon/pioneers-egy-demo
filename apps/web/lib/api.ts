"use client";

import { ApiClient } from "@pioneers/api-client";

/**
 * Browser-side API client.
 *
 * No `getAccessToken`: the web app authenticates with the Supabase session
 * cookie, which `credentials: "include"` sends automatically. The Expo app
 * supplies a bearer token instead — same client, same endpoints.
 */
let instance: ApiClient | undefined;

export function getApiClient(): ApiClient {
  instance ??= new ApiClient({ baseUrl: "" });
  return instance;
}
