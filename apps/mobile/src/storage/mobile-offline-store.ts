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
type StoreOwnerRow = { mobileDeviceId: string; ownerUserId: string }

export type MobileStoreOwner = { mobileDeviceId: string; userId: string }

export class MobileOfflineStore {
  private databasePromise: ReturnType<typeof SQLite.openDatabaseAsync> | null = null
  private owner: MobileStoreOwner | null = null

  async claimOwner(owner: MobileStoreOwner) {
    const database = await this.database()
    const existing = await database.getFirstAsync<StoreOwnerRow>(
      "SELECT ownerUserId, mobileDeviceId FROM mobile_store_metadata LIMIT 1"
    )
    if (existing && (existing.ownerUserId !== owner.userId || existing.mobileDeviceId !== owner.mobileDeviceId)) {
      await this.purge(database)
    }
    await database.runAsync(
      `INSERT OR REPLACE INTO mobile_store_metadata (id, schemaVersion, ownerUserId, mobileDeviceId, createdAt, updatedAt)
       VALUES (1, 1, ?, ?, COALESCE((SELECT createdAt FROM mobile_store_metadata WHERE id = 1), ?), ?)`,
      owner.userId,
      owner.mobileDeviceId,
      Date.now(),
      Date.now()
    )
    this.owner = owner
  }

  async cache<T>(cacheKey: string, value: T) {
    await this.assertOwner()
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
    await this.assertOwner()
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
    await this.assertOwner()
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
    await this.assertOwner()
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
    await this.assertOwner()
    const database = await this.database()
    await database.runAsync(
      "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
      idempotencyKey
    )
  }

  async getCursor() {
    await this.assertOwner()
    const database = await this.database()
    return (await database.getFirstAsync<{ value: string }>(
      "SELECT value FROM mobile_sync_state WHERE key = 'cursor'"
    ))?.value ?? null
  }

  async setCursor(cursor: string | null) {
    await this.assertOwner()
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
    await this.assertOwner()
    const database = await this.database()
    return Boolean(
      await database.getFirstAsync<{ value: string }>(
        "SELECT value FROM mobile_sync_state WHERE key = ?",
        productMilestoneKey(milestone)
      )
    )
  }

  async markProductMilestone(milestone: MobileProductMilestone) {
    await this.assertOwner()
    const database = await this.database()
    await database.runAsync(
      "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES (?, ?)",
      productMilestoneKey(milestone),
      "recorded"
    )
  }

  async clearDownloadedData() {
    await this.assertOwner()
    const database = await this.database()
    await database.execAsync(
      "DELETE FROM mobile_cache; DELETE FROM mobile_sync_state WHERE key = 'cursor';"
    )
  }

  async purgeForLogout() {
    const database = await this.database()
    await this.purge(database)
    this.owner = null
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
      CREATE TABLE IF NOT EXISTS mobile_store_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schemaVersion INTEGER NOT NULL,
        ownerUserId TEXT NOT NULL,
        mobileDeviceId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `)
    return database
  }

  private async assertOwner() {
    if (!this.owner) {
      throw new Error("Mobile offline storage has no authenticated owner.")
    }
    const database = await this.database()
    const existing = await database.getFirstAsync<StoreOwnerRow>(
      "SELECT ownerUserId, mobileDeviceId FROM mobile_store_metadata WHERE id = 1"
    )
    if (!existing || existing.ownerUserId !== this.owner.userId || existing.mobileDeviceId !== this.owner.mobileDeviceId) {
      await this.purge(database)
      this.owner = null
      throw new Error("Mobile offline storage ownership changed.")
    }
  }

  private async purge(database: Awaited<ReturnType<typeof SQLite.openDatabaseAsync>>) {
    await database.execAsync(
      "DELETE FROM mobile_cache; DELETE FROM mobile_pending_mutation; DELETE FROM mobile_sync_state; DELETE FROM mobile_store_metadata;"
    )
  }
}

function productMilestoneKey(milestone: MobileProductMilestone) {
  return `product-milestone:${milestone}`
}
