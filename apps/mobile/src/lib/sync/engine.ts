import { File, UploadType } from "expo-file-system";

import { api } from "@pioneers/api-client";

import { getApiClient } from "../api";
import { getDatabase } from "../db/schema";
import { supabase } from "../supabase";
import { claimBatch, markFailed, markSucceeded, MAX_ATTEMPTS, type OutboxRow } from "./outbox";

/**
 * The sync engine.
 *
 * Drains the outbox against Supabase, then uploads any queued photos to R2.
 * Run on reconnect, on app foreground, on a background task, and manually.
 *
 * Design notes:
 *
 *  - **Idempotency over transactions.** There is no distributed transaction
 *    available, so every insert carries the device-generated `client_id` and
 *    relies on the UNIQUE constraint. Replaying a batch after a crash is safe.
 *
 *  - **Ordering.** The queue is drained strictly in insertion order and stops at
 *    the first failure for a given job. Sending a task whose parent job never
 *    arrived would fail anyway, and retrying it in a tight loop would burn its
 *    attempt budget for no reason.
 *
 *  - **Conflicts are last-write-wins on `updated_at`.** Inspection jobs are
 *    single-owner and rarely edited from two devices, so a CRDT is not
 *    warranted; the cost of being wrong is a superseded note, not lost data.
 *
 *  - **Single flight.** A module-level flag prevents the reconnect listener,
 *    the foreground handler and the background task from draining at once and
 *    double-submitting.
 */

let isSyncing = false;
let listeners: (() => void)[] = [];

export function onSyncChange(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((item) => item !== listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export type SyncResult = {
  processed: number;
  failed: number;
  photosUploaded: number;
  skipped: boolean;
};

export async function runSync(): Promise<SyncResult> {
  if (isSyncing) return { processed: 0, failed: 0, photosUploaded: 0, skipped: true };

  // Nothing can be synced without a session; the queue simply waits.
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { processed: 0, failed: 0, photosUploaded: 0, skipped: true };

  isSyncing = true;
  notify();

  let processed = 0;
  let failed = 0;
  let photosUploaded = 0;

  try {
    // Jobs and tasks first: a photo cannot be uploaded until its task has a
    // server id to build the R2 key from.
    const batch = await claimBatch();
    const blockedJobs = new Set<string>();

    for (const row of batch) {
      const jobKey = await jobKeyFor(row);
      if (jobKey && blockedJobs.has(jobKey)) continue;

      try {
        await processRow(row);
        await markSucceeded(row.id);
        processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await markFailed(row, message);
        failed++;
        if (jobKey) blockedJobs.add(jobKey);
      }
    }

    photosUploaded = await uploadQueuedPhotos();
  } finally {
    isSyncing = false;
    notify();
  }

  return { processed, failed, photosUploaded, skipped: false };
}

export function isSyncInProgress(): boolean {
  return isSyncing;
}

/** Which job a queue entry belongs to, so failures can block its siblings. */
async function jobKeyFor(row: OutboxRow): Promise<string | null> {
  if (row.entity === "job") return row.client_id;

  if (row.entity === "task") {
    const payload = JSON.parse(row.payload) as { job_client_id?: string };
    return payload.job_client_id ?? null;
  }

  return null;
}

async function processRow(row: OutboxRow): Promise<void> {
  switch (row.entity) {
    case "job":
      return processJob(row);
    case "task":
      return processTask(row);
    case "certificate":
      return processCertificate(row);
    default:
      // Photos are handled by uploadQueuedPhotos, not the outbox.
      return;
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

async function processJob(row: OutboxRow): Promise<void> {
  const db = await getDatabase();
  const payload = JSON.parse(row.payload) as Record<string, unknown>;

  if (row.operation === "insert") {
    const { data, error } = await supabase
      .from("jobs")
      .upsert(
        {
          client_id: row.client_id,
          project_name: payload.project_name as string,
          company_name: payload.company_name as string,
          visit_date: payload.visit_date as string,
          notes: (payload.notes as string | null) ?? null,
          created_by: payload.created_by as string,
          status: "draft",
        },
        // A replayed insert resolves to the existing row rather than erroring.
        { onConflict: "client_id", ignoreDuplicates: false },
      )
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await db.runAsync(
      "UPDATE jobs SET server_id = ?, sync_state = 'synced' WHERE client_id = ?",
      data.id,
      row.client_id,
    );
    return;
  }

  if (row.operation === "update") {
    const serverId = await resolveServerId(db, "jobs", row.client_id);
    if (!serverId) throw new Error("Job has not been created on the server yet.");

    const { error } = await supabase
      .from("jobs")
      .update({
        ...(payload.project_name !== undefined
          ? { project_name: payload.project_name as string }
          : {}),
        ...(payload.company_name !== undefined
          ? { company_name: payload.company_name as string }
          : {}),
        ...(payload.visit_date !== undefined ? { visit_date: payload.visit_date as string } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes as string | null } : {}),
        ...(payload.status !== undefined ? { status: payload.status as "submitted" } : {}),
        ...(payload.submitted_at !== undefined
          ? { submitted_at: payload.submitted_at as string }
          : {}),
      })
      .eq("id", serverId);

    if (error) throw new Error(error.message);

    await db.runAsync("UPDATE jobs SET sync_state = 'synced' WHERE client_id = ?", row.client_id);
  }
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

async function processTask(row: OutboxRow): Promise<void> {
  const db = await getDatabase();
  const payload = JSON.parse(row.payload) as Record<string, unknown>;

  if (row.operation === "delete") {
    const serverId = await resolveServerId(db, "job_tasks", row.client_id);
    // Never created on the server — nothing to delete, and that is success.
    if (!serverId) return;

    const { error } = await supabase.from("job_tasks").delete().eq("id", serverId);
    if (error) throw new Error(error.message);
    return;
  }

  const jobServerId = await resolveServerId(db, "jobs", payload.job_client_id as string);
  if (!jobServerId) throw new Error("Parent job has not synced yet.");

  const { data, error } = await supabase
    .from("job_tasks")
    .upsert(
      {
        client_id: row.client_id,
        job_id: jobServerId,
        category: payload.category as "inspection" | "environmental",
        subtype: payload.subtype as never,
        sort_order: payload.sort_order as number,
        data: payload.data as never,
      },
      { onConflict: "client_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await db.runAsync(
    "UPDATE job_tasks SET server_id = ?, sync_state = 'synced' WHERE client_id = ?",
    data.id,
    row.client_id,
  );
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

async function processCertificate(row: OutboxRow): Promise<void> {
  const db = await getDatabase();
  const payload = JSON.parse(row.payload) as Record<string, unknown>;

  const { data, error } = await supabase
    .from("certificates")
    .upsert(
      {
        client_id: row.client_id,
        title: payload.title as string,
        file_name: payload.file_name as string,
        r2_key: payload.r2_key as string,
        size_bytes: payload.size_bytes as number,
        company_name: (payload.company_name as string | null) ?? null,
        certificate_number: (payload.certificate_number as string | null) ?? null,
        issue_date: (payload.issue_date as string | null) ?? null,
        expiry_date: (payload.expiry_date as string | null) ?? null,
        job_id: (payload.job_server_id as string | null) ?? null,
        uploaded_by: payload.uploaded_by as string,
      },
      { onConflict: "client_id", ignoreDuplicates: false },
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await db.runAsync(
    "UPDATE certificates SET server_id = ?, sync_state = 'synced' WHERE client_id = ?",
    data.id,
    row.client_id,
  );
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/**
 * Upload every queued photo whose task has reached the server.
 *
 * Photos are not outbox entries because they are large binary transfers with
 * their own retry economics: a failed 3 MB upload should not block a 200-byte
 * task update sitting behind it in the queue.
 */
async function uploadQueuedPhotos(): Promise<number> {
  const db = await getDatabase();

  const queued = await db.getAllAsync<{
    client_id: string;
    task_client_id: string;
    local_uri: string | null;
    file_name: string;
    content_type: string;
    size_bytes: number;
    attempts: number;
    task_server_id: string | null;
    job_server_id: string | null;
  }>(
    `SELECT p.client_id, p.task_client_id, p.local_uri, p.file_name, p.content_type,
            p.size_bytes, p.attempts,
            t.server_id AS task_server_id,
            j.server_id AS job_server_id
     FROM task_photos p
     JOIN job_tasks t ON t.client_id = p.task_client_id
     JOIN jobs j ON j.client_id = t.job_client_id
     WHERE p.upload_state IN ('queued', 'failed')
       AND p.attempts < ?
     ORDER BY p.created_at ASC
     LIMIT 20`,
    MAX_ATTEMPTS,
  );

  let uploaded = 0;

  for (const photo of queued) {
    // Its task has not synced yet — leave it queued for the next pass.
    if (!photo.task_server_id || !photo.job_server_id || !photo.local_uri) continue;

    await db.runAsync(
      "UPDATE task_photos SET upload_state = 'uploading' WHERE client_id = ?",
      photo.client_id,
    );

    try {
      const { uploadUrl, key, contentType } = await api.storage.uploadUrl(getApiClient(), {
        scope: "task-photo",
        jobId: photo.job_server_id,
        taskId: photo.task_server_id,
        photoClientId: photo.client_id,
        fileName: photo.file_name,
        contentType: photo.content_type,
        sizeBytes: photo.size_bytes,
      });

      // File.upload streams from disk rather than loading the image into JS
      // memory — important for a queue of full-resolution photos. The
      // Content-Type must match the one that was signed or R2 rejects the PUT.
      const localFile = new File(photo.local_uri);
      const result = await localFile.upload(uploadUrl, {
        httpMethod: "PUT",
        uploadType: UploadType.BINARY_CONTENT,
        headers: { "Content-Type": contentType },
      });

      if (result.status < 200 || result.status >= 300) {
        throw new Error(`R2 rejected the upload (${result.status}).`);
      }

      // Record the row only after the bytes are safely in R2, so a photo row
      // never points at an object that does not exist.
      const { error } = await supabase.from("task_photos").upsert(
        {
          client_id: photo.client_id,
          task_id: photo.task_server_id,
          r2_key: key,
          file_name: photo.file_name,
          content_type: photo.content_type,
          size_bytes: photo.size_bytes,
        },
        { onConflict: "client_id", ignoreDuplicates: false },
      );

      if (error) throw new Error(error.message);

      await db.runAsync(
        "UPDATE task_photos SET upload_state = 'uploaded', r2_key = ?, last_error = NULL WHERE client_id = ?",
        key,
        photo.client_id,
      );

      // Reclaim the device copy now that R2 has it.
      try {
        if (localFile.exists) localFile.delete();
      } catch {
        // A leftover file costs disk space; it is not worth failing the sync.
      }

      uploaded++;
    } catch (error) {
      await db.runAsync(
        `UPDATE task_photos
         SET upload_state = 'failed', attempts = attempts + 1, last_error = ?
         WHERE client_id = ?`,
        (error instanceof Error ? error.message : "Upload failed").slice(0, 500),
        photo.client_id,
      );
    }
  }

  return uploaded;
}

// ---------------------------------------------------------------------------

async function resolveServerId(
  db: Awaited<ReturnType<typeof getDatabase>>,
  table: "jobs" | "job_tasks" | "certificates",
  clientId: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ server_id: string | null }>(
    `SELECT server_id FROM ${table} WHERE client_id = ?`,
    clientId,
  );
  return row?.server_id ?? null;
}
