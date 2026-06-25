import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  class MockAiSummaryError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AiSummaryError"
    }
  }

  class MockAiDigestError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "AiDigestError"
    }
  }

  class MockFeedSubscriptionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "FeedSubscriptionError"
    }
  }

  class MockFeedValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "FeedValidationError"
    }
  }

  return {
    auth: vi.fn(),
    enqueueAiDigest: vi.fn(),
    generateArticleSummaryForUser: vi.fn(),
    MockAiDigestError,
    MockAiSummaryError,
    MockFeedSubscriptionError,
    MockFeedValidationError,
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    }),
    refresh: vi.fn(),
    refreshFeed: vi.fn(),
    requestAiDigestForUser: vi.fn(),
    revalidatePath: vi.fn(),
    setArticleReadState: vi.fn(),
    subscribeToFeed: vi.fn(),
    unsubscribeFromFeed: vi.fn(),
    updateAiPreferencesForUser: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/lib/ai-summaries", () => ({
  AiSummaryError: mocks.MockAiSummaryError,
  generateArticleSummaryForUser: mocks.generateArticleSummaryForUser,
}))

vi.mock("@/lib/ai-digest-queue", () => ({
  enqueueAiDigest: mocks.enqueueAiDigest,
}))

vi.mock("@/lib/ai-digests", () => ({
  AiDigestError: mocks.MockAiDigestError,
  requestAiDigestForUser: mocks.requestAiDigestForUser,
}))

vi.mock("@/lib/ai-dashboard", () => ({
  updateAiPreferencesForUser: mocks.updateAiPreferencesForUser,
}))

vi.mock("@/lib/articles", () => ({
  ArticleStateError: class ArticleStateError extends Error {},
  markArticlesRead: vi.fn(),
  setArticleReadState: mocks.setArticleReadState,
  setArticleStarredState: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(),
}))

vi.mock("@/lib/feed-directory", async () => import("../../lib/feed-directory"))

vi.mock("@/lib/feed-discovery", () => ({
  FeedValidationError: mocks.MockFeedValidationError,
}))

vi.mock("@/lib/feed-refresh", () => ({
  FeedRefreshError: class FeedRefreshError extends Error {},
  refreshFeed: mocks.refreshFeed,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  FeedSubscriptionError: mocks.MockFeedSubscriptionError,
  getUserFeedSubscription: vi.fn(),
  subscribeToFeed: mocks.subscribeToFeed,
  unsubscribeFromFeed: mocks.unsubscribeFromFeed,
}))

vi.mock("@/lib/folders", () => ({
  createFolder: vi.fn(),
  deleteFolder: vi.fn(),
  FolderError: class FolderError extends Error {},
  moveSubscriptionToFolder: vi.fn(),
  renameFolder: vi.fn(),
}))

vi.mock("@/lib/opml", () => ({
  importOpmlForUser: vi.fn(),
  OpmlError: class OpmlError extends Error {},
}))

vi.mock("@/lib/preferences", () => ({
  isDefaultView: vi.fn(),
}))

vi.mock("@/lib/url-safety", () => ({
  FeedFetchError: class FeedFetchError extends Error {},
  UnsafeUrlError: class UnsafeUrlError extends Error {},
}))

import {
  generateAiDigestAction,
  generateArticleSummaryAction,
  markArticleReadOnOpen,
  subscribeDirectoryFeedAction,
  unsubscribeFeedAction,
  updateAiPreferencesAction,
} from "./actions"

describe("subscribeDirectoryFeedAction", () => {
  function expectNoPostCommitOperations() {
    expect(mocks.refreshFeed).not.toHaveBeenCalled()
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.refreshFeed.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.subscribeToFeed.mockReset()
  })

  it("requires authentication before subscribing", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "You need to sign in before subscribing.",
      status: "error",
    })
    expect(mocks.subscribeToFeed).not.toHaveBeenCalled()
    expectNoPostCommitOperations()
  })

  it("rejects an unknown or tampered directory feed ID", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "https://attacker.example/feed.xml")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "That directory feed is not available.",
      status: "error",
    })
    expect(mocks.subscribeToFeed).not.toHaveBeenCalled()
    expectNoPostCommitOperations()
  })

  it("subscribes to NPR National without a folder and refreshes the app", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockResolvedValue({
      articleCount: 12,
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: undefined,
      url: "https://feeds.npr.org/1003/rss.xml",
      userId: "user-1",
    })
    expect(mocks.refreshFeed).toHaveBeenCalledWith("feed-1")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Subscribed to NPR - National. Imported 12 articles.",
      status: "success",
    })
  })

  it("forwards the selected folder when subscribing to NPR World", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-2",
    })
    mocks.refreshFeed.mockResolvedValue({
      articleCount: 4,
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-world")
    formData.set("folderId", "folder-1")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: "folder-1",
      url: "https://feeds.npr.org/1004/rss.xml",
      userId: "user-1",
    })
    expect(result).toEqual({
      message: "Subscribed to NPR - World. Imported 4 articles.",
      status: "success",
    })
  })

  it("returns a readable folder ownership error without refreshing the client", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError("That folder does not exist.")
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")
    formData.set("folderId", "folder-1")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "That folder does not exist.",
      status: "error",
    })
    expectNoPostCommitOperations()
  })

  it("returns a readable duplicate subscription error without refreshing the client", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError(
        "You are already subscribed to NPR Topics: National."
      )
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "You are already subscribed to NPR Topics: National.",
      status: "error",
    })
    expectNoPostCommitOperations()
  })

  it("returns a readable feed validation error without refreshing the client", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockRejectedValue(
      new mocks.MockFeedValidationError(
        "That address did not expose a readable RSS or Atom feed."
      )
    )
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "That address did not expose a readable RSS or Atom feed.",
      status: "error",
    })
    expectNoPostCommitOperations()
  })

  it("returns a generic error when the subscription service fails unexpectedly", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockRejectedValue(new Error("Database unavailable"))
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Arctic RSS could not subscribe to that directory feed.",
      status: "error",
    })
    expectNoPostCommitOperations()
  })

  it("preserves the subscription when the immediate article refresh fails", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockRejectedValue(new Error("Feed unavailable"))
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.subscribeToFeed).toHaveBeenCalledTimes(1)
    expect(mocks.refreshFeed).toHaveBeenCalledWith("feed-1")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Subscribed to NPR - National. Article refresh will retry.",
      status: "success",
    })
  })

  it("returns success and attempts refresh when app revalidation fails", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockResolvedValue({
      articleCount: 12,
    })
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("Cache unavailable")
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Subscribed to NPR - National. Imported 12 articles.",
      status: "success",
    })
  })

  it("returns success when the client refresh fails", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
    })
    mocks.refreshFeed.mockResolvedValue({
      articleCount: 12,
    })
    mocks.refresh.mockImplementation(() => {
      throw new Error("Client refresh unavailable")
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "npr-national")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Subscribed to NPR - National. Imported 12 articles.",
      status: "success",
    })
  })
})

describe("generateArticleSummaryAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.generateArticleSummaryForUser.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("generates a summary for the signed-in user's selected article", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.generateArticleSummaryForUser.mockResolvedValue({
      fromCache: false,
      shortSummary: "A concise summary.",
    })
    const formData = new FormData()
    formData.set("articleId", "article-1")

    const result = await generateArticleSummaryAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.generateArticleSummaryForUser).toHaveBeenCalledWith({
      articleId: "article-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/ai")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Summary generated.",
      status: "success",
    })
  })

  it("returns a readable error when the summary service rejects the request", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.generateArticleSummaryForUser.mockRejectedValue(
      new mocks.MockAiSummaryError("AI summary monthly limit reached.")
    )
    const formData = new FormData()
    formData.set("articleId", "article-1")

    const result = await generateArticleSummaryAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "AI summary monthly limit reached.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe("generateAiDigestAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.enqueueAiDigest.mockReset()
    mocks.refresh.mockReset()
    mocks.requestAiDigestForUser.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("creates and enqueues a digest for the signed-in user", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.requestAiDigestForUser.mockResolvedValue({
      digestId: "digest-1",
      existing: false,
      status: "PENDING",
    })

    const result = await generateAiDigestAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(mocks.requestAiDigestForUser).toHaveBeenCalledWith({
      userId: "user-1",
    })
    expect(mocks.enqueueAiDigest).toHaveBeenCalledWith("digest-1")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/ai")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      digestId: "digest-1",
      message: "Digest generation started.",
      status: "success",
    })
  })

  it("reuses an active digest without enqueueing duplicate work", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.requestAiDigestForUser.mockResolvedValue({
      digestId: "digest-active",
      existing: true,
      status: "PROCESSING",
    })

    const result = await generateAiDigestAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(mocks.enqueueAiDigest).not.toHaveBeenCalled()
    expect(result).toEqual({
      digestId: "digest-active",
      message: "Digest generation is already in progress.",
      status: "success",
    })
  })

  it("returns readable digest service errors", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.requestAiDigestForUser.mockRejectedValue(
      new mocks.MockAiDigestError("No unread articles are available for a digest.")
    )

    const result = await generateAiDigestAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "No unread articles are available for a digest.",
      status: "error",
    })
    expect(mocks.enqueueAiDigest).not.toHaveBeenCalled()
  })
})

describe("updateAiPreferencesAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.updateAiPreferencesForUser.mockReset()
  })

  it("persists checkbox preferences for the signed-in user", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("aiAutoSummariesEnabled", "on")
    formData.set("dailyDigestEnabled", "on")

    const result = await updateAiPreferencesAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.updateAiPreferencesForUser).toHaveBeenCalledWith({
      aiAutoSummariesEnabled: true,
      dailyDigestEnabled: true,
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/ai")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "AI preferences saved.",
      status: "success",
    })
  })
})

describe("unsubscribeFeedAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.redirect.mockClear()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.unsubscribeFromFeed.mockReset()
  })

  it("requires authentication before unsubscribing", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    const result = await unsubscribeFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "You need to sign in before unsubscribing.",
      status: "error",
    })
    expect(mocks.unsubscribeFromFeed).not.toHaveBeenCalled()
  })

  it("requires a subscription to unsubscribe from", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })

    const result = await unsubscribeFeedAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "Choose a feed to unsubscribe from.",
      status: "error",
    })
    expect(mocks.unsubscribeFromFeed).not.toHaveBeenCalled()
  })

  it("unsubscribes the selected feed and redirects before the deleted route rerenders", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.unsubscribeFromFeed.mockResolvedValue({
      id: "service-returned-id",
      title: "Example Feed",
    })
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    await expect(
      unsubscribeFeedAction(
        {
          message: "",
          status: "idle",
        },
        formData
      )
    ).rejects.toThrow("REDIRECT:/app")

    expect(mocks.unsubscribeFromFeed).toHaveBeenCalledWith({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/folders")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/settings/import-export"
    )
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      "/app/feed/subscription-1"
    )
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.redirect).toHaveBeenCalledWith("/app")
  })

  it("returns success when cache invalidation fails after unsubscribing", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.unsubscribeFromFeed.mockResolvedValue({
      id: "service-returned-id",
      title: "Example Feed",
    })
    mocks.revalidatePath.mockImplementation(() => {
      throw new Error("Cache unavailable")
    })
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    await expect(
      unsubscribeFeedAction(
        {
          message: "",
          status: "idle",
        },
        formData
      )
    ).rejects.toThrow("REDIRECT:/app")

    expect(mocks.unsubscribeFromFeed).toHaveBeenCalledTimes(1)
    expect(mocks.unsubscribeFromFeed).toHaveBeenCalledWith({
      subscriptionId: "subscription-1",
      userId: "user-1",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/app")
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("returns feed subscription errors safely", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.unsubscribeFromFeed.mockRejectedValue(
      new mocks.MockFeedSubscriptionError(
        "That feed subscription was not found."
      )
    )
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    const result = await unsubscribeFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "That feed subscription was not found.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("returns a generic error when unsubscribing fails unexpectedly", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.unsubscribeFromFeed.mockRejectedValue(new Error("Database offline"))
    const formData = new FormData()
    formData.set("subscriptionId", "subscription-1")

    const result = await unsubscribeFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Arctic RSS could not unsubscribe from that feed.",
      status: "error",
    })
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe("markArticleReadOnOpen", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.setArticleReadState.mockReset()
  })

  it("persists the read state without refreshing the current unread view", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })

    await markArticleReadOnOpen("article-2")

    expect(mocks.setArticleReadState).toHaveBeenCalledWith({
      articleId: "article-2",
      isRead: true,
      userId: "user-1",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
