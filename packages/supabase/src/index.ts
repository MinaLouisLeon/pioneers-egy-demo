export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./database.types";

/**
 * Client factories are intentionally NOT re-exported here. Each runtime pulls
 * the one it needs from its own entrypoint (`@pioneers/supabase/browser`,
 * `/server`, `/admin`, `/native`) so that, for example, the browser bundle can
 * never accidentally reach the service-role client.
 */
