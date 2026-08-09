import "server-only";

import type { UserRole } from "@pioneers/core/roles";
import { createSupabaseAdminClient } from "@pioneers/supabase/admin";

import { FORBIDDEN, UNAUTHORIZED, getAuthedUser, type AuthedUser } from "./auth";

/**
 * Gate for every service-role route.
 *
 * Returns either a `Response` to send straight back, or the authenticated
 * admin. Written this way so a handler physically cannot forget the check —
 * it has to destructure the result before it can reach the admin client.
 */
export async function requireAdminRequest(
  request: Request,
): Promise<{ response: Response; authed?: never } | { response?: never; authed: AuthedUser }> {
  const authed = await getAuthedUser(request);
  if (!authed) return { response: UNAUTHORIZED() };
  if (authed.profile.role !== "admin") return { response: FORBIDDEN() };
  return { authed };
}

export type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  /** True while the invite email has been sent but never accepted. */
  invite_pending: boolean;
};

/**
 * Join public.profiles with the auth.users metadata the UI needs (last sign-in,
 * whether the invite was ever accepted). Only the service role can read
 * auth.users, which is why this lives behind the admin routes.
 */
export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const admin = createSupabaseAdminClient();

  const [{ data: profiles, error: profilesError }, { data: authList, error: authError }] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id, email, full_name, role, phone, is_active, created_at")
        .order("created_at", { ascending: true }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

  if (profilesError) throw new Error(profilesError.message);
  if (authError) throw new Error(authError.message);

  const authById = new Map(authList.users.map((user) => [user.id, user]));

  return (profiles ?? []).map((profile) => {
    const authUser = authById.get(profile.id);
    return {
      ...profile,
      last_sign_in_at: authUser?.last_sign_in_at ?? null,
      // Invited but never signed in and never confirmed = still pending.
      invite_pending: Boolean(
        authUser && !authUser.last_sign_in_at && !authUser.email_confirmed_at,
      ),
    };
  });
}

export async function getAdminUser(userId: string): Promise<AdminUserRow | null> {
  const users = await listAdminUsers();
  return users.find((user) => user.id === userId) ?? null;
}
