import { createSupabaseAdminClient } from "@pioneers/supabase/admin";

import { jsonError } from "@/lib/auth";
import { getAdminUser, requireAdminRequest } from "@/lib/admin";

type Context = { params: Promise<{ id: string }> };

/**
 * Re-send an invite link that expired before the user got to it.
 *
 * `inviteUserByEmail` would reject an address that already exists, so this
 * generates a fresh recovery link for the existing account instead.
 */
export async function POST(request: Request, { params }: Context) {
  const { response } = await requireAdminRequest(request);
  if (response) return response;

  const { id } = await params;

  const user = await getAdminUser(id);
  if (!user) return jsonError("User not found.", 404);

  const admin = createSupabaseAdminClient();
  const origin = new URL(request.url).origin;

  const { error } = await admin.auth.resetPasswordForEmail(user.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? origin}/auth/callback?next=/set-password`,
  });

  if (error) return jsonError(error.message, error.status ?? 500);

  return Response.json({ ok: true });
}
