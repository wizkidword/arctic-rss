import * as SQLite from "expo-sqlite"

import {
  assertQueuedMutation,
  completePendingMobileMutation,
  createPendingMobileMutation,
  failPendingMobileMutation,
  isReplayableMobileMutation,
  MOBILE_OFFLINE_LIMITS,
  type QueuedMobileMutation,
  retryPendingMobileMutation,
  startPendingMobileMutation,
  type MobileProductMilestone,
  selectMobileCacheEvictions,
  type PendingMobileMutation,
} from "@arctic-rss/mobile-client"
import {
  syncCursorSchema,
  type UserSyncEvent,
  userSyncEventSchema,
} from "@arctic-rss/api-contract"

import {
  MOBILE_STORE_SCHEMA_VERSION,
  mobileStoreUpgrade,
} from "./mobile-store-schema"
import { readPendingMobileMutations, type StoredPendingMutationRow } from "./pending-mobile-mutations"

type CacheIndexRow = {
  accessedAt: number
  byteCount: number
  cacheKey: string
  updatedAt: number
}

type CachePayloadRow = { payload: string }
type StoreOwnerRow = { mobileDeviceId: string; ownerUserId: string }

export type MobileStoreOwner = { mobileDeviceId: string; userId: string }
export type MobileSqliteAdapter = Pick<typeof SQLite, "openDatabaseAsync">

const MOBILE_STORE_DATABASE_NAME = "arctic-rss-mobile.db"
const MOBILE_MUTATION_SEND_LEASE_MS = 60_000

export class MobileOfflineStore {
  private databasePromise: Promise<SQLite.SQLiteDatabase> | null = null
  private owner: MobileStoreOwner | null = null

  constructor(private readonly sqlite: MobileSqliteAdapter = SQLite) {}

  async claimOwner(owner: MobileStoreOwner) {
    const database = await this.database()
    await database.withExclusiveTransactionAsync(async (transaction) => {
      const existing = await transaction.getFirstAsync<StoreOwnerRow>(
        "SELECT ownerUserId, mobileDeviceId FROM mobile_store_metadata LIMIT 1"
      )
      if (existing && (existing.ownerUserId !== owner.userId || existing.mobileDeviceId !== owner.mobileDeviceId)) {
        await this.purge(transaction)
      }
      const now = Date.now()
      await transaction.runAsync(
        `INSERT OR REPLACE INTO mobile_store_metadata (id, schemaVersion, ownerUserId, mobileDeviceId, createdAt, updatedAt)
         VALUES (1, ?, ?, ?, COALESCE((SELECT createdAt FROM mobile_store_metadata WHERE id = 1), ?), ?)`,
        MOBILE_STORE_SCHEMA_VERSION,
        owner.userId,
        owner.mobileDeviceId,
        now,
        now
      )
    })
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
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.runAsync(
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
      const entries = await transaction.getAllAsync<CacheIndexRow>(
        "SELECT cacheKey, byteCount, updatedAt, accessedAt FROM mobile_cache"
      )
      for (const eviction of selectMobileCacheEvictions(
        entries.map((entry) => ({ ...entry, key: entry.cacheKey })),
        now
      )) {
        await transaction.runAsync("DELETE FROM mobile_cache WHERE cacheKey = ?", eviction)
      }
    })
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

  async queueMutation(mutation: QueuedMobileMutation) {
    const owner = await this.assertOwner()
    const pending = createPendingMobileMutation(mutation, owner)
    const database = await this.database()
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (!(await this.ownerRecordMatches(transaction, owner))) {
        throw new Error("Mobile offline storage ownership changed.")
      }
      await this.deleteCorruptPendingMutations(transaction)
      const rows = await transaction.getAllAsync<StoredPendingMutationRow>(
        "SELECT idempotencyKey, payload FROM mobile_pending_mutation"
      )
      const { mutations } = readPendingMobileMutations(rows)
      if (mutations.some((entry) => entry.idempotencyKey === pending.idempotencyKey)) {
        throw new Error("A matching offline change is already queued on this device.")
      }
      for (const completed of mutations.filter((entry) => entry.state === "COMPLETED")) {
        await transaction.runAsync(
          "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
          completed.idempotencyKey
        )
      }
      if (
        mutations.filter((entry) => entry.state !== "COMPLETED").length >=
        MOBILE_OFFLINE_LIMITS.maximumPendingMutations
      ) {
        throw new Error("The mobile offline queue is full. Reconnect before adding more changes.")
      }
      await transaction.runAsync(
        `INSERT INTO mobile_pending_mutation (idempotencyKey, payload, createdAt)
         VALUES (?, ?, ?)`,
        pending.idempotencyKey,
        JSON.stringify(pending),
        pending.createdAt
      )
    })
  }

  async pendingMutations(): Promise<PendingMobileMutation[]> {
    await this.assertOwner()
    const database = await this.database()
    const rows = await database.getAllAsync<StoredPendingMutationRow>(
      "SELECT idempotencyKey, payload FROM mobile_pending_mutation ORDER BY createdAt ASC"
    )
    const { corruptKeys, mutations } = readPendingMobileMutations(rows)
    if (corruptKeys.length > 0) {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (const idempotencyKey of corruptKeys) {
          await transaction.runAsync(
            "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
            idempotencyKey
          )
        }
      })
    }
    return mutations
  }

  async removePendingMutation(idempotencyKey: string) {
    await this.assertOwner()
    const database = await this.database()
    await database.runAsync(
      "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
      idempotencyKey
    )
  }

  async nextReplayableMutation(now = Date.now()): Promise<PendingMobileMutation | null> {
    const owner = await this.assertOwner()
    const database = await this.database()
    let next: PendingMobileMutation | null = null
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (!(await this.ownerRecordMatches(transaction, owner))) {
        throw new Error("Mobile offline storage ownership changed.")
      }
      await this.deleteCorruptPendingMutations(transaction)
      const rows = await transaction.getAllAsync<StoredPendingMutationRow>(
        "SELECT idempotencyKey, payload FROM mobile_pending_mutation ORDER BY createdAt ASC"
      )
      const { mutations } = readPendingMobileMutations(rows)
      const recoveredMutations = [...mutations]
      for (const [index, mutation] of recoveredMutations.entries()) {
        if (
          mutation.state === "SENDING" &&
          mutation.lastAttemptAt !== null &&
          now - mutation.lastAttemptAt >= MOBILE_MUTATION_SEND_LEASE_MS
        ) {
          const recovered = failPendingMobileMutation(mutation, {
            code: "INTERRUPTED_REPLAY",
            state: "RETRYABLE_FAILURE",
            updatedAt: now,
          })
          await this.writePendingMutation(transaction, recovered)
          recoveredMutations[index] = recovered
        }
      }
      const replayable = recoveredMutations.find((mutation) => isReplayableMobileMutation(mutation, now))
      if (!replayable) {
        return
      }
      const sending = startPendingMobileMutation(replayable, now)
      if (sending.state === "PERMANENT_FAILURE") {
        await this.writePendingMutation(transaction, sending)
        return
      }
      await this.writePendingMutation(transaction, sending)
      next = sending
    })
    return next
  }

  async completePendingMutation(idempotencyKey: string, now = Date.now()) {
    return this.updatePendingMutation(idempotencyKey, (mutation) =>
      completePendingMobileMutation(mutation, now)
    )
  }

  async failPendingMutation({
    code,
    idempotencyKey,
    state,
    now = Date.now(),
  }: {
    code: string
    idempotencyKey: string
    now?: number
    state: "CONFLICT" | "PERMANENT_FAILURE" | "RETRYABLE_FAILURE"
  }) {
    return this.updatePendingMutation(idempotencyKey, (mutation) =>
      failPendingMobileMutation(mutation, { code, state, updatedAt: now })
    )
  }

  async retryTerminalPendingMutation(idempotencyKey: string, now = Date.now()) {
    return this.updatePendingMutation(idempotencyKey, (mutation) =>
      retryPendingMobileMutation(mutation, now)
    )
  }

  async conflictMutations() {
    return (await this.pendingMutations()).filter(
      (mutation) => mutation.state === "CONFLICT" || mutation.state === "PERMANENT_FAILURE"
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

  async commitSyncPage({
    cursor,
    events,
    milestone,
  }: {
    cursor: string | null
    events: readonly UserSyncEvent[]
    milestone?: MobileProductMilestone
  }) {
    const owner = await this.assertOwner()
    for (const event of events) {
      userSyncEventSchema.parse(event)
    }
    if (cursor !== null) {
      syncCursorSchema.parse(cursor)
    }
    const database = await this.database()
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (!(await this.ownerRecordMatches(transaction, owner))) {
        throw new Error("Mobile offline storage ownership changed.")
      }
      // Event payloads are deliberately invalidation-only. Clearing the
      // bounded derived cache is safer than attempting partial projections.
      if (events.length > 0) {
        await transaction.runAsync("DELETE FROM mobile_cache")
      }
      if (cursor === null) {
        await transaction.runAsync("DELETE FROM mobile_sync_state WHERE key = 'cursor'")
      } else {
        await transaction.runAsync(
          "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES ('cursor', ?)",
          cursor
        )
      }
      if (milestone) {
        await transaction.runAsync(
          "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES (?, ?)",
          productMilestoneKey(milestone),
          "recorded"
        )
      }
    })
  }

  async bootstrapSync(highWaterCursor: string | null) {
    const owner = await this.assertOwner()
    if (highWaterCursor !== null) {
      syncCursorSchema.parse(highWaterCursor)
    }
    const database = await this.database()
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (!(await this.ownerRecordMatches(transaction, owner))) {
        throw new Error("Mobile offline storage ownership changed.")
      }
      // Keep pending mutations intact. API reads are authoritative for the
      // derived cache that this truthful high-water bootstrap replaces.
      await transaction.runAsync("DELETE FROM mobile_cache")
      if (highWaterCursor === null) {
        await transaction.runAsync("DELETE FROM mobile_sync_state WHERE key = 'cursor'")
      } else {
        await transaction.runAsync(
          "INSERT OR REPLACE INTO mobile_sync_state (key, value) VALUES ('cursor', ?)",
          highWaterCursor
        )
      }
    })
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
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(
        "DELETE FROM mobile_cache; DELETE FROM mobile_sync_state WHERE key = 'cursor';"
      )
    })
  }

  async purgeForLogout() {
    const database = await this.database()
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await this.purge(transaction)
    })
    this.owner = null
  }

  private async database() {
    if (!this.databasePromise) {
      this.databasePromise = this.openAndInitializeDatabase()
    }
    try {
      return await this.databasePromise
    } catch (error) {
      this.databasePromise = null
      throw error
    }
  }

  private async openAndInitializeDatabase() {
    const database = await this.sqlite.openDatabaseAsync(MOBILE_STORE_DATABASE_NAME)
    await database.execAsync("PRAGMA journal_mode = WAL;")
    const result = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version")
    const currentVersion = result?.user_version ?? 0
    const upgrade = mobileStoreUpgrade(currentVersion)
    if (upgrade === "none") {
      return database
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (upgrade === "upgrade-v1") {
        await this.upgradePendingMutationsFromVersion1(transaction)
        await transaction.execAsync(`PRAGMA user_version = ${MOBILE_STORE_SCHEMA_VERSION};`)
        return
      }
      await transaction.execAsync(`
      DROP TABLE IF EXISTS mobile_cache;
      DROP TABLE IF EXISTS mobile_pending_mutation;
      DROP TABLE IF EXISTS mobile_sync_state;
      DROP TABLE IF EXISTS mobile_store_metadata;
      CREATE TABLE mobile_cache (
        cacheKey TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        byteCount INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        accessedAt INTEGER NOT NULL
      );
      CREATE TABLE mobile_pending_mutation (
        idempotencyKey TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
      CREATE TABLE mobile_sync_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE TABLE mobile_store_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        schemaVersion INTEGER NOT NULL,
        ownerUserId TEXT NOT NULL,
        mobileDeviceId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      PRAGMA user_version = ${MOBILE_STORE_SCHEMA_VERSION};
    `)
    })
    return database
  }

  private async upgradePendingMutationsFromVersion1(database: SQLite.SQLiteDatabase) {
    const owner = await database.getFirstAsync<StoreOwnerRow>(
      "SELECT ownerUserId, mobileDeviceId FROM mobile_store_metadata WHERE id = 1"
    )
    const rows = await database.getAllAsync<StoredPendingMutationRow>(
      "SELECT idempotencyKey, payload FROM mobile_pending_mutation"
    )
    for (const row of rows) {
      try {
        const legacy = JSON.parse(row.payload) as QueuedMobileMutation
        assertQueuedMutation(legacy)
        if (
          legacy.idempotencyKey !== row.idempotencyKey ||
          !Number.isFinite(legacy.createdAt) ||
          legacy.createdAt <= 0 ||
          !owner
        ) {
          throw new Error("Legacy mobile mutation cannot be safely owned.")
        }
        const mutation = createPendingMobileMutation(legacy, {
          mobileDeviceId: owner.mobileDeviceId,
          userId: owner.ownerUserId,
        })
        await this.writePendingMutation(database, mutation)
      } catch {
        await database.runAsync(
          "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
          row.idempotencyKey
        )
      }
    }
  }

  private async assertOwner() {
    const owner = this.owner
    if (!owner) {
      throw new Error("Mobile offline storage has no authenticated owner.")
    }
    const database = await this.database()
    if (!(await this.ownerRecordMatches(database, owner))) {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await this.purge(transaction)
      })
      this.owner = null
      throw new Error("Mobile offline storage ownership changed.")
    }
    return owner
  }

  private async ownerRecordMatches(database: SQLite.SQLiteDatabase, owner: MobileStoreOwner) {
    const existing = await database.getFirstAsync<StoreOwnerRow>(
      "SELECT ownerUserId, mobileDeviceId FROM mobile_store_metadata WHERE id = 1"
    )
    return Boolean(
      existing &&
      existing.ownerUserId === owner.userId &&
      existing.mobileDeviceId === owner.mobileDeviceId
    )
  }

  private async deleteCorruptPendingMutations(database: SQLite.SQLiteDatabase) {
    const rows = await database.getAllAsync<StoredPendingMutationRow>(
      "SELECT idempotencyKey, payload FROM mobile_pending_mutation"
    )
    for (const idempotencyKey of readPendingMobileMutations(rows).corruptKeys) {
      await database.runAsync("DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?", idempotencyKey)
    }
  }

  private async updatePendingMutation(
    idempotencyKey: string,
    update: (mutation: PendingMobileMutation) => PendingMobileMutation
  ) {
    const owner = await this.assertOwner()
    const database = await this.database()
    let updated: PendingMobileMutation | null = null
    await database.withExclusiveTransactionAsync(async (transaction) => {
      if (!(await this.ownerRecordMatches(transaction, owner))) {
        throw new Error("Mobile offline storage ownership changed.")
      }
      const row = await transaction.getFirstAsync<StoredPendingMutationRow>(
        "SELECT idempotencyKey, payload FROM mobile_pending_mutation WHERE idempotencyKey = ?",
        idempotencyKey
      )
      if (!row) {
        throw new Error("The queued mobile mutation is unavailable.")
      }
      const parsed = readPendingMobileMutations([row])
      const mutation = parsed.mutations[0]
      if (!mutation || mutation.ownerUserId !== owner.userId || mutation.mobileDeviceId !== owner.mobileDeviceId) {
        await transaction.runAsync(
          "DELETE FROM mobile_pending_mutation WHERE idempotencyKey = ?",
          idempotencyKey
        )
        throw new Error("The queued mobile mutation no longer belongs to this session.")
      }
      updated = update(mutation)
      await this.writePendingMutation(transaction, updated)
    })
    if (!updated) {
      throw new Error("The queued mobile mutation is unavailable.")
    }
    return updated
  }

  private async writePendingMutation(
    database: SQLite.SQLiteDatabase,
    mutation: PendingMobileMutation
  ) {
    await database.runAsync(
      `INSERT OR REPLACE INTO mobile_pending_mutation (idempotencyKey, payload, createdAt)
       VALUES (?, ?, ?)`,
      mutation.idempotencyKey,
      JSON.stringify(mutation),
      mutation.createdAt
    )
  }

  private async purge(database: SQLite.SQLiteDatabase) {
    await database.execAsync(
      "DELETE FROM mobile_cache; DELETE FROM mobile_pending_mutation; DELETE FROM mobile_sync_state; DELETE FROM mobile_store_metadata;"
    )
  }
}

function productMilestoneKey(milestone: MobileProductMilestone) {
  return `product-milestone:${milestone}`
}
