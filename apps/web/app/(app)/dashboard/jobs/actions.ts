"use server";

import { revalidatePath } from "next/cache";

import {
  categoryForSubtype,
  jobDetailsSchema,
  TASK_DATA_SCHEMAS,
  TASK_SUBTYPES,
  type TaskSubtype,
} from "@pioneers/core/schemas";
import { z } from "zod";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/**
 * Server actions for the job wizard.
 *
 * The wizard writes to real rows as it goes rather than holding everything in
 * memory until the end:
 *
 *   step 1  -> insert a `draft` job
 *   step 2  -> insert/update a row per task
 *   step 3  -> flip the job to `submitted`
 *
 * That is what makes photo upload possible at all (an R2 key needs a real task
 * id), and it means a half-finished job survives a closed tab or a flat battery
 * — which matters when the person filling it in is standing on a jetty.
 *
 * Every action re-validates its input server-side. The client checked the same
 * schemas, but a client check is a convenience, not a control.
 */

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Step 1 — job details
// ---------------------------------------------------------------------------

export async function createJob(input: unknown): Promise<ActionResult<{ jobId: string }>> {
  const profile = await requireUser();

  const parsed = jobDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      project_name: parsed.data.project_name,
      company_name: parsed.data.company_name,
      visit_date: parsed.data.visit_date,
      notes: parsed.data.notes || null,
      status: "draft",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create the job." };
  }

  revalidatePath("/dashboard/jobs");
  return { ok: true, data: { jobId: data.id } };
}

export async function updateJobDetails(jobId: string, input: unknown): Promise<ActionResult> {
  await requireUser();

  const parsed = jobDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await getSupabaseServerClient();

  // No ownership check needed: the RLS UPDATE policy already restricts this to
  // the job's creator (or an admin), and an unauthorised update affects 0 rows.
  const { error } = await supabase
    .from("jobs")
    .update({
      project_name: parsed.data.project_name,
      company_name: parsed.data.company_name,
      visit_date: parsed.data.visit_date,
      notes: parsed.data.notes || null,
    })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Step 2 — tasks
// ---------------------------------------------------------------------------

const savePhotoSchema = z.object({
  clientId: z.uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  r2Key: z.string().min(1),
});

const saveTaskSchema = z.object({
  taskId: z.uuid().nullable(),
  clientId: z.uuid(),
  subtype: z.enum(TASK_SUBTYPES),
  sortOrder: z.number().int().nonnegative(),
  data: z.unknown(),
  photos: z.array(savePhotoSchema),
});

export async function saveTask(
  jobId: string,
  input: unknown,
): Promise<ActionResult<{ taskId: string }>> {
  await requireUser();

  const parsed = saveTaskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That task could not be saved." };
  }

  const task = parsed.data;
  const subtype = task.subtype as TaskSubtype;

  // Re-validate the subtype-specific fields with the same schema the form used.
  const dataResult = TASK_DATA_SCHEMAS[subtype].safeParse(task.data);
  if (!dataResult.success) {
    return {
      ok: false,
      error: "Please correct the highlighted fields.",
      fieldErrors: dataResult.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await getSupabaseServerClient();

  const row = {
    job_id: jobId,
    category: categoryForSubtype(subtype),
    subtype,
    sort_order: task.sortOrder,
    data: dataResult.data as never,
  };

  let taskId = task.taskId;

  if (taskId) {
    const { error } = await supabase.from("job_tasks").update(row).eq("id", taskId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await supabase
      .from("job_tasks")
      .insert({ ...row, client_id: task.clientId })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Could not add the task." };
    taskId = data.id;
  }

  // Photos are replaced wholesale: the uploader has already pushed the bytes to
  // R2, so this just reconciles the rows that point at them. Deleting first
  // keeps ordering and removals correct without diffing.
  const { error: deleteError } = await supabase.from("task_photos").delete().eq("task_id", taskId);

  if (deleteError) return { ok: false, error: deleteError.message };

  if (task.photos.length > 0) {
    const { error: photoError } = await supabase.from("task_photos").insert(
      task.photos.map((photo, index) => ({
        task_id: taskId!,
        client_id: photo.clientId,
        r2_key: photo.r2Key,
        file_name: photo.fileName,
        content_type: photo.contentType,
        size_bytes: photo.sizeBytes,
        sort_order: index,
      })),
    );

    if (photoError) return { ok: false, error: photoError.message };
  }

  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { ok: true, data: { taskId } };
}

export async function deleteTask(jobId: string, taskId: string): Promise<ActionResult> {
  await requireUser();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("job_tasks").delete().eq("id", taskId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${jobId}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Step 3 — submit
// ---------------------------------------------------------------------------

export async function submitJob(jobId: string): Promise<ActionResult> {
  await requireUser();

  const supabase = await getSupabaseServerClient();

  const { count } = await supabase
    .from("job_tasks")
    .select("id", { count: "exact", head: true })
    .eq("job_id", jobId);

  if (!count) {
    return { ok: false, error: "Add at least one inspection task before submitting." };
  }

  const { error } = await supabase
    .from("jobs")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  return { ok: true, data: undefined };
}

export async function reopenJob(jobId: string): Promise<ActionResult> {
  await requireUser();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("jobs")
    .update({ status: "draft", submitted_at: null })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/jobs/${jobId}`);
  revalidatePath("/dashboard/jobs");
  return { ok: true, data: undefined };
}

/** Soft delete so certificates that reference the job keep their link. */
export async function deleteJob(jobId: string): Promise<ActionResult> {
  await requireUser();

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("jobs")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/jobs");
  return { ok: true, data: undefined };
}
