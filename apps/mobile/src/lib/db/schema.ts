import * as SQLite from "expo-sqlite";

/**
 * Local SQLite mirror.
 *
 * The app is local-first: every read and write hits this database, and a
 * background engine reconciles it with Supabase. That is what lets an inspector
 * complete a job in a basement with no signal and have it appear in the office
 * an hour later.
 *
 * Two ideas carry the design:
 *
 *  1. `client_id` is the primary key everywhere, not the server id. It is
 *     generated on device, so a row is addressable before the server has ever
 *     seen it, and a replayed insert collides instead of duplicating.
 *
 *  2. Nothing is written directly to Supabase. Mutations append to `outbox`,
 *     which the sync engine drains in order. A crash mid-sync therefore loses
 *     nothing — the queue is still on disk.
 */

const DATABASE_NAME = "pioneers.db";

export const SCHEMA_VERSION = 1;

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (database) return database;

  database = await SQLite.openDatabaseAsync(DATABASE_NAME, {
    // WAL keeps reads from blocking while the sync engine writes.
    enableChangeListener: false,
  });

  await migrate(database);
  return database;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  const result = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= SCHEMA_VERSION) return;

  await db.execAsync(`
    -- ---------------------------------------------------------------------
    -- Mirrored data
    -- ---------------------------------------------------------------------

    CREATE TABLE IF NOT EXISTS jobs (
      client_id     TEXT PRIMARY KEY NOT NULL,
      server_id     TEXT UNIQUE,
      project_name  TEXT NOT NULL,
      company_name  TEXT NOT NULL,
      visit_date    TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'draft',
      notes         TEXT,
      created_by    TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL,
      submitted_at  TEXT,
      deleted_at    TEXT,
      -- 'synced' | 'pending' | 'failed'
      sync_state    TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS jobs_visit_date_idx ON jobs (visit_date DESC);
    CREATE INDEX IF NOT EXISTS jobs_sync_state_idx ON jobs (sync_state);

    CREATE TABLE IF NOT EXISTS job_tasks (
      client_id      TEXT PRIMARY KEY NOT NULL,
      server_id      TEXT UNIQUE,
      job_client_id  TEXT NOT NULL REFERENCES jobs (client_id) ON DELETE CASCADE,
      category       TEXT NOT NULL,
      subtype        TEXT NOT NULL,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      data           TEXT NOT NULL DEFAULT '{}',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL,
      sync_state     TEXT NOT NULL DEFAULT 'pending'
    );

    CREATE INDEX IF NOT EXISTS job_tasks_job_idx ON job_tasks (job_client_id, sort_order);

    CREATE TABLE IF NOT EXISTS task_photos (
      client_id       TEXT PRIMARY KEY NOT NULL,
      server_id       TEXT UNIQUE,
      task_client_id  TEXT NOT NULL REFERENCES job_tasks (client_id) ON DELETE CASCADE,
      -- Where the file sits on this device until it reaches R2.
      local_uri       TEXT,
      r2_key          TEXT,
      file_name       TEXT NOT NULL,
      content_type    TEXT NOT NULL DEFAULT 'image/jpeg',
      size_bytes      INTEGER NOT NULL DEFAULT 0,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT NOT NULL,
      -- 'queued' | 'uploading' | 'uploaded' | 'failed'
      upload_state    TEXT NOT NULL DEFAULT 'queued',
      attempts        INTEGER NOT NULL DEFAULT 0,
      last_error      TEXT
    );

    CREATE INDEX IF NOT EXISTS task_photos_task_idx ON task_photos (task_client_id, sort_order);
    CREATE INDEX IF NOT EXISTS task_photos_upload_idx ON task_photos (upload_state);

    CREATE TABLE IF NOT EXISTS certificates (
      client_id           TEXT PRIMARY KEY NOT NULL,
      server_id           TEXT UNIQUE,
      title               TEXT NOT NULL,
      file_name           TEXT NOT NULL,
      r2_key              TEXT,
      size_bytes          INTEGER NOT NULL DEFAULT 0,
      company_name        TEXT,
      certificate_number  TEXT,
      issue_date          TEXT,
      expiry_date         TEXT,
      job_server_id       TEXT,
      uploaded_by         TEXT NOT NULL,
      created_at          TEXT NOT NULL,
      updated_at          TEXT NOT NULL,
      sync_state          TEXT NOT NULL DEFAULT 'pending'
    );

    -- ---------------------------------------------------------------------
    -- Outbox
    -- ---------------------------------------------------------------------

    CREATE TABLE IF NOT EXISTS outbox (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      entity        TEXT NOT NULL,          -- 'job' | 'task' | 'photo' | 'certificate'
      operation     TEXT NOT NULL,          -- 'insert' | 'update' | 'delete'
      client_id     TEXT NOT NULL,
      payload       TEXT NOT NULL,          -- JSON
      attempts      INTEGER NOT NULL DEFAULT 0,
      last_error    TEXT,
      -- Exponential backoff: the drain loop skips rows until this time.
      next_retry_at TEXT,
      created_at    TEXT NOT NULL
    );

    -- Order matters when draining: a task cannot be sent before its job.
    CREATE INDEX IF NOT EXISTS outbox_order_idx ON outbox (id ASC);
    CREATE INDEX IF NOT EXISTS outbox_entity_idx ON outbox (entity, client_id);

    -- ---------------------------------------------------------------------
    -- Sync bookkeeping
    -- ---------------------------------------------------------------------

    CREATE TABLE IF NOT EXISTS sync_meta (
      key    TEXT PRIMARY KEY NOT NULL,
      value  TEXT
    );
  `);

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/** Wipe all local data. Used on sign-out so a shared device leaks nothing. */
export async function clearDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    DELETE FROM outbox;
    DELETE FROM task_photos;
    DELETE FROM job_tasks;
    DELETE FROM jobs;
    DELETE FROM certificates;
    DELETE FROM sync_meta;
  `);
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM sync_meta WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}
