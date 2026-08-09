import { newClientId } from "@pioneers/core/ids";
import type { JobDetails, TaskCategory, TaskSubtype } from "@pioneers/core/schemas";

import { getDatabase } from "./schema";
import { enqueue } from "../sync/outbox";

/**
 * Local-first job repository.
 *
 * Every function here writes to SQLite and appends to the outbox in a single
 * transaction. The UI reads back immediately; the network is somebody else's
 * problem (see lib/sync/engine.ts).
 */

export type LocalJob = {
  client_id: string;
  server_id: string | null;
  project_name: string;
  company_name: string;
  visit_date: string;
  status: "draft" | "submitted";
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  sync_state: "synced" | "pending" | "failed";
};

export type LocalTask = {
  client_id: string;
  server_id: string | null;
  job_client_id: string;
  category: TaskCategory;
  subtype: TaskSubtype;
  sort_order: number;
  data: string;
  sync_state: "synced" | "pending" | "failed";
};

export type LocalPhoto = {
  client_id: string;
  task_client_id: string;
  local_uri: string | null;
  r2_key: string | null;
  file_name: string;
  content_type: string;
  size_bytes: number;
  sort_order: number;
  upload_state: "queued" | "uploading" | "uploaded" | "failed";
  attempts: number;
  last_error: string | null;
};

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export async function createLocalJob(details: JobDetails, userId: string): Promise<string> {
  const db = await getDatabase();
  const clientId = newClientId();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO jobs
         (client_id, project_name, company_name, visit_date, status, notes,
          created_by, created_at, updated_at, sync_state)
       VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, 'pending')`,
      clientId,
      details.project_name,
      details.company_name,
      details.visit_date,
      details.notes || null,
      userId,
      timestamp,
      timestamp,
    );

    await enqueue(db, {
      entity: "job",
      operation: "insert",
      clientId,
      payload: {
        client_id: clientId,
        project_name: details.project_name,
        company_name: details.company_name,
        visit_date: details.visit_date,
        notes: details.notes || null,
        created_by: userId,
      },
    });
  });

  return clientId;
}

export async function updateLocalJob(clientId: string, details: JobDetails): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE jobs
       SET project_name = ?, company_name = ?, visit_date = ?, notes = ?,
           updated_at = ?, sync_state = 'pending'
       WHERE client_id = ?`,
      details.project_name,
      details.company_name,
      details.visit_date,
      details.notes || null,
      timestamp,
      clientId,
    );

    await enqueue(db, {
      entity: "job",
      operation: "update",
      clientId,
      payload: {
        project_name: details.project_name,
        company_name: details.company_name,
        visit_date: details.visit_date,
        notes: details.notes || null,
        updated_at: timestamp,
      },
    });
  });
}

export async function submitLocalJob(clientId: string): Promise<void> {
  const db = await getDatabase();
  const timestamp = now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE jobs
       SET status = 'submitted', submitted_at = ?, updated_at = ?, sync_state = 'pending'
       WHERE client_id = ?`,
      timestamp,
      timestamp,
      clientId,
    );

    await enqueue(db, {
      entity: "job",
      operation: "update",
      clientId,
      payload: { status: "submitted", submitted_at: timestamp, updated_at: timestamp },
    });
  });
}

export async function listLocalJobs(search = ""): Promise<LocalJob[]> {
  const db = await getDatabase();
  const term = `%${search.trim()}%`;

  return db.getAllAsync<LocalJob>(
    `SELECT * FROM jobs
     WHERE deleted_at IS NULL
       AND (? = '%%' OR project_name LIKE ? OR company_name LIKE ?)
     ORDER BY visit_date DESC, created_at DESC`,
    term,
    term,
    term,
  );
}

export async function getLocalJob(clientId: string): Promise<LocalJob | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LocalJob>("SELECT * FROM jobs WHERE client_id = ?", clientId);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listLocalTasks(jobClientId: string): Promise<LocalTask[]> {
  const db = await getDatabase();
  return db.getAllAsync<LocalTask>(
    "SELECT * FROM job_tasks WHERE job_client_id = ? ORDER BY sort_order ASC",
    jobClientId,
  );
}

export async function saveLocalTask(params: {
  clientId?: string;
  jobClientId: string;
  category: TaskCategory;
  subtype: TaskSubtype;
  sortOrder: number;
  data: Record<string, unknown>;
}): Promise<string> {
  const db = await getDatabase();
  const clientId = params.clientId ?? newClientId();
  const timestamp = now();
  const serialised = JSON.stringify(params.data);

  const existing = await db.getFirstAsync<{ client_id: string }>(
    "SELECT client_id FROM job_tasks WHERE client_id = ?",
    clientId,
  );

  await db.withTransactionAsync(async () => {
    if (existing) {
      await db.runAsync(
        `UPDATE job_tasks
         SET category = ?, subtype = ?, sort_order = ?, data = ?,
             updated_at = ?, sync_state = 'pending'
         WHERE client_id = ?`,
        params.category,
        params.subtype,
        params.sortOrder,
        serialised,
        timestamp,
        clientId,
      );
    } else {
      await db.runAsync(
        `INSERT INTO job_tasks
           (client_id, job_client_id, category, subtype, sort_order, data,
            created_at, updated_at, sync_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        clientId,
        params.jobClientId,
        params.category,
        params.subtype,
        params.sortOrder,
        serialised,
        timestamp,
        timestamp,
      );
    }

    await enqueue(db, {
      entity: "task",
      operation: existing ? "update" : "insert",
      clientId,
      payload: {
        client_id: clientId,
        job_client_id: params.jobClientId,
        category: params.category,
        subtype: params.subtype,
        sort_order: params.sortOrder,
        data: params.data,
        updated_at: timestamp,
      },
    });
  });

  return clientId;
}

export async function deleteLocalTask(clientId: string): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    // Cascades to task_photos via the foreign key.
    await db.runAsync("DELETE FROM job_tasks WHERE client_id = ?", clientId);
    await enqueue(db, {
      entity: "task",
      operation: "delete",
      clientId,
      payload: { client_id: clientId },
    });
  });
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function listLocalPhotos(taskClientId: string): Promise<LocalPhoto[]> {
  const db = await getDatabase();
  return db.getAllAsync<LocalPhoto>(
    "SELECT * FROM task_photos WHERE task_client_id = ? ORDER BY sort_order ASC",
    taskClientId,
  );
}

/**
 * Register a captured photo.
 *
 * The file has already been copied into the app's document directory by the
 * caller, so it survives the OS clearing its image cache before the upload gets
 * a chance to run.
 */
export async function addLocalPhoto(params: {
  taskClientId: string;
  localUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  sortOrder: number;
}): Promise<string> {
  const db = await getDatabase();
  const clientId = newClientId();

  await db.runAsync(
    `INSERT INTO task_photos
       (client_id, task_client_id, local_uri, file_name, content_type,
        size_bytes, sort_order, created_at, upload_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
    clientId,
    params.taskClientId,
    params.localUri,
    params.fileName,
    params.contentType,
    params.sizeBytes,
    params.sortOrder,
    now(),
  );

  return clientId;
}

export async function removeLocalPhoto(clientId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM task_photos WHERE client_id = ?", clientId);
}

// ---------------------------------------------------------------------------
// Sync status for the UI
// ---------------------------------------------------------------------------

export type PendingCounts = {
  outbox: number;
  photos: number;
  failed: number;
};

export async function getPendingCounts(): Promise<PendingCounts> {
  const db = await getDatabase();

  const [outbox, photos, failed] = await Promise.all([
    db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM outbox"),
    db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM task_photos WHERE upload_state IN ('queued','uploading')",
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT (SELECT COUNT(*) FROM outbox WHERE attempts >= 5)
             + (SELECT COUNT(*) FROM task_photos WHERE upload_state = 'failed') AS count`,
    ),
  ]);

  return {
    outbox: outbox?.count ?? 0,
    photos: photos?.count ?? 0,
    failed: failed?.count ?? 0,
  };
}
