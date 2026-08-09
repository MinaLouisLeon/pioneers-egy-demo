import type * as SQLite from "expo-sqlite";

import { getDatabase } from "../db/schema";

export type OutboxEntity = "job" | "task" | "photo" | "certificate";
export type OutboxOperation = "insert" | "update" | "delete";

export type OutboxRow = {
  id: number;
  entity: OutboxEntity;
  operation: OutboxOperation;
  client_id: string;
  payload: string;
  attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
};

/** Give up after this many attempts and surface the row to the user. */
export const MAX_ATTEMPTS = 5;

/**
 * Append a mutation to the outbox.
 *
 * Takes an explicit `db` so callers can enqueue inside the same transaction
 * that made the local change — if the app dies between the two, the queue would
 * otherwise disagree with the data.
 */
export async function enqueue(
  db: SQLite.SQLiteDatabase,
  entry: {
    entity: OutboxEntity;
    operation: OutboxOperation;
    clientId: string;
    payload: unknown;
  },
): Promise<void> {
  // Collapse consecutive updates to the same record: only the latest state
  // matters, and a long offline editing session would otherwise queue dozens of
  // redundant round trips. Inserts and deletes are never collapsed — ordering
  // against other entities depends on them.
  if (entry.operation === "update") {
    const pending = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM outbox
       WHERE entity = ? AND client_id = ? AND operation = 'update' AND attempts = 0
       ORDER BY id DESC LIMIT 1`,
      entry.entity,
      entry.clientId,
    );

    if (pending) {
      await db.runAsync(
        "UPDATE outbox SET payload = ?, next_retry_at = NULL WHERE id = ?",
        JSON.stringify(entry.payload),
        pending.id,
      );
      return;
    }
  }

  await db.runAsync(
    `INSERT INTO outbox (entity, operation, client_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    entry.entity,
    entry.operation,
    entry.clientId,
    JSON.stringify(entry.payload),
    new Date().toISOString(),
  );
}

/**
 * Next batch of entries that are due.
 *
 * Strictly ordered by insertion id so a job always reaches the server before
 * the tasks that reference it.
 */
export async function claimBatch(limit = 25): Promise<OutboxRow[]> {
  const db = await getDatabase();
  const nowIso = new Date().toISOString();

  return db.getAllAsync<OutboxRow>(
    `SELECT * FROM outbox
     WHERE attempts < ?
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY id ASC
     LIMIT ?`,
    MAX_ATTEMPTS,
    nowIso,
    limit,
  );
}

export async function markSucceeded(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM outbox WHERE id = ?", id);
}

/**
 * Record a failure and schedule a retry with exponential backoff
 * (2s, 8s, 32s, 2m, 8m), so a server that is down is not hammered and a
 * device on a flaky connection still recovers on its own.
 */
export async function markFailed(row: OutboxRow, error: string): Promise<void> {
  const db = await getDatabase();
  const attempts = row.attempts + 1;
  const delayMs = Math.min(2000 * 4 ** row.attempts, 15 * 60 * 1000);
  const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

  await db.runAsync(
    "UPDATE outbox SET attempts = ?, last_error = ?, next_retry_at = ? WHERE id = ?",
    attempts,
    error.slice(0, 500),
    nextRetryAt,
    row.id,
  );
}

/** Clear backoff and attempt counts so a manual "retry now" takes effect. */
export async function resetFailures(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE outbox SET attempts = 0, next_retry_at = NULL");
  await db.runAsync(
    "UPDATE task_photos SET upload_state = 'queued', attempts = 0 WHERE upload_state = 'failed'",
  );
}
