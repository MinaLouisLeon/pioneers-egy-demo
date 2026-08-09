import type { z } from "zod";

import { apiErrorSchema } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export type ApiClientOptions = {
  /**
   * Base URL of the Next.js app hosting the route handlers.
   *
   * Web passes "" so requests stay same-origin and the session cookie is sent
   * automatically. Mobile passes EXPO_PUBLIC_API_URL.
   */
  baseUrl?: string;
  /**
   * Supplies a Supabase access token for `Authorization: Bearer`. Web omits it
   * (cookies carry the session); mobile returns the current session's token.
   */
  getAccessToken?: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

/**
 * Thin typed wrapper around the app's route handlers, shared by web and mobile.
 * Responses are parsed with the same Zod schemas the server validates against,
 * so a drifting contract fails loudly at the boundary rather than deep in a
 * component.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken?: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "").replace(/\/$/, "");
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<TSchema extends z.ZodTypeAny>(
    path: string,
    schema: TSchema,
    init: RequestInit = {},
  ): Promise<z.infer<TSchema>> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = await this.getAccessToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: init.credentials ?? "include",
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(payload);
      throw new ApiError(
        parsed.success ? parsed.data.error : `Request failed with status ${response.status}`,
        response.status,
        parsed.success ? parsed.data.details : payload,
      );
    }

    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new ApiError(`Unexpected response shape from ${path}`, response.status, result.error);
    }
    return result.data;
  }

  post<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema, body: unknown) {
    return this.request(path, schema, { method: "POST", body: JSON.stringify(body) });
  }

  patch<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema, body: unknown) {
    return this.request(path, schema, { method: "PATCH", body: JSON.stringify(body) });
  }

  get<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema) {
    return this.request(path, schema, { method: "GET" });
  }

  delete<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema) {
    return this.request(path, schema, { method: "DELETE" });
  }
}
