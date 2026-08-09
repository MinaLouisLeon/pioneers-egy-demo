import { inviteUserSchema } from "@pioneers/core/schemas";
import { createSupabaseAdminClient } from "@pioneers/supabase/admin";

import { jsonError } from "@/lib/auth";
import { getAdminUser, listAdminUsers, requireAdminRequest } from "@/lib/admin";

export async function GET(request: Request) {
  const { response } = await requireAdminRequest(request);
  if (response) return response;

  try {
    return Response.json({ users: await listAdminUsers() });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not list users.", 500);
  }
}

/**
 * Invite a new user.
 *
 * Supabase emails them a link; they set their own password at /set-password.
 * We never handle their password, and no account exists in a
 * known-password state.
 *
 * The public.profiles row is created by the on_auth_user_created trigger from
 * the metadata passed here — see supabase/migrations/*_auth_triggers.sql.
 */
export async function POST(request: Request) {
  const { response } = await requireAdminRequest(request);
  if (response) return response;

  const body: unknown = await request.json().catch(() => null);
  const parsed = inviteUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request.", 400, parsed.error.flatten());
  }

  const { email, full_name, role, phone } = parsed.data;
  const admin = createSupabaseAdminClient();

  const origin = new URL(request.url).origin;
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/auth/callback?next=/set-password`;

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, role, phone },
    redirectTo,
  });

  if (error) {
    // Supabase reports an existing address as a 422; surface it as a conflict
    // so the UI can point at the email field rather than showing a raw error.
    const status = error.status === 422 ? 409 : (error.status ?? 500);
    return jsonError(
      status === 409 ? "An account with that email already exists." : error.message,
      status,
    );
  }

  const user = data.user ? await getAdminUser(data.user.id) : null;
  if (!user) {
    return jsonError("The invite was sent but the profile could not be read back.", 500);
  }

  return Response.json({ user }, { status: 201 });
}
