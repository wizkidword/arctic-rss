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

  return {
    auth: vi.fn(),
    enqueueAiDigest: vi.fn(),
    generateArticleSummaryForUser: vi.fn(),
    MockAiDigestError,
    MockAiSummaryError,
    refresh: vi.fn(),
    requestAiDigestForUser: vi.fn(),
    revalidatePath: vi.fn(),
    updateAiPreferencesForUser: vi.fn(),
  }
})

vi.mock("next/cache", () => ({
  refresh: mocks.refresh,
  revalidatePath: mocks.revalidatePath,
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
  setArticleReadState: vi.fn(),
  setArticleStarredState: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  getPrisma: vi.fn(),
}))

vi.mock("@/lib/feed-discovery", () => ({
  FeedValidationError: class FeedValidationError extends Error {},
}))

vi.mock("@/lib/feed-refresh", () => ({
  FeedRefreshError: class FeedRefreshError extends Error {},
  refreshFeed: vi.fn(),
}))

vi.mock("@/lib/feed-subscriptions", () => ({
  FeedSubscriptionError: class FeedSubscriptionError extends Error {},
  getUserFeedSubscription: vi.fn(),
  subscribeToFeed: vi.fn(),
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
  updateAiPreferencesAction,
} from "./actions"

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
