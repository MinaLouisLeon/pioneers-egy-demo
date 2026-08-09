import { buildCertificateKey, buildTaskPhotoKey, validateUpload } from "@pioneers/core/files";
import { uploadUrlRequestSchema } from "@pioneers/api-client";

import { UNAUTHORIZED, getAuthedUser, jsonError } from "@/lib/auth";
import { UPLOAD_URL_TTL_SECONDS, createUploadUrl } from "@/lib/r2";

/**
 * Mint a presigned PUT so the client can upload straight to R2.
 *
 * Authorisation is not just "are you signed in": the caller must also be able
 * to write the *parent row*, which is verified by asking Postgres through the
 * caller's own RLS-scoped client. Without that check any signed-in user could
 * obtain a write URL under another inspector's job prefix.
 */
export async function POST(request: Request) {
  const authed = await getAuthedUser(request);
  if (!authed) return UNAUTHORIZED();

  const body: unknown = await request.json().catch(() => null);
  const parsed = uploadUrlRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid request.", 400, parsed.error.flatten());
  }

  const input = parsed.data;

  const fileError = validateUpload(input.scope === "task-photo" ? "task-photo" : "certificate", {
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  if (fileError) return jsonError(fileError, 400);

  let key: string;

  if (input.scope === "task-photo") {
    // can_write_job() is the same SECURITY DEFINER function the RLS policies
    // use, so this cannot drift from what the database will actually allow.
    const { data: canWrite, error } = await authed.supabase.rpc("can_write_job", {
      p_job_id: input.jobId,
    });

    if (error) return jsonError("Could not verify access to that job.", 500);
    if (!canWrite) return jsonError("You cannot add photos to that job.", 403);

    // Confirm the task really belongs to the job, so a valid job id cannot be
    // paired with someone else's task id to write under their prefix.
    const { data: task } = await authed.supabase
      .from("job_tasks")
      .select("id")
      .eq("id", input.taskId)
      .eq("job_id", input.jobId)
      .maybeSingle();

    if (!task) return jsonError("That task does not belong to that job.", 400);

    key = buildTaskPhotoKey({
      jobId: input.jobId,
      taskId: input.taskId,
      photoClientId: input.photoClientId,
      contentType: input.contentType,
    });
  } else {
    // The certificate row is created first (status pending) so we can bind the
    // key to a real id and check the caller owns it.
    const { data: certificate } = await authed.supabase
      .from("certificates")
      .select("id, uploaded_by")
      .eq("id", input.certificateId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!certificate) return jsonError("Certificate not found.", 404);
    if (certificate.uploaded_by !== authed.profile.id && authed.profile.role !== "admin") {
      return jsonError("You cannot replace that certificate's file.", 403);
    }

    key = buildCertificateKey({
      certificateId: input.certificateId,
      fileName: input.fileName,
      contentType: input.contentType,
    });
  }

  const uploadUrl = await createUploadUrl({ key, contentType: input.contentType });

  return Response.json({
    uploadUrl,
    key,
    contentType: input.contentType,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
}
