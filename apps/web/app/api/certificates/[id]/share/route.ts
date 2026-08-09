import { randomBytes } from "node:crypto";

import QRCode from "qrcode";

import { shareLinkCreateSchema } from "@pioneers/core/schemas";

import { UNAUTHORIZED, getAuthedUser, jsonError } from "@/lib/auth";

type Context = { params: Promise<{ id: string }> };

/** 32 bytes of entropy, base64url — unguessable and URL-safe. */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function verifyUrl(request: Request, token: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return `${origin.replace(/\/$/, "")}/verify/${token}`;
}

export async function GET(request: Request, { params }: Context) {
  const authed = await getAuthedUser(request);
  if (!authed) return UNAUTHORIZED();

  const { id } = await params;

  const { data, error } = await authed.supabase
    .from("certificate_share_links")
    .select(
      "id, token, label, is_revoked, expires_at, view_count, download_count, created_at, last_accessed_at",
    )
    .eq("certificate_id", id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);

  return Response.json({
    shareLinks: (data ?? []).map((link) => ({ ...link, url: verifyUrl(request, link.token) })),
  });
}

/**
 * Mint a share link and its QR code.
 *
 * The QR encodes a URL to our own /verify page rather than a direct R2 link, so
 * the link stays revocable, can expire, and every scan is logged. A QR pointing
 * straight at signed storage would be none of those things — and would break as
 * soon as the signature expired.
 */
export async function POST(request: Request, { params }: Context) {
  const authed = await getAuthedUser(request);
  if (!authed) return UNAUTHORIZED();

  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = shareLinkCreateSchema.safeParse(body);
  if (!parsed.success) return jsonError("Invalid request.", 400, parsed.error.flatten());

  // Confirm the certificate is visible to this caller before creating anything.
  const { data: certificate } = await authed.supabase
    .from("certificates")
    .select("id, title")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!certificate) return jsonError("Certificate not found.", 404);

  const token = generateToken();
  const expiresAt =
    parsed.data.expiresInDays === null
      ? null
      : new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString();

  const { data: shareLink, error } = await authed.supabase
    .from("certificate_share_links")
    .insert({
      certificate_id: id,
      token,
      label: parsed.data.label,
      expires_at: expiresAt,
      created_by: authed.profile.id,
    })
    .select(
      "id, token, label, is_revoked, expires_at, view_count, download_count, created_at, last_accessed_at",
    )
    .single();

  if (error || !shareLink) {
    return jsonError(error?.message ?? "Could not create the share link.", 500);
  }

  const url = verifyUrl(request, shareLink.token);

  const qrCodeDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 512,
    color: { dark: "#101a2b", light: "#ffffff" },
  });

  return Response.json({ shareLink: { ...shareLink, url }, qrCodeDataUrl }, { status: 201 });
}
