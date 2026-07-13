import { describe, expect, it, vi } from "vitest"

const { folderFindMany, getUnreadArticleCountsByFeed, reactCache } = vi.hoisted(() => ({
  folderFindMany: vi.fn(),
  getUnreadArticleCountsByFeed: vi.fn(),
  reactCache: vi.fn((loader) => loader),
}))

vi.mock("react", () => ({
  cache: reactCache,
}))

vi.mock("./articles", () => ({
  getUnreadArticleCountsByFeed,
}))

vi.mock("./db", () => ({
  getPrisma: () => ({
    folder: {
      findMany: folderFindMany,
    },
  }),
}))

import {
  createFolderWithClient,
  deleteFolderWithClient,
  listUserFolders,
  moveSubscriptionToFolderWithClient,
  renameFolderWithClient,
} from "./folders"

function createFolderStore() {
  const transaction = {
    feedSubscription: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    folder: {
      create: vi.fn().mockResolvedValue({ id: "folder-1", name: "Tech" }),
      delete: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({ id: "folder-1", name: "Science" }),
    },
  }

  return {
    ...transaction,
    $transaction: vi.fn(async (callback) => callback(transaction)),
  }
}

describe("folders", () => {
  it("creates the reader loader through React cache", () => {
    expect(reactCache).toHaveBeenCalledTimes(1)
    expect(reactCache).toHaveBeenCalledWith(expect.any(Function))
    expect(reactCache.mock.calls[0]?.[0].name).toBe("listUserFolders")
  })

  it("creates a folder scoped to the current user", async () => {
    const store = createFolderStore()

    const folder = await createFolderWithClient({
      name: "  Tech  ",
      store,
      userId: "user-1",
    })

    expect(folder).toEqual({ id: "folder-1", name: "Tech" })
    expect(store.folder.create).toHaveBeenCalledWith({
      data: {
        name: "Tech",
        userId: "user-1",
      },
      select: {
        id: true,
        name: true,
      },
    })
  })

  it("rejects empty folder names", async () => {
    const store = createFolderStore()

    await expect(
      createFolderWithClient({
        name: "   ",
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Folder name is required.")

    expect(store.folder.create).not.toHaveBeenCalled()
  })

  it("renames only a folder owned by the current user", async () => {
    const store = createFolderStore()
    store.folder.findFirst.mockResolvedValue({ id: "folder-1" })

    await renameFolderWithClient({
      folderId: "folder-1",
      name: "Science",
      store,
      userId: "user-1",
    })

    expect(store.folder.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "folder-1",
        userId: "user-1",
      },
    })
    expect(store.folder.update).toHaveBeenCalledWith({
      data: { name: "Science" },
      where: { id: "folder-1" },
    })
  })

  it("deletes a folder without deleting subscriptions", async () => {
    const store = createFolderStore()
    store.folder.findFirst.mockResolvedValue({ id: "folder-1" })

    const result = await deleteFolderWithClient({
      folderId: "folder-1",
      store,
      userId: "user-1",
    })

    expect(result).toEqual({ movedSubscriptions: 2 })
    expect(store.$transaction).toHaveBeenCalledTimes(1)
    expect(store.feedSubscription.updateMany).toHaveBeenCalledWith({
      data: {
        folderId: null,
      },
      where: {
        folderId: "folder-1",
        userId: "user-1",
      },
    })
    expect(store.folder.delete).toHaveBeenCalledWith({
      where: { id: "folder-1" },
    })
  })

  it("loads folder unread counts from one grouped feed lookup", async () => {
    folderFindMany.mockResolvedValue([
      {
        id: "folder-1",
        name: "News",
        subscriptions: [{ feedId: "feed-1" }, { feedId: "feed-2" }],
      },
      {
        id: "folder-2",
        name: "Tech",
        subscriptions: [{ feedId: "feed-3" }],
      },
    ])
    getUnreadArticleCountsByFeed.mockResolvedValue(
      new Map([
        ["feed-1", 2],
        ["feed-2", 3],
        ["feed-3", 5],
      ])
    )

    const folders = await listUserFolders("user-1")

    expect(folderFindMany).toHaveBeenCalledWith({
      include: {
        subscriptions: {
          select: {
            feedId: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      where: { userId: "user-1" },
    })
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledTimes(1)
    expect(getUnreadArticleCountsByFeed).toHaveBeenCalledWith("user-1", [
      "feed-1",
      "feed-2",
      "feed-3",
    ])
    expect(folders).toEqual([
      { id: "folder-1", name: "News", subscriptionCount: 2, unreadCount: 5 },
      { id: "folder-2", name: "Tech", subscriptionCount: 1, unreadCount: 5 },
    ])
  })

  it("does not alter subscriptions when the folder is not owned by the user", async () => {
    const store = createFolderStore()
    store.folder.findFirst.mockResolvedValue(null)

    await expect(
      deleteFolderWithClient({
        folderId: "folder-1",
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Folder not found.")

    expect(store.feedSubscription.updateMany).not.toHaveBeenCalled()
    expect(store.folder.delete).not.toHaveBeenCalled()
  })

  it("moves a subscription into a folder owned by the current user", async () => {
    const store = createFolderStore()
    store.feedSubscription.findFirst.mockResolvedValue({
      folderId: "folder-previous",
      id: "subscription-1",
    })
    store.folder.findFirst.mockResolvedValue({ id: "folder-1" })

    const result = await moveSubscriptionToFolderWithClient({
      folderId: "folder-1",
      store,
      subscriptionId: "subscription-1",
      userId: "user-1",
    })

    expect(store.feedSubscription.findFirst).toHaveBeenCalledWith({
      select: { folderId: true, id: true },
      where: {
        id: "subscription-1",
        userId: "user-1",
      },
    })
    expect(store.folder.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "folder-1",
        userId: "user-1",
      },
    })
    expect(store.feedSubscription.update).toHaveBeenCalledWith({
      data: {
        folderId: "folder-1",
      },
      where: { id: "subscription-1" },
    })
    expect(result).toEqual({ previousFolderId: "folder-previous" })
  })

  it("moves a subscription back to uncategorized without requiring a folder", async () => {
    const store = createFolderStore()
    store.feedSubscription.findFirst.mockResolvedValue({
      folderId: null,
      id: "subscription-1",
    })

    const result = await moveSubscriptionToFolderWithClient({
      folderId: null,
      store,
      subscriptionId: "subscription-1",
      userId: "user-1",
    })

    expect(store.folder.findFirst).not.toHaveBeenCalled()
    expect(store.feedSubscription.update).toHaveBeenCalledWith({
      data: {
        folderId: null,
      },
      where: { id: "subscription-1" },
    })
    expect(result).toEqual({ previousFolderId: null })
  })

  it("does not move subscriptions the current user does not own", async () => {
    const store = createFolderStore()
    store.feedSubscription.findFirst.mockResolvedValue(null)

    await expect(
      moveSubscriptionToFolderWithClient({
        folderId: "folder-1",
        store,
        subscriptionId: "subscription-1",
        userId: "user-1",
      })
    ).rejects.toThrow("Feed subscription not found.")

    expect(store.feedSubscription.update).not.toHaveBeenCalled()
  })
})
