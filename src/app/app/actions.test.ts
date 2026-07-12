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

  class MockArticleCollectionError extends Error {
    constructor(message: string) {
      super(message)
      this.name = "ArticleCollectionError"
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
    addArticleToCollection: vi.fn(),
    addPodcastEpisodeToCollection: vi.fn(),
    createBugReportForUser: vi.fn(),
    createFeatureSuggestionForUser: vi.fn(),
    auth: vi.fn(),
    deleteArticleForUser: vi.fn(),
    enqueueAiDigest: vi.fn(),
    generateArticleSummaryForUser: vi.fn(),
    getPrisma: vi.fn(),
    getDiscoverDirectoryFeed: vi.fn(),
    getUserFeedSubscription: vi.fn(),
    MockAiDigestError,
    MockAiSummaryError,
    MockArticleCollectionError,
    MockFeedSubscriptionError,
    MockFeedValidationError,
    redirect: vi.fn((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    }),
    removeArticleFromCollection: vi.fn(),
    removePodcastEpisodeFromCollection: vi.fn(),
    refresh: vi.fn(),
    refreshFeed: vi.fn(),
    requestEmailVerification: vi.fn(),
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

vi.mock("@/lib/article-collections", () => ({
  addArticleToCollection: mocks.addArticleToCollection,
  addPodcastEpisodeToCollection: mocks.addPodcastEpisodeToCollection,
  ArticleCollectionError: mocks.MockArticleCollectionError,
  removeArticleFromCollection: mocks.removeArticleFromCollection,
  removePodcastEpisodeFromCollection:
    mocks.removePodcastEpisodeFromCollection,
}))

vi.mock("@/lib/bug-reports", () => ({
  createBugReportForUser: mocks.createBugReportForUser,
}))

vi.mock("@/lib/feature-suggestions", () => ({
  createFeatureSuggestionForUser: mocks.createFeatureSuggestionForUser,
}))

vi.mock("@/lib/email-verification", () => ({
  requestEmailVerification: mocks.requestEmailVerification,
}))

vi.mock("@/lib/ai-dashboard", () => ({
  updateAiPreferencesForUser: mocks.updateAiPreferencesForUser,
}))

vi.mock("@/lib/articles", () => ({
  ArticleStateError: class ArticleStateError extends Error {},
  deleteArticleForUser: mocks.deleteArticleForUser,
  markArticlesRead: vi.fn(),
  setArticleReadState: mocks.setArticleReadState,
  setArticleStarredState: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  getPrisma: mocks.getPrisma,
}))

vi.mock("@/lib/discover-directory", () => ({
  getDiscoverDirectoryFeed: mocks.getDiscoverDirectoryFeed,
}))

vi.mock("@/lib/feed-discovery", () => ({
  FeedValidationError: mocks.MockFeedValidationError,
}))

vi.mock("@/lib/feed-refresh", () => ({
  FeedRefreshError: class FeedRefreshError extends Error {},
  refreshFeed: mocks.refreshFeed,
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  FeedSubscriptionError: mocks.MockFeedSubscriptionError,
  getUserFeedSubscription: mocks.getUserFeedSubscription,
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
  addArticleToCollectionAction,
  addPodcastEpisodeToCollectionAction,
  deleteArticleAction,
  generateAiDigestAction,
  generateArticleSummaryAction,
  markArticleReadOnOpen,
  removeArticleFromCollectionAction,
  removePodcastEpisodeFromCollectionAction,
  refreshFeedAction,
  subscribeDirectoryFeedAction,
  resendEmailVerificationAction,
  submitBugReportAction,
  submitFeatureSuggestionAction,
  unsubscribeFeedAction,
  updateAiPreferencesAction,
  updateDateTimePreferences,
  updateDisplayMode,
  updateThemePreference,
} from "./actions"

describe("submitBugReportAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.createBugReportForUser.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before accepting a bug report", async () => {
    mocks.auth.mockResolvedValue(null)

    const result = await submitBugReportAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "You need to sign in before reporting a bug.",
      status: "error",
    })
    expect(mocks.createBugReportForUser).not.toHaveBeenCalled()
  })

  it("stores a signed-in reader bug report for admin review", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        email: "reader@example.com",
        id: "user-1",
      },
    })
    mocks.createBugReportForUser.mockResolvedValue({
      id: "bug-1",
    })
    const formData = new FormData()
    formData.set("title", "Podcast player stops")
    formData.set(
      "description",
      "The podcast player stopped after I changed routes."
    )
    formData.set("pageUrl", "https://arcticrss.com/app/podcasts")
    formData.set("userAgent", "Brave on Windows")

    const result = await submitBugReportAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.createBugReportForUser).toHaveBeenCalledWith({
      contactEmail: "reader@example.com",
      description: "The podcast player stopped after I changed routes.",
      pageUrl: "https://arcticrss.com/app/podcasts",
      title: "Podcast player stops",
      userAgent: "Brave on Windows",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin")
    expect(result).toEqual({
      message: "Thanks, your bug report was sent.",
      status: "success",
    })
  })
})

describe("submitFeatureSuggestionAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.createFeatureSuggestionForUser.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before accepting a feature suggestion", async () => {
    mocks.auth.mockResolvedValue(null)

    const result = await submitFeatureSuggestionAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "You need to sign in before suggesting a feature.",
      status: "error",
    })
    expect(mocks.createFeatureSuggestionForUser).not.toHaveBeenCalled()
  })

  it("stores a signed-in reader feature suggestion for admin review", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        email: "reader@example.com",
        id: "user-1",
      },
    })
    mocks.createFeatureSuggestionForUser.mockResolvedValue({
      id: "feature-1",
    })
    const formData = new FormData()
    formData.set("title", "Command palette")
    formData.set(
      "description",
      "I want a keyboard shortcut palette for power readers."
    )
    formData.set("pageUrl", "https://arcticrss.com/app")
    formData.set("userAgent", "Brave on Windows")

    const result = await submitFeatureSuggestionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.createFeatureSuggestionForUser).toHaveBeenCalledWith({
      contactEmail: "reader@example.com",
      description: "I want a keyboard shortcut palette for power readers.",
      pageUrl: "https://arcticrss.com/app",
      title: "Command palette",
      userAgent: "Brave on Windows",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin")
    expect(result).toEqual({
      message: "Thanks, your feature suggestion was sent.",
      status: "success",
    })
  })
})

describe("resendEmailVerificationAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.getPrisma.mockReset()
    mocks.requestEmailVerification.mockReset()
  })

  it("requires authentication before resending verification", async () => {
    mocks.auth.mockResolvedValue(null)

    const result = await resendEmailVerificationAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(result).toEqual({
      message: "You need to sign in before resending verification.",
      status: "error",
    })
    expect(mocks.requestEmailVerification).not.toHaveBeenCalled()
  })

  it("sends a fresh verification link for an unverified signed-in reader", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const prisma = {
      user: {
        findUnique: vi.fn(async () => ({
          email: "reader@example.com",
          emailVerified: null,
        })),
      },
    }
    mocks.getPrisma.mockReturnValue(prisma)
    mocks.requestEmailVerification.mockResolvedValue({ status: "sent" })

    const result = await resendEmailVerificationAction(
      {
        message: "",
        status: "idle",
      },
      new FormData()
    )

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        email: true,
        emailVerified: true,
      },
    })
    expect(mocks.requestEmailVerification).toHaveBeenCalledWith({
      email: "reader@example.com",
      userId: "user-1",
    })
    expect(result).toEqual({
      message: "Verification email sent. Check your inbox when it arrives.",
      status: "success",
    })
  })
})

describe("addArticleToCollectionAction", () => {
  beforeEach(() => {
    mocks.addArticleToCollection.mockReset()
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before saving an article", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionId", "collection-1")

    const result = await addArticleToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "You need to sign in before saving articles.",
      status: "error",
    })
    expect(mocks.addArticleToCollection).not.toHaveBeenCalled()
  })

  it("adds the selected article to an existing collection", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addArticleToCollection.mockResolvedValue({
      collectionId: "collection-1",
    })
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionId", "collection-1")

    const result = await addArticleToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.addArticleToCollection).toHaveBeenCalledWith({
      articleId: "article-1",
      collectionId: "collection-1",
      collectionName: undefined,
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Article saved to collection.",
      status: "success",
    })
  })

  it("forwards a new collection name when creating while saving", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addArticleToCollection.mockResolvedValue({
      collectionId: "collection-new",
    })
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionName", "Deep Reads")

    await addArticleToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.addArticleToCollection).toHaveBeenCalledWith({
      articleId: "article-1",
      collectionId: undefined,
      collectionName: "Deep Reads",
      userId: "user-1",
    })
  })

  it("returns readable collection errors without refreshing", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addArticleToCollection.mockRejectedValue(
      new mocks.MockArticleCollectionError("Collection not found.")
    )
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionId", "collection-other")

    const result = await addArticleToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Collection not found.",
      status: "error",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe("removeArticleFromCollectionAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.removeArticleFromCollection.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before removing a saved article", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionId", "collection-1")

    await expect(removeArticleFromCollectionAction(formData)).rejects.toThrow(
      "Unauthorized"
    )

    expect(mocks.removeArticleFromCollection).not.toHaveBeenCalled()
  })

  it("removes the article from the selected collection and refreshes readers", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("articleId", "article-1")
    formData.set("collectionId", "collection-1")

    await removeArticleFromCollectionAction(formData)

    expect(mocks.removeArticleFromCollection).toHaveBeenCalledWith({
      articleId: "article-1",
      collectionId: "collection-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/collections/collection-1"
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.refresh).toHaveBeenCalled()
  })
})

describe("addPodcastEpisodeToCollectionAction", () => {
  beforeEach(() => {
    mocks.addPodcastEpisodeToCollection.mockReset()
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before saving a podcast episode", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("collectionId", "collection-1")

    const result = await addPodcastEpisodeToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "You need to sign in before saving podcast episodes.",
      status: "error",
    })
    expect(mocks.addPodcastEpisodeToCollection).not.toHaveBeenCalled()
  })

  it("adds the selected podcast episode to an existing collection", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addPodcastEpisodeToCollection.mockResolvedValue({
      collectionId: "collection-1",
    })
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("collectionId", "collection-1")

    const result = await addPodcastEpisodeToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.addPodcastEpisodeToCollection).toHaveBeenCalledWith({
      collectionId: "collection-1",
      collectionName: undefined,
      episodeId: "episode-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/collections")
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/collections/collection-1"
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
    expect(mocks.refresh).toHaveBeenCalled()
    expect(result).toEqual({
      message: "Episode saved to collection.",
      status: "success",
    })
  })

  it("forwards a new collection name when creating while saving a podcast episode", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addPodcastEpisodeToCollection.mockResolvedValue({
      collectionId: "collection-new",
    })
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("collectionName", "Listen later")

    await addPodcastEpisodeToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.addPodcastEpisodeToCollection).toHaveBeenCalledWith({
      collectionId: undefined,
      collectionName: "Listen later",
      episodeId: "episode-1",
      userId: "user-1",
    })
  })

  it("returns readable collection errors without refreshing", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.addPodcastEpisodeToCollection.mockRejectedValue(
      new mocks.MockArticleCollectionError("Podcast episode not found.")
    )
    const formData = new FormData()
    formData.set("episodeId", "episode-other")
    formData.set("collectionId", "collection-1")

    const result = await addPodcastEpisodeToCollectionAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(result).toEqual({
      message: "Podcast episode not found.",
      status: "error",
    })
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})

describe("removePodcastEpisodeFromCollectionAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.refresh.mockReset()
    mocks.removePodcastEpisodeFromCollection.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("requires authentication before removing a saved podcast episode", async () => {
    mocks.auth.mockResolvedValue(null)
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("collectionId", "collection-1")

    await expect(
      removePodcastEpisodeFromCollectionAction(formData)
    ).rejects.toThrow("Unauthorized")

    expect(mocks.removePodcastEpisodeFromCollection).not.toHaveBeenCalled()
  })

  it("removes the podcast episode from the selected collection and refreshes podcasts", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("episodeId", "episode-1")
    formData.set("collectionId", "collection-1")

    await removePodcastEpisodeFromCollectionAction(formData)

    expect(mocks.removePodcastEpisodeFromCollection).toHaveBeenCalledWith({
      collectionId: "collection-1",
      episodeId: "episode-1",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/app/collections/collection-1"
    )
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/podcasts")
    expect(mocks.refresh).toHaveBeenCalled()
  })
})

describe("refreshFeedAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.getUserFeedSubscription.mockReset()
    mocks.refresh.mockReset()
    mocks.refreshFeed.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("blocks manual feed refreshes when the feed refreshed recently", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-29T12:00:00.000Z"))

    try {
      mocks.auth.mockResolvedValue({
        user: {
          id: "user-1",
        },
      })
      mocks.getUserFeedSubscription.mockResolvedValue({
        feed: {
          lastFetchedAt: new Date("2026-06-29T11:58:00.000Z"),
        },
        feedId: "feed-1",
        id: "subscription-1",
      })
      const formData = new FormData()
      formData.set("subscriptionId", "subscription-1")

      const result = await refreshFeedAction(
        {
          message: "",
          status: "idle",
        },
        formData
      )

      expect(result).toEqual({
        message: "This feed was refreshed recently. Try again in 3 minutes.",
        status: "error",
      })
      expect(mocks.refreshFeed).not.toHaveBeenCalled()
      expect(mocks.revalidatePath).not.toHaveBeenCalled()
      expect(mocks.refresh).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it("allows manual feed refreshes after the cooldown has elapsed", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-29T12:00:00.000Z"))

    try {
      mocks.auth.mockResolvedValue({
        user: {
          id: "user-1",
        },
      })
      mocks.getUserFeedSubscription.mockResolvedValue({
        feed: {
          lastFetchedAt: new Date("2026-06-29T11:54:59.000Z"),
        },
        feedId: "feed-1",
        id: "subscription-1",
      })
      mocks.refreshFeed.mockResolvedValue({
        articleCount: 8,
        feedId: "feed-1",
      })
      const formData = new FormData()
      formData.set("subscriptionId", "subscription-1")

      const result = await refreshFeedAction(
        {
          message: "",
          status: "idle",
        },
        formData
      )

      expect(mocks.refreshFeed).toHaveBeenCalledWith("feed-1")
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
      expect(mocks.revalidatePath).toHaveBeenCalledWith(
        "/app/feed/subscription-1"
      )
      expect(mocks.refresh).toHaveBeenCalled()
      expect(result).toEqual({
        message: "Fetched 8 articles.",
        status: "success",
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

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
    mocks.getDiscoverDirectoryFeed.mockReset()
    mocks.getDiscoverDirectoryFeed.mockImplementation(async (feedId: string) => {
      if (feedId === "npr-national") {
        return {
          categoryId: "us-general",
          id: "npr-national",
          label: "NPR - National",
          source: "npr.org",
          url: "https://feeds.npr.org/1003/rss.xml",
        }
      }

      if (feedId === "npr-world") {
        return {
          categoryId: "us-general",
          id: "npr-world",
          label: "NPR - World",
          source: "npr.org",
          url: "https://feeds.npr.org/1004/rss.xml",
        }
      }

      return undefined
    })
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

  it("does not refetch a directory feed when subscription already imported articles", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
      initialArticleCount: 18,
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

    expect(mocks.refreshFeed).not.toHaveBeenCalled()
    expect(result).toEqual({
      message: "Subscribed to NPR - National. Imported 18 articles.",
      status: "success",
    })
  })

  it("returns analytics metadata when a directory feed is the reader's first source", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-1",
      initialArticleCount: 18,
      sourceCountBeforeSubscribe: 0,
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

    expect(result).toEqual({
      analytics: {
        firstSourceSubscribed: true,
        sourceType: "feed",
      },
      message: "Subscribed to NPR - National. Imported 18 articles.",
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

  it("forwards a new folder name when subscribing to a directory feed", async () => {
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
    formData.set("folderName", "Tech Watch")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: undefined,
      folderName: "Tech Watch",
      url: "https://feeds.npr.org/1004/rss.xml",
      userId: "user-1",
    })
    expect(result).toEqual({
      message: "Subscribed to NPR - World. Imported 4 articles.",
      status: "success",
    })
  })

  it("subscribes to an imported Discover feed", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getDiscoverDirectoryFeed.mockResolvedValueOnce({
      categoryId: "opml-podcasts",
      id: "opml-podcasts-daily-audio",
      label: "Daily Audio",
      source: "podcasts.example",
      url: "https://podcasts.example/feed.xml",
    })
    mocks.subscribeToFeed.mockResolvedValue({
      feedId: "feed-imported",
    })
    mocks.refreshFeed.mockResolvedValue({
      articleCount: 6,
    })
    const formData = new FormData()
    formData.set("directoryFeedId", "opml-podcasts-daily-audio")

    const result = await subscribeDirectoryFeedAction(
      {
        message: "",
        status: "idle",
      },
      formData
    )

    expect(mocks.getDiscoverDirectoryFeed).toHaveBeenCalledWith(
      "opml-podcasts-daily-audio"
    )
    expect(mocks.subscribeToFeed).toHaveBeenCalledWith({
      folderId: undefined,
      url: "https://podcasts.example/feed.xml",
      userId: "user-1",
    })
    expect(result).toEqual({
      message: "Subscribed to Daily Audio. Imported 6 articles.",
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

describe("updateThemePreference", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.getPrisma.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("persists a named theme preference for the signed-in reader", async () => {
    const upsert = vi.fn().mockResolvedValue({})
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getPrisma.mockReturnValue({
      userSettings: {
        upsert,
      },
    })

    await updateThemePreference("ORANGE")

    expect(upsert).toHaveBeenCalledWith({
      create: {
        theme: "ORANGE",
        userId: "user-1",
      },
      update: {
        theme: "ORANGE",
      },
      where: {
        userId: "user-1",
      },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("rejects unsupported theme preferences", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })

    await expect(
      updateThemePreference("SOLARIZED" as never)
    ).rejects.toThrow("Unsupported theme preference")
    expect(mocks.getPrisma).not.toHaveBeenCalled()
  })
})

describe("updateDisplayMode", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.getPrisma.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("persists a minimal display mode preference for the signed-in reader", async () => {
    const upsert = vi.fn().mockResolvedValue({})
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getPrisma.mockReturnValue({
      userSettings: {
        upsert,
      },
    })

    await updateDisplayMode("MINIMAL")

    expect(upsert).toHaveBeenCalledWith({
      create: {
        displayMode: "MINIMAL",
        userId: "user-1",
      },
      update: {
        displayMode: "MINIMAL",
      },
      where: {
        userId: "user-1",
      },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app", "layout")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("rejects unsupported display modes", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })

    await expect(updateDisplayMode("MAGAZINE" as never)).rejects.toThrow(
      "Unsupported display mode"
    )
    expect(mocks.getPrisma).not.toHaveBeenCalled()
  })
})

describe("updateDateTimePreferences", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.getPrisma.mockReset()
    mocks.revalidatePath.mockReset()
    mocks.refresh.mockReset()
  })

  it("persists supported date, time, and time zone preferences for the signed-in user", async () => {
    const upsert = vi.fn().mockResolvedValue({})
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getPrisma.mockReturnValue({
      userSettings: {
        upsert,
      },
    })

    await updateDateTimePreferences({
      dateFormat: "YYYY_MM_DD",
      timeFormat: "HOUR_24",
      timeZone: "America/New_York",
    })

    expect(upsert).toHaveBeenCalledWith({
      create: {
        dateFormat: "YYYY_MM_DD",
        timeFormat: "HOUR_24",
        timeZone: "America/New_York",
        userId: "user-1",
      },
      update: {
        dateFormat: "YYYY_MM_DD",
        timeFormat: "HOUR_24",
        timeZone: "America/New_York",
      },
      where: {
        userId: "user-1",
      },
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/settings")
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("rejects unsupported date and time preferences", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })

    await expect(
      updateDateTimePreferences({
        dateFormat: "BAD" as never,
        timeFormat: "HOUR_24",
        timeZone: "UTC",
      })
    ).rejects.toThrow("Unsupported date and time preference")
    expect(mocks.getPrisma).not.toHaveBeenCalled()
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

describe("deleteArticleAction", () => {
  beforeEach(() => {
    mocks.auth.mockReset()
    mocks.deleteArticleForUser.mockReset()
    mocks.refresh.mockReset()
    mocks.revalidatePath.mockReset()
  })

  it("deletes the selected article from the current user's reader and refreshes lists", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    const formData = new FormData()
    formData.set("articleId", "article-2")

    await deleteArticleAction(formData)

    expect(mocks.deleteArticleForUser).toHaveBeenCalledWith({
      articleId: "article-2",
      userId: "user-1",
    })
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/unread")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/app/starred")
    expect(mocks.refresh).toHaveBeenCalled()
  })
})
