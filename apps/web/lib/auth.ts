import { redirect } from "next/navigation";
import { cache } from "react";

import type { UserRole } from "@pioneers/core/roles";
import { createSupabaseBearerClient, createSupabaseServerClient } from "@pioneers/supabase/server";
import type { Database } from "@pioneers/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "./supabase/server";

export type AuthedProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
};

export type AuthedUser = {
  profile: AuthedProfile;
  supabase: SupabaseClient<Database>;
};

/**
 * Current user for server components and server actions.
 *
 * `getUser()` (not `getSession()`) because only the former revalidates the JWT
 * against the auth server; a session read from a cookie is attacker-controlled.
 * Wrapped in React's `cache` so a page that checks auth in the layout and again
 * in the page body still makes a single round trip per request.
 */
export const getCurrentUser = cache(async (): Promise<AuthedProfile | null> => {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, phone, is_active")
    .eq("id", user.id)
    .single();

  // A deactivated account keeps a valid JWT until it expires, so the profile
  // flag — not the token — decides whether they still have access.
  if (!profile || !profile.is_active) return null;

  return profile;
});

/** Redirects to /login when signed out. Use at the top of protected pages. */
export async function requireUser(): Promise<AuthedProfile> {
  const profile = await getCurrentUser();
  if (!profile) redirect("/login");
  return profile;
}

/**
 * Redirects signed-out users to /login and signed-in users without one of the
 * allowed roles to the dashboard. Every role-gated page calls this — hiding a
 * nav item is presentation, this is enforcement.
 */
export async function requireRole(roles: readonly UserRole[]): Promise<AuthedProfile> {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) redirect("/dashboard?denied=1");
  return profile;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * Resolve the caller of a route handler from *either* credential style:
 * the web app sends the Supabase session cookie, the Expo app sends
 * `Authorization: Bearer <access_token>`.
 *
 * Returns null when unauthenticated or deactivated. The returned Supabase
 * client is already scoped to that user, so any query made through it is still
 * subject to RLS.
 */
export async function getAuthedUser(request: Request): Promise<AuthedUser | null> {
  const bearer = request.headers.get("authorization");
  const token = bearer?.toLowerCase().startsWith("bearer ") ? bearer.slice(7).trim() : null;

  const supabase = token
    ? createSupabaseBearerClient(token)
    : createSupabaseServerClient(await requestCookieStore());

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, phone, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) return null;

  return { profile, supabase: supabase as SupabaseClient<Database> };
}

async function requestCookieStore() {
  const { cookies } = await import("next/headers");
  return await cookies();
}

// ---------------------------------------------------------------------------
// JSON helpers for route handlers
// ---------------------------------------------------------------------------

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export const UNAUTHORIZED = () => jsonError("You must be signed in.", 401);
export const FORBIDDEN = () => jsonError("You do not have access to this resource.", 403);
