import { downloadUrlRequestSchema } from "@pioneers/api-client";

import { UNAUTHORIZED, getAuthedUser, jsonError } from "@/lib/auth";
import { DOWNLOAD_URL_TTL_SECONDS, createDownloadUrl } from "@/lib/r2";

/**
 * Mint short-lived presigned GETs for a batch of object keys.
 *
 * The critical part is that we never sign a key the caller merely *named*. Each
 * requested key is looked up through the caller's own RLS-scoped client; only
 * keys that come back from those queries are signed. Anything else is silently
 * dropped, so an attacker enumerating keys learns nothing and gets nothing.
 *
 * Batched because a job detail page needs a URL for every photo at once.
 */
export async function POST(request: Request) {
  const authed = await getAuthedUser(request);
  if (!authed) return UNAUTHORIZED();

  const body: unknown = await request.json().catch(() => null);
  const parsed = downloadUrlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request.", 400, parsed.error.flatten());
  }

  const requestedKeys = [...new Set(parsed.data.keys)];

  const [{ data: photos }, { data: certificates }] = await Promise.all([
    authed.supabase.from("task_photos").select("r2_key, file_name").in("r2_key", requestedKeys),
    authed.supabase
      .from("certificates")
      .select("r2_key, file_name")
      .in("r2_key", requestedKeys)
      .is("deleted_at", null),
  ]);

  const readable = new Map<string, string>();
  for (const row of photos ?? []) readable.set(row.r2_key, row.file_name);
  for (const row of certificates ?? []) readable.set(row.r2_key, row.file_name);

  const urls: Record<string, string> = {};
  await Promise.all(
    [...readable.entries()].map(async ([key, fileName]) => {
      urls[key] = await createDownloadUrl({
        key,
        downloadFileName: parsed.data.download ? fileName : undefined,
      });
    }),
  );

  return Response.json({ urls, expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}
