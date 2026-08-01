import { describe, expect, it, vi } from "vitest"

import {
  acknowledgeSavedSearchMonitorForUserWithClient,
  createSavedSearchForUserWithClient,
  deleteSavedSearchForUserWithClient,
  listSavedSearchesForUserWithClient,
  setSavedSearchMonitorActionForUserWithClient,
  setSavedSearchMonitorEnabledForUserWithClient,
  SavedSearchError,
  savedSearchHref,
} from "./saved-searches"
import type { SavedSearchRecord } from "./saved-searches"

function savedSearchRecord(
  overrides: Partial<SavedSearchRecord> = {}
): SavedSearchRecord {
  return {
    collectionId: null,
    createdAt: new Date("2026-07-28T10:00:00.000Z"),
    definitionVersion: 1,
    description: null,
    folderId: null,
    id: "saved-search-1",
    monitorCursorArticleId: null,
    monitorCursorCreatedAt: null,
    monitorAction: "count",
    monitorEnabled: false,
    monitorLastRunAt: null,
    monitorNewMatchCount: 0,
    monitorNextRunAt: null,
    name: "Sea ice",
    publishedAfter: null,
    publishedBefore: null,
    query: "sea ice",
    state: "all",
    subscriptionId: null,
    updatedAt: new Date("2026-07-28T10:00:00.000Z"),
    userId: "user-1",
    ...overrides,
  }
}

function createStore({
  collection = { id: "collection-1" },
  folder = { id: "folder-1" },
  savedSearches = [savedSearchRecord()],
  subscription = { id: "subscription-1" },
}: {
  collection?: { id: string } | null
  folder?: { id: string } | null
  savedSearches?: ReturnType<typeof savedSearchRecord>[]
  subscription?: { id: string } | null
} = {}) {
  return {
    articleCollection: {
      findFirst: vi.fn().mockResolvedValue(collection),
    },
    feedSubscription: {
      findFirst: vi.fn().mockResolvedValue(subscription),
    },
    folder: {
      findFirst: vi.fn().mockResolvedValue(folder),
    },
    savedSearch: {
      create: vi.fn().mockResolvedValue(savedSearchRecord()),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue(savedSearches),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

describe("saved searches", () => {
  it("stores a canonical, versioned snapshot after proving every selected filter belongs to the user", async () => {
    const store = createStore()

    await createSavedSearchForUserWithClient({
      input: {
        description: "  Research   watchlist  ",
        filters: {
          collectionId: "collection-1",
          folderId: "folder-1",
          publishedAfter: new Date("2026-07-01T00:00:00.000Z"),
          publishedBefore: new Date("2026-08-01T00:00:00.000Z"),
          query: "  sea   ice  ",
          state: "starred",
          subscriptionId: "subscription-1",
        },
        name: "  Sea   ice  ",
      },
      store,
      userId: "user-1",
    })

    expect(store.articleCollection.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: "collection-1", userId: "user-1" },
    })
    expect(store.folder.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: "folder-1", userId: "user-1" },
    })
    expect(store.feedSubscription.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: "subscription-1", userId: "user-1" },
    })
    expect(store.savedSearch.create).toHaveBeenCalledWith({
      data: {
        collectionId: "collection-1",
        definitionVersion: 1,
        description: "Research watchlist",
        folderId: "folder-1",
        name: "Sea ice",
        publishedAfter: new Date("2026-07-01T00:00:00.000Z"),
        publishedBefore: new Date("2026-08-01T00:00:00.000Z"),
        query: "sea ice",
        state: "starred",
        subscriptionId: "subscription-1",
        userId: "user-1",
      },
    })
  })

  it("does not save a filter reference that the current user does not own", async () => {
    const store = createStore({ subscription: null })

    await expect(
      createSavedSearchForUserWithClient({
        input: {
          filters: {
            query: "sea ice",
            state: "all",
            subscriptionId: "another-users-subscription",
          },
          name: "Sea ice",
        },
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("A selected search filter is unavailable.")

    expect(store.savedSearch.create).not.toHaveBeenCalled()
  })

  it("rejects empty queries before touching the store", async () => {
    const store = createStore()

    await expect(
      createSavedSearchForUserWithClient({
        input: {
          filters: { query: "   ", state: "all" },
          name: "Empty",
        },
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Enter a search phrase before saving it.")

    expect(store.savedSearch.create).not.toHaveBeenCalled()
  })

  it("lists and deletes saved searches only inside the current user's scope", async () => {
    const store = createStore()

    await expect(
      listSavedSearchesForUserWithClient({ store, userId: "user-1" })
    ).resolves.toEqual([savedSearchRecord()])
    expect(store.savedSearch.findMany).toHaveBeenCalledWith({
      orderBy: [{ updatedAt: "desc" }],
      where: { userId: "user-1" },
    })

    await deleteSavedSearchForUserWithClient({
      savedSearchId: " saved-search-1 ",
      store,
      userId: "user-1",
    })
    expect(store.savedSearch.deleteMany).toHaveBeenCalledWith({
      where: { id: "saved-search-1", userId: "user-1" },
    })
  })

  it("reports a missing saved search without deleting another user's record", async () => {
    const store = createStore()
    store.savedSearch.deleteMany.mockResolvedValue({ count: 0 })

    await expect(
      deleteSavedSearchForUserWithClient({
        savedSearchId: "saved-search-1",
        store,
        userId: "user-1",
      })
    ).rejects.toBeInstanceOf(SavedSearchError)
  })

  it("starts a monitor at the current cursor and only inside the current user's scope", async () => {
    const store = createStore()
    const now = new Date("2026-07-29T12:00:00.000Z")

    await setSavedSearchMonitorEnabledForUserWithClient({
      enabled: true,
      now,
      savedSearchId: " saved-search-1 ",
      store,
      userId: "user-1",
    })

    expect(store.savedSearch.updateMany).toHaveBeenCalledWith({
      data: {
        monitorCursorArticleId: "",
        monitorCursorCreatedAt: now,
        monitorEnabled: true,
        monitorLastRunAt: null,
        monitorNextRunAt: now,
      },
      where: { id: "saved-search-1", userId: "user-1" },
    })
  })

  it("pauses and acknowledges a monitor without touching another user's row", async () => {
    const store = createStore()

    await setSavedSearchMonitorEnabledForUserWithClient({
      enabled: false,
      savedSearchId: "saved-search-1",
      store,
      userId: "user-1",
    })
    await acknowledgeSavedSearchMonitorForUserWithClient({
      savedSearchId: "saved-search-1",
      store,
      userId: "user-1",
    })

    expect(store.savedSearch.updateMany).toHaveBeenNthCalledWith(1, {
      data: {
        monitorEnabled: false,
        monitorNextRunAt: null,
      },
      where: { id: "saved-search-1", userId: "user-1" },
    })
    expect(store.savedSearch.updateMany).toHaveBeenNthCalledWith(2, {
      data: { monitorNewMatchCount: 0 },
      where: { id: "saved-search-1", userId: "user-1" },
    })
  })

  it("sets the new-match action only for the current user's saved search", async () => {
    const store = createStore()

    await setSavedSearchMonitorActionForUserWithClient({
      action: "star",
      savedSearchId: " saved-search-1 ",
      store,
      userId: "user-1",
    })

    expect(store.savedSearch.updateMany).toHaveBeenCalledWith({
      data: { monitorAction: "star" },
      where: { id: "saved-search-1", userId: "user-1" },
    })
  })

  it("reopens the saved filter snapshot through the versioned reader URL", () => {
    expect(
      savedSearchHref(
        savedSearchRecord({
          collectionId: "collection-1",
          folderId: "folder-1",
          publishedAfter: new Date("2026-07-01T00:00:00.000Z"),
          publishedBefore: new Date("2026-08-01T00:00:00.000Z"),
          state: "read",
          subscriptionId: "subscription-1",
        })
      )
    ).toBe(
      "/app/search?v=1&q=sea+ice&source=subscription-1&folder=folder-1&collection=collection-1&state=read&from=2026-07-01&to=2026-07-31"
    )
  })
})
