
import { getDatabase } from "./database";

const MAX_CACHE_BYTES = 10 * 1024 * 1024; // 10 MB
const TARGET_CACHE_BYTES = MAX_CACHE_BYTES * 0.8;

export type CachedResource = {
  key: string;
  content: string;
  ttlMs: number;
};

/**
 * Save an optional text resource in SQLite.
 * Essential emergency instructions should also be bundled
 * with the app so they work without a previous download.
 */
export async function saveCachedResource({
  key,
  content,
  ttlMs,
}: CachedResource): Promise<void> {
  if (!key.trim()) {
    throw new Error("Cache key cannot be empty");
  }

  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Cache lifetime must be positive");
  }

  const sizeBytes = new TextEncoder().encode(content).length;

  if (sizeBytes > MAX_CACHE_BYTES) {
    throw new Error("Resource exceeds the 10 MB cache limit");
  }

  const db = await getDatabase();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO resource_cache
       (cache_key, content, size_bytes, cached_at, expires_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       content = excluded.content,
       size_bytes = excluded.size_bytes,
       cached_at = excluded.cached_at,
       expires_at = excluded.expires_at`,
    key,
    content,
    sizeBytes,
    now,
    now + ttlMs
  );

  await cleanCache();
}

/** Return a cached resource only while it is valid. */
export async function getCachedResource(
  key: string
): Promise<string | null> {
  const db = await getDatabase();

  const resource = await db.getFirstAsync<{
    content: string;
    expires_at: number;
  }>(
    `SELECT content, expires_at
     FROM resource_cache
     WHERE cache_key = ?`,
    key
  );

  if (!resource || resource.expires_at <= Date.now()) {
    if (resource) {
      await db.runAsync(
        "DELETE FROM resource_cache WHERE cache_key = ?",
        key
      );
    }

    return null;
  }

  return resource.content;
}

/** Remove expired optional resources and enforce the cache limit. */
export async function cleanCache(): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "DELETE FROM resource_cache WHERE expires_at <= ?",
      Date.now()
    );

    const result = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total
       FROM resource_cache`
    );

    let total = result?.total ?? 0;

    if (total <= MAX_CACHE_BYTES) {
      return;
    }

    const resources = await db.getAllAsync<{
      cache_key: string;
      size_bytes: number;
    }>(
      `SELECT cache_key, size_bytes
       FROM resource_cache
       ORDER BY cached_at ASC`
    );

    for (const resource of resources) {
      if (total <= TARGET_CACHE_BYTES) {
        break;
      }

      await db.runAsync(
        "DELETE FROM resource_cache WHERE cache_key = ?",
        resource.cache_key
      );

      total -= resource.size_bytes;
    }
  });
}

/** Report how much space optional cached content is using. */
export async function getCacheUsage(): Promise<{
  usedBytes: number;
  maxBytes: number;
}> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(size_bytes), 0) AS total
     FROM resource_cache`
  );

  return {
    usedBytes: result?.total ?? 0,
    maxBytes: MAX_CACHE_BYTES,
  };
}
