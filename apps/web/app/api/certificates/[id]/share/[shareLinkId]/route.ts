import { UNAUTHORIZED, getAuthedUser, jsonError } from "@/lib/auth";

type Context = { params: Promise<{ id: string; shareLinkId: string }> };

/**
 * Revoke a share link.
 *
 * The row is kept rather than deleted so the access log stays intact and the
 * /verify page can say "this link was revoked" instead of "not found" — the
 * recipient then knows to ask for a new one rather than assume a typo.
 */
export async function DELETE(request: Request, { params }: Context) {
  const authed = await getAuthedUser(request);
  if (!authed) return UNAUTHORIZED();

  const { id, shareLinkId } = await params;

  const { error, count } = await authed.supabase
    .from("certificate_share_links")
    .update({ is_revoked: true }, { count: "exact" })
    .eq("id", shareLinkId)
    .eq("certificate_id", id);

  if (error) return jsonError(error.message, 500);
  if (!count) return jsonError("Share link not found.", 404);

  return Response.json({ ok: true });
}
