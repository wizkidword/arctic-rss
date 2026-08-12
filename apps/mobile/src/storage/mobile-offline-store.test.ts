import { describe, expect, it, vi } from "vitest"

import type { QueuedMobileMutation } from "@arctic-rss/mobile-client"
import type { UserSyncEvent } from "@arctic-rss/api-contract"

import {
  MobileOfflineStore,
  type MobileSqliteAdapter,
} from "./mobile-offline-store"

vi.mock("expo-sqlite", () => ({ openDatabaseAsync: vi.fn() }))

const firstOwner = { mobileDeviceId: "device-one", userId: "user-one" }
const secondOwner = { mobileDeviceId: "device-two", userId: "user-two" }

describe("mobile offline SQLite ownership and recovery", () => {
  it("purges cached data and queued changes before accepting an account switch", async () => {
    const { store } = createStore()
    await store.claimOwner(firstOwner)
    await store.cache("reader:one", { title: "Private article" })
    await store.queueMutation(queuedMutation("a".repeat(16)))

    await store.claimOwner(secondOwner)

    await expect(store.cached("reader:one")).resolves.toBeNull()
    await expect(store.pendingMutations()).resolves.toEqual([])
  })

  it("recovers an interrupted replay with backoff and preserves its idempotency key", async () => {
    const { store } = createStore()
    const idempotencyKey = "b".repeat(16)
    await store.claimOwner(firstOwner)
    await store.queueMutation(queuedMutation(idempotencyKey))

    const firstSend = await store.nextReplayableMutation(1_000)
    const recovered = await store.nextReplayableMutation(61_000)
    const recoveredSend = await store.nextReplayableMutation(66_000)

    expect(firstSend).toMatchObject({ attemptCount: 1, idempotencyKey, state: "SENDING" })
    expect(recovered).toBeNull()
    expect(recoveredSend).toMatchObject({
      attemptCount: 2,
      idempotencyKey,
      lastErrorCode: "INTERRUPTED_REPLAY",
      state: "SENDING",
    })
  })

  it("leaves the previous owner data intact when a replacement owner write fails", async () => {
    const { database, store } = createStore()
    await store.claimOwner(firstOwner)
    await store.cache("reader:one", { title: "Private article" })
    await store.queueMutation(queuedMutation("c".repeat(16)))
    database.failNextOwnerWrite()

    await expect(store.claimOwner(secondOwner)).rejects.toThrow("storage unavailable")

    await expect(store.cached("reader:one")).resolves.toEqual({ title: "Private article" })
    await expect(store.pendingMutations()).resolves.toHaveLength(1)
  })

  it("invalidates only cache entries affected by an article sync event", async () => {
    const { store } = createStore()
    await store.claimOwner(firstOwner)
    await store.cache("article:article-one", { title: "Changed article" })
    await store.cache("mobile-page:reader:all:starred", { items: ["article-one"] })
    await store.cache("collections", { data: ["collection-one"] })
    await store.cache("notification-preferences", { data: "unchanged" })

    await store.commitSyncPage({ cursor: "1", events: [articleStateEvent()] })

    await expect(store.cached("article:article-one")).resolves.toBeNull()
    await expect(store.cached("mobile-page:reader:all:starred")).resolves.toBeNull()
    await expect(store.cached("collections")).resolves.toEqual({ data: ["collection-one"] })
    await expect(store.cached("notification-preferences")).resolves.toEqual({ data: "unchanged" })
    await expect(store.getCursor()).resolves.toBe("1")
  })

  it("invalidates only notification settings for a notification preference event", async () => {
    const { store } = createStore()
    await store.claimOwner(firstOwner)
    await store.cache("notification-preferences", { data: "changed" })
    await store.cache("mobile-page:reader:all:unread", { items: ["article-one"] })

    await store.commitSyncPage({ cursor: "2", events: [notificationPreferenceEvent()] })

    await expect(store.cached("notification-preferences")).resolves.toBeNull()
    await expect(store.cached("mobile-page:reader:all:unread")).resolves.toEqual({ items: ["article-one"] })
  })

  it("keeps selected collections owner-scoped and clears them with downloaded data", async () => {
    const { store } = createStore()
    await store.claimOwner(firstOwner)
    await store.cache("article:article-one", { title: "Available offline" })
    await store.setCollectionOfflineSelected("collection-one", true)

    await expect(store.offlineStatus()).resolves.toMatchObject({
      cachedEntries: 1,
      selectedCollectionIds: ["collection-one"],
    })

    await store.clearDownloadedData()

    await expect(store.offlineStatus()).resolves.toMatchObject({
      cachedEntries: 0,
      selectedCollectionIds: [],
    })
  })
})

function articleStateEvent(): UserSyncEvent {
  return {
    action: "UPSERT",
    occurredAt: "2026-08-12T12:00:00.000Z",
    payload: {
      archivedAt: null,
      articleId: "article-one",
      isRead: true,
      isStarred: true,
      readAt: "2026-08-12T12:00:00.000Z",
      starredAt: "2026-08-12T12:00:00.000Z",
    },
    resourceId: "article-one",
    resourceType: "article-state",
    resourceVersion: "1",
    schemaVersion: 1,
    sequence: "1",
  }
}

function notificationPreferenceEvent(): UserSyncEvent {
  return {
    action: "UPSERT",
    occurredAt: "2026-08-12T12:00:00.000Z",
    payload: { channel: "EMAIL", topic: "SECURITY_ALERTS" },
    resourceId: "notification-one",
    resourceType: "notification-preference",
    resourceVersion: "1",
    schemaVersion: 1,
    sequence: "2",
  }
}

function queuedMutation(idempotencyKey: string): QueuedMobileMutation {
  return {
    body: { isRead: true },
    createdAt: 1_000,
    idempotencyKey,
    method: "PATCH",
    path: "/api/v1/articles/article-one/state",
  }
}

function createStore() {
  const database = new MemorySqliteDatabase()
  const sqlite = {
    openDatabaseAsync: vi.fn(async () => database),
  } as unknown as MobileSqliteAdapter
  return { database, store: new MobileOfflineStore(sqlite) }
}

type CachedRow = {
  accessedAt: number
  byteCount: number
  cacheKey: string
  payload: string
  updatedAt: number
}

type MutationRow = { createdAt: number; idempotencyKey: string; payload: string }
type OwnerRow = { createdAt: number; mobileDeviceId: string; ownerUserId: string; updatedAt: number }
type StoreState = {
  cache: Map<string, CachedRow>
  mutations: Map<string, MutationRow>
  owner: OwnerRow | null
  sync: Map<string, string>
  userVersion: number
}

class MemorySqliteDatabase {
  private state: StoreState = {
    cache: new Map(),
    mutations: new Map(),
    owner: null,
    sync: new Map(),
    userVersion: 0,
  }
  private ownerWriteFailure = false

  failNextOwnerWrite() {
    this.ownerWriteFailure = true
  }

  async execAsync(query: string) {
    const normalized = normalize(query)
    if (normalized.includes("DROP TABLE IF EXISTS MOBILE_CACHE")) {
      this.state.cache.clear()
      this.state.mutations.clear()
      this.state.owner = null
      this.state.sync.clear()
    }
    if (normalized.includes("DELETE FROM MOBILE_CACHE")) {
      this.state.cache.clear()
    }
    if (normalized.includes("DELETE FROM MOBILE_PENDING_MUTATION")) {
      this.state.mutations.clear()
    }
    if (normalized.includes("DELETE FROM MOBILE_STORE_METADATA")) {
      this.state.owner = null
    }
    if (normalized.includes("DELETE FROM MOBILE_SYNC_STATE")) {
      this.state.sync.clear()
    }
    const version = normalized.match(/PRAGMA USER_VERSION = (\d+)/)
    if (version) {
      this.state.userVersion = Number(version[1])
    }
  }

  async getAllAsync<T>(query: string): Promise<T[]> {
    const normalized = normalize(query)
    if (normalized.includes("FROM MOBILE_PENDING_MUTATION")) {
      return [...this.state.mutations.values()]
        .sort((left, right) => left.createdAt - right.createdAt)
        .map((row) => ({ idempotencyKey: row.idempotencyKey, payload: row.payload }) as T)
    }
    if (normalized.includes("FROM MOBILE_CACHE")) {
      return [...this.state.cache.values()].map((row) => ({
        accessedAt: row.accessedAt,
        byteCount: row.byteCount,
        cacheKey: row.cacheKey,
        updatedAt: row.updatedAt,
      }) as T)
    }
    if (normalized.includes("FROM MOBILE_SYNC_STATE") && normalized.includes("OFFLINE-COLLECTION")) {
      return [...this.state.sync.keys()]
        .filter((key) => key.startsWith("offline-collection:"))
        .sort()
        .map((key) => ({ key }) as T)
    }
    return []
  }

  async getFirstAsync<T>(query: string, ...parameters: unknown[]): Promise<T | null> {
    const normalized = normalize(query)
    if (normalized === "PRAGMA USER_VERSION") {
      return { user_version: this.state.userVersion } as T
    }
    if (normalized.includes("FROM MOBILE_STORE_METADATA")) {
      return this.state.owner ? {
        mobileDeviceId: this.state.owner.mobileDeviceId,
        ownerUserId: this.state.owner.ownerUserId,
      } as T : null
    }
    if (normalized.includes("COUNT(*) AS CACHEDENTRIES") && normalized.includes("FROM MOBILE_CACHE")) {
      const entries = [...this.state.cache.values()]
      return {
        cachedBytes: entries.reduce((total, entry) => total + entry.byteCount, 0),
        cachedEntries: entries.length,
      } as T
    }
    if (normalized.includes("FROM MOBILE_CACHE")) {
      const row = this.state.cache.get(String(parameters[0]))
      return row ? { payload: row.payload } as T : null
    }
    if (normalized.includes("FROM MOBILE_PENDING_MUTATION")) {
      const row = this.state.mutations.get(String(parameters[0]))
      return row ? { idempotencyKey: row.idempotencyKey, payload: row.payload } as T : null
    }
    if (normalized.includes("FROM MOBILE_SYNC_STATE")) {
      const value = this.state.sync.get(String(parameters[0] ?? "cursor"))
      return value === undefined ? null : { value } as T
    }
    return null
  }

  async runAsync(query: string, ...parameters: unknown[]) {
    const normalized = normalize(query)
    if (normalized.includes("INSERT OR REPLACE INTO MOBILE_STORE_METADATA")) {
      if (this.ownerWriteFailure) {
        this.ownerWriteFailure = false
        throw new Error("storage unavailable")
      }
      const previous = this.state.owner
      this.state.owner = {
        createdAt: previous?.createdAt ?? Number(parameters[3]),
        mobileDeviceId: String(parameters[2]),
        ownerUserId: String(parameters[1]),
        updatedAt: Number(parameters[4]),
      }
      return
    }
    if (normalized.includes("INSERT INTO MOBILE_CACHE")) {
      const key = String(parameters[0])
      this.state.cache.set(key, {
        accessedAt: Number(parameters[4]),
        byteCount: Number(parameters[2]),
        cacheKey: key,
        payload: String(parameters[1]),
        updatedAt: Number(parameters[3]),
      })
      return
    }
    if (normalized.startsWith("UPDATE MOBILE_CACHE SET ACCESSEDAT")) {
      const row = this.state.cache.get(String(parameters[1]))
      if (row) {
        row.accessedAt = Number(parameters[0])
      }
      return
    }
    if (normalized.startsWith("DELETE FROM MOBILE_CACHE WHERE")) {
      this.state.cache.delete(String(parameters[0]))
      return
    }
    if (normalized.includes("INTO MOBILE_PENDING_MUTATION")) {
      const idempotencyKey = String(parameters[0])
      this.state.mutations.set(idempotencyKey, {
        createdAt: Number(parameters[2]),
        idempotencyKey,
        payload: String(parameters[1]),
      })
      return
    }
    if (normalized.startsWith("DELETE FROM MOBILE_PENDING_MUTATION WHERE")) {
      this.state.mutations.delete(String(parameters[0]))
      return
    }
    if (normalized.includes("INTO MOBILE_SYNC_STATE")) {
      if (normalized.includes("VALUES ('CURSOR', ?)")) {
        this.state.sync.set("cursor", String(parameters[0]))
      } else {
        this.state.sync.set(String(parameters[0]), String(parameters[1]))
      }
      return
    }
    if (normalized.startsWith("DELETE FROM MOBILE_SYNC_STATE WHERE")) {
      this.state.sync.delete(String(parameters[0] ?? "cursor"))
    }
  }

  async withExclusiveTransactionAsync<T>(action: (transaction: MemorySqliteDatabase) => Promise<T>) {
    const transaction = new MemorySqliteDatabase()
    transaction.state = cloneState(this.state)
    transaction.ownerWriteFailure = this.ownerWriteFailure
    try {
      const result = await action(transaction)
      this.state = transaction.state
      this.ownerWriteFailure = transaction.ownerWriteFailure
      return result
    } catch (error) {
      this.ownerWriteFailure = transaction.ownerWriteFailure
      throw error
    }
  }
}

function cloneState(state: StoreState): StoreState {
  return {
    cache: new Map([...state.cache.entries()].map(([key, row]) => [key, { ...row }])),
    mutations: new Map([...state.mutations.entries()].map(([key, row]) => [key, { ...row }])),
    owner: state.owner ? { ...state.owner } : null,
    sync: new Map(state.sync),
    userVersion: state.userVersion,
  }
}

function normalize(query: string) {
  return query.replace(/\s+/g, " ").trim().toUpperCase()
}
