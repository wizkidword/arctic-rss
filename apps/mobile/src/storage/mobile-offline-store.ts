import * as SQLite from "expo-sqlite"

import {
  assertPendingMobileMutation,
  assertQueuedMutation,
  type MobileProductMilestone,
  selectMobileCacheEvictions,
  type PendingMobileMutation,
} from "@arctic-rss/mobile-client"

type CacheIndexRow = {
  accessedAt: number
  byteCount: number
  cacheKey: string
  updatedAt: number
}

type CachePayloadRow = { payload: string }
type PendingMutationRow = { idempotencyKey: string; payload: string }

export class MobileOfflineStore {
  private databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null

  async cache<T>(cacheKey: string, value: T) {
    const payload = JSON.stringify(value)
    const byteCount = new TextEncoder().encode(payload).byteLength
    if (byteCount > 2 * 1024 * 1024) {
      throw new Error("Mobile cache entries must remain bounded.")
    }
    const now = Date.now()
    const database = await this.database()
    await database.runAsync(
      `INSERT INTO mobile_cache (cacheKey, payload, byteCount, updatedAt, accessedAt)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(cacheKey) DO UPDATE SET
         payload = excluded.payload,
         byteCount = excluded.byteCount,
         updatedAt = excluded.updatedAt,
         accessedAt = excluded.accessedAt`,
      cacheKey,
      payload,
      byteCount,
      now,
      now
    )
    const entries = await database.getAllAsync<CacheIndexRow>(
      "SELECT cacheKey, byteCount, updatedAt, accessedAt FROM mobile_cache"
    )
    for (const eviction of selectMobileCacheEvictions(
      entries.map((entry) => ({ ...entry, key: entry.cacheKey })),
      now
    )) {
      await database.runAsync("DELETE FROM mobile_cache WHERE cacheKey = ?", eviction)
    }
  }

  async cached<T>(cacheKey: string): Promise<T | null> {
    const database = await this.database()
    const row = await database.getFirstAsync<CachePayloadRow>(
      "SELECT payload FROM mobile_cache WHERE cacheKey = ?",
      cacheKey
    )
    if (!row) {
      return null
    }
    await database.runAsync("UPDATE mobile_cache SET accessedAt = ? WHERE cacheKey = ?", Date.now(), cacheKey)
    try {
      return JSON.parse(row.payload) as T
    } catch {
      await database.runAsync("DELETE FROM mobile_cache WHERE cacheKey = ?", cacheKey)
      return null
    }
  }

  async queueMutation(mutation: PendingMobileMutation) {
    assertQueuedMutation(mutation)
    assertPendingMobileMutation(mutation)
    const database = await this.database()
    const count = await database.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM mobile_pending_mutation"
    )
    if ((count?.count ?? 0) >= 100) {
      throw new Error("The mobile offline queue is full. Reconnect before adding more changes.")
    }
    await database.runAsync(
      `INSERT OR REPLACE INTO mobile_pending_mutation (idempotencyKey, payload, createdAt)
       VALUES (?, ?, ?)`,
      mutation.idempotencyKey,
      JSON.stringify(mutation),
      mutation.createdAt
    )
  }

  async pendingMutations(): Promise<PendingMobileMutation[]> {
    const database = await this.database()
    const rows = await database.getAllAsync<PendingMutationRow>(
      "SELECT idempotencyKey, payload FROM mobile_pending_mutation ORDER BY createdAt ASC"
    )
    return rows.flatMap((row) => {
      try {
        const mutation = JSON.parse(row.payload) as PendingMobileMutation
        assertQueuedMutation(mutation)
        assertPendingMobileMutation(mutation)
        return [mutation]
      } catch {
        return []
      }
    })
  }

  async removePendingMutation(idempotencyKey: string) {
    const database = await this.database()
    await database.runAsync(
      "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
      idempotencyKey
    )
  }

  async getCursor() {
    const database = await this.database()
    return (await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM mobile_sync_state WHERE key = 'cursor'"
    ))?.value ?? null
  }

  async setCursor(cursor: string | null) {
    const database = await this.database()
    if (cursor === null) {
      await database.runAsync("DELETE FROM mobile_sync_state WHERE key = 'cursor'")
      return
    }
    await database.runAsync(
      "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES ('cursor', ?)",
      cursor
    )
  }

  async hasProductMilestone(milestone: MobileProductMilestone) {
    const database = await this.database()
    return Boolean(
      await database.getFirstAsync<{ value: string }>(
        "SELECT value FROM mobile_sync_state WHERE key = ?",
        productMilestoneKey(milestone)
      )
    )
  }

  async markProductMilestone(milestone: MobileProductMilestone) {
    const database = await this.database()
    await database.runAsync(
      "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES (?, ?)",
      productMilestoneKey(milestone),
      "recorded"
    )
  }

  async clearDownloadedData() {
    const database = await this.database()
    await database.execAsync(
      "DELETE FROM mobile_cache; DELETE FROM mobile_sync_state WHERE key = 'cursor';"
    )
  }

  async purgeForLogout() {
    const database = await this.database()
    await database.execAsync(
      "DELETE FROM mobile_cache; DELETE FROM mobile_pending_mutation; DELETE FROM mobile_sync_state;"
    )
  }

  private async database() {
    if (!this.databasePromise) {
      this.databasePromise = SQLite.openDatabaseAsync("arctic-rss-mobile.db")
    }
    const database = await this.databasePromise
    await database.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS mobile_cache (
        cacheKey TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        byteCount INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        accessedAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mobile_pending_mutation (
        idempotencyKey TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mobile_sync_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `)
    return database
  }
}

function productMilestoneKey(milestone: MobileProductMilestone) {
  return `product-milestone:${milestone}`
}
