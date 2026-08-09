import { updateUserSchema } from "@pioneers/core/schemas";
import { createSupabaseAdminClient } from "@pioneers/supabase/admin";

import { jsonError } from "@/lib/auth";
import { getAdminUser, requireAdminRequest } from "@/lib/admin";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { response, authed } = await requireAdminRequest(request);
  if (response) return response;

  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request.", 400, parsed.error.flatten());
  }

  const updates = parsed.data;

  // Guard against an admin locking themselves out of the Accounts section —
  // there would then be no way back in without database access.
  if (id === authed.profile.id) {
    if (updates.role && updates.role !== "admin") {
      return jsonError("You cannot change your own role.", 400);
    }
    if (updates.is_active === false) {
      return jsonError("You cannot deactivate your own account.", 400);
    }
  }

  if (updates.role && updates.role !== "admin") {
    const remaining = await countOtherActiveAdmins(id);
    if (remaining === 0) {
      return jsonError("At least one active administrator must remain.", 400);
    }
  }

  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      ...(updates.full_name !== undefined ? { full_name: updates.full_name } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
      ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
      ...(updates.is_active !== undefined ? { is_active: updates.is_active } : {}),
    })
    .eq("id", id);

  if (error) return jsonError(error.message, 500);

  // Keep the JWT metadata aligned so a role change is visible to anything that
  // reads claims rather than the profiles table.
  if (updates.role) {
    await admin.auth.admin.updateUserById(id, { user_metadata: { role: updates.role } });
  }

  // Deactivating should end the session promptly rather than waiting for the
  // access token to expire. RLS already denies an inactive user, but revoking
  // refresh tokens closes the window.
  if (updates.is_active === false) {
    await admin.auth.admin.signOut(id, "global").catch(() => {
      /* best effort — the profile flag is the authoritative gate */
    });
  }

  const user = await getAdminUser(id);
  if (!user) return jsonError("User not found.", 404);

  return Response.json({ user });
}

export async function DELETE(request: Request, { params }: Context) {
  const { response, authed } = await requireAdminRequest(request);
  if (response) return response;

  const { id } = await params;

  if (id === authed.profile.id) {
    return jsonError("You cannot delete your own account.", 400);
  }

  if ((await countOtherActiveAdmins(id)) === 0) {
    return jsonError("At least one active administrator must remain.", 400);
  }

  const admin = createSupabaseAdminClient();

  // profiles.id cascades from auth.users, so deleting the auth user is enough.
  // Jobs and certificates reference profiles with ON DELETE RESTRICT, so this
  // fails loudly rather than orphaning inspection records — deactivate instead.
  const { error } = await admin.auth.admin.deleteUser(id);

  if (error) {
    const isReferenced = /violates foreign key|restrict/i.test(error.message);
    return jsonError(
      isReferenced
        ? "This user has inspection jobs or certificates and cannot be deleted. Deactivate them instead."
        : error.message,
      isReferenced ? 409 : (error.status ?? 500),
    );
  }

  return Response.json({ ok: true });
}

/** Active admins other than `excludingId`. */
async function countOtherActiveAdmins(excludingId: string): Promise<number> {
  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true)
    .neq("id", excludingId);
  return count ?? 0;
}
