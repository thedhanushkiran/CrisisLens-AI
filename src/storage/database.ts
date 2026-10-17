
import * as SQLite from "expo-sqlite";

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens the local database and creates the required tables.
 * The database persists across app restarts and offline sessions.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error) => {
      // Allow a later call to retry if initialization fails.
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync("crisislens.db");

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS emergency_reports (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location_text TEXT,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'relayed',
            'server_received'
          )
        )
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY NOT NULL,
      report_id TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
          status IN (
            'pending',
            'sending',
            'retry',
            'delivered'
          )
        ),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      last_error TEXT,
      FOREIGN KEY (report_id)
        REFERENCES emergency_reports(id)
        ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_outbox_ready
      ON outbox(status, next_attempt_at, created_at);

    CREATE TABLE IF NOT EXISTS resource_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      content TEXT NOT NULL,
      size_bytes INTEGER NOT NULL DEFAULT 0
        CHECK (size_bytes >= 0),
      cached_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cache_expiry
      ON resource_cache(expires_at);
  `);

  return db;
}
