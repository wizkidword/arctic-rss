import { describe, expect, it, vi } from "vitest"

import {
  AiSummaryError,
  createLocalSummaryProvider,
  generateArticleSummaryWithClient,
  type AiSummaryProvider,
  type AiSummaryStore,
} from "./ai-summaries"

function createSummaryStore({
  article = {
    contentHtml: "<p>The new Arctic RSS release restores fast feed reading.</p>",
    contentText: null,
    id: "article-1",
    summary: "A release note about Arctic RSS.",
    title: "Arctic RSS ships summaries",
    url: "https://example.com/arctic",
  },
  existingSummary = null,
  user = {
    aiMonthlyLimit: 10,
    aiMonthlyUsed: 2,
  },
}: {
  article?: Awaited<
    ReturnType<AiSummaryStore["article"]["findFirst"]>
  >
  existingSummary?: Awaited<
    ReturnType<AiSummaryStore["articleAiSummary"]["findUnique"]>
  >
  user?: Awaited<ReturnType<AiSummaryStore["user"]["findUnique"]>>
} = {}): AiSummaryStore {
  return {
    aiUsageLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    article: {
      findFirst: vi.fn().mockResolvedValue(article),
    },
    articleAiSummary: {
      findUnique: vi.fn().mockResolvedValue(existingSummary),
      upsert: vi.fn().mockResolvedValue({
        id: "summary-1",
      }),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

function createProvider(
  summary: Awaited<ReturnType<AiSummaryProvider["summarize"]>> = {
    bulletSummary: ["Fast feed reading is available again."],
    category: "Product",
    inputTokens: 120,
    keyTakeaway: "Arctic RSS is moving toward Google Reader-style speed.",
    outputTokens: 80,
    readingTimeSeconds: 35,
    sentiment: "positive",
    shortSummary: "Arctic RSS now has the shape of fast feed reading.",
  }
): AiSummaryProvider {
  return {
    model: "test-model",
    name: "test-provider",
    summarize: vi.fn().mockResolvedValue(summary),
  }
}

describe("AI article summaries", () => {
  it("keeps local summaries free of internal article formatter labels", async () => {
    const provider = createLocalSummaryProvider()

    const result = await provider.summarize({
      content: [
        "Title: Arctic RSS ships summaries",
        "Summary: Arctic RSS can summarize stored articles.",
        "Body: The reader shows cached summaries inside the article view.",
        "URL: https://example.com/arctic",
      ].join("\n\n"),
      title: "Arctic RSS ships summaries",
      url: "https://example.com/arctic",
    })

    expect(result.shortSummary).toBe(
      "Arctic RSS can summarize stored articles. The reader shows cached summaries inside the article view."
    )
    expect(result.shortSummary).not.toContain("Summary:")
    expect(result.shortSummary).not.toContain("Body:")
  })

  it("returns a cached summary without charging usage", async () => {
    const store = createSummaryStore({
      existingSummary: {
        bulletSummary: ["Cached point"],
        category: "Technology",
        id: "summary-1",
        keyTakeaway: "Cached takeaway",
        model: "test-model",
        provider: "test-provider",
        readingTimeSeconds: 20,
        sentiment: "neutral",
        shortSummary: "Cached summary",
        tokenCount: 42,
      },
    })
    const provider = createProvider()

    const result = await generateArticleSummaryWithClient({
      articleId: "article-1",
      provider,
      store,
      userId: "user-1",
    })

    expect(result).toEqual({
      bulletSummary: ["Cached point"],
      category: "Technology",
      fromCache: true,
      id: "summary-1",
      keyTakeaway: "Cached takeaway",
      model: "test-model",
      provider: "test-provider",
      readingTimeSeconds: 20,
      sentiment: "neutral",
      shortSummary: "Cached summary",
      tokenCount: 42,
    })
    expect(provider.summarize).not.toHaveBeenCalled()
    expect(store.user.update).not.toHaveBeenCalled()
    expect(store.aiUsageLog.create).not.toHaveBeenCalled()
  })

  it("generates, stores, logs, and charges one summary for an accessible article", async () => {
    const store = createSummaryStore()
    const provider = createProvider()
    provider.model = "gpt-5.4-nano"
    provider.name = "openai"

    const result = await generateArticleSummaryWithClient({
      articleId: "article-1",
      provider,
      store,
      userId: "user-1",
    })

    expect(provider.summarize).toHaveBeenCalledWith({
      content: [
        "Title: Arctic RSS ships summaries",
        "Summary: A release note about Arctic RSS.",
        "Body: The new Arctic RSS release restores fast feed reading.",
        "URL: https://example.com/arctic",
      ].join("\n\n"),
      title: "Arctic RSS ships summaries",
      url: "https://example.com/arctic",
    })
    expect(store.articleAiSummary.upsert).toHaveBeenCalledWith({
      create: {
        articleId: "article-1",
        bulletSummary: ["Fast feed reading is available again."],
        category: "Product",
        keyTakeaway: "Arctic RSS is moving toward Google Reader-style speed.",
        model: "gpt-5.4-nano",
        provider: "openai",
        readingTimeSeconds: 35,
        sentiment: "positive",
        shortSummary: "Arctic RSS now has the shape of fast feed reading.",
        tokenCount: 200,
      },
      update: {
        bulletSummary: ["Fast feed reading is available again."],
        category: "Product",
        keyTakeaway: "Arctic RSS is moving toward Google Reader-style speed.",
        readingTimeSeconds: 35,
        sentiment: "positive",
        shortSummary: "Arctic RSS now has the shape of fast feed reading.",
        tokenCount: 200,
      },
      where: {
        articleId_provider_model: {
          articleId: "article-1",
          model: "gpt-5.4-nano",
          provider: "openai",
        },
      },
    })
    expect(store.aiUsageLog.create).toHaveBeenCalledWith({
      data: {
        action: "ARTICLE_SUMMARY",
        costEstimate: 0.000124,
        inputTokens: 120,
        model: "gpt-5.4-nano",
        outputTokens: 80,
        provider: "openai",
        userId: "user-1",
      },
    })
    expect(store.user.update).toHaveBeenCalledWith({
      data: {
        aiMonthlyUsed: {
          increment: 1,
        },
      },
      where: {
        id: "user-1",
      },
    })
    expect(result).toMatchObject({
      fromCache: false,
      model: "gpt-5.4-nano",
      provider: "openai",
      shortSummary: "Arctic RSS now has the shape of fast feed reading.",
      tokenCount: 200,
    })
  })

  it("refuses to summarize before calling the provider when the monthly limit is exhausted", async () => {
    const store = createSummaryStore({
      user: {
        aiMonthlyLimit: 3,
        aiMonthlyUsed: 3,
      },
    })
    const provider = createProvider()

    await expect(
      generateArticleSummaryWithClient({
        articleId: "article-1",
        provider,
        store,
        userId: "user-1",
      })
    ).rejects.toThrow(AiSummaryError)

    expect(provider.summarize).not.toHaveBeenCalled()
    expect(store.articleAiSummary.upsert).not.toHaveBeenCalled()
    expect(store.aiUsageLog.create).not.toHaveBeenCalled()
    expect(store.user.update).not.toHaveBeenCalled()
  })
})
