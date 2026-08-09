import "server-only";

import type { VerifyResponse } from "@pioneers/core/schemas";
import { createSupabaseAdminClient } from "@pioneers/supabase/admin";

import { createDownloadUrl } from "./r2";

/**
 * Resolve a certificate share token.
 *
 * This is the app's only unauthenticated data path, so the rules are strict:
 *
 *  - The service role is used because `certificate_share_links` has no `anon`
 *    RLS policy at all. That is deliberate: the token itself is the credential,
 *    and no anonymous client can enumerate or read the table directly.
 *  - Revoked, expired, deleted and unknown tokens are all resolved here rather
 *    than in the caller, so no route can accidentally skip a check.
 *  - Only presentation fields are returned. Internal ids, the R2 key, and who
 *    uploaded it are never exposed to an anonymous visitor.
 *  - The download URL is minted fresh on each view and expires in minutes, so a
 *    forwarded screenshot of the page is not a permanent grant.
 */
export async function resolveShareToken(
  token: string,
  options: { action: "view" | "download"; userAgent?: string | null } = { action: "view" },
): Promise<VerifyResponse> {
  const notFound: VerifyResponse = { status: "not-found", certificate: null, downloadUrl: null };

  // Cheap guard against absurd input before touching the database.
  if (!token || token.length < 32 || token.length > 128) return notFound;

  const admin = createSupabaseAdminClient();

  const { data: link } = await admin
    .from("certificate_share_links")
    .select(
      `id, is_revoked, expires_at, view_count, download_count,
       certificates ( title, file_name, r2_key, company_name, certificate_number,
                      issue_date, expiry_date, size_bytes, deleted_at )`,
    )
    .eq("token", token)
    .maybeSingle();

  if (!link) return notFound;

  const certificate = link.certificates as unknown as {
    title: string;
    file_name: string;
    r2_key: string;
    company_name: string | null;
    certificate_number: string | null;
    issue_date: string | null;
    expiry_date: string | null;
    size_bytes: number;
    deleted_at: string | null;
  } | null;

  // A deleted certificate is indistinguishable from a bad token, on purpose.
  if (!certificate || certificate.deleted_at) return notFound;

  if (link.is_revoked) return { status: "revoked", certificate: null, downloadUrl: null };

  if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
    return { status: "expired", certificate: null, downloadUrl: null };
  }

  const downloadUrl = await createDownloadUrl({
    key: certificate.r2_key,
    downloadFileName: certificate.file_name,
    expiresIn: 5 * 60,
  });

  // Best-effort audit trail — a logging failure must not block a legitimate
  // download.
  void recordAccess(link.id, options, {
    viewCount: link.view_count,
    downloadCount: link.download_count,
  });

  return {
    status: "ok",
    certificate: {
      title: certificate.title,
      file_name: certificate.file_name,
      company_name: certificate.company_name,
      certificate_number: certificate.certificate_number,
      issue_date: certificate.issue_date,
      expiry_date: certificate.expiry_date,
      size_bytes: certificate.size_bytes,
    },
    downloadUrl,
  };
}

async function recordAccess(
  shareLinkId: string,
  options: { action: "view" | "download"; userAgent?: string | null },
  counts: { viewCount: number; downloadCount: number },
): Promise<void> {
  try {
    const admin = createSupabaseAdminClient();

    await Promise.all([
      admin.from("certificate_access_log").insert({
        share_link_id: shareLinkId,
        action: options.action,
        user_agent: options.userAgent?.slice(0, 500) ?? null,
      }),
      admin
        .from("certificate_share_links")
        .update({
          last_accessed_at: new Date().toISOString(),
          view_count: counts.viewCount + (options.action === "view" ? 1 : 0),
          download_count: counts.downloadCount + (options.action === "download" ? 1 : 0),
        })
        .eq("id", shareLinkId),
    ]);
  } catch {
    // Intentionally swallowed — see call site.
  }
}
