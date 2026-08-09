import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPrisma: vi.fn(),
}))

vi.mock("./db", () => ({ getPrisma: mocks.getPrisma }))

import {
  AccountExportError,
  ACCOUNT_EXPORT_LIMITS,
  buildAccountExport,
  MAX_ACCOUNT_EXPORT_BYTES,
  serializeAccountExport,
} from "./account-export"

function createStore() {
  return {
    articleCollection: { findMany: vi.fn().mockResolvedValue([]) },
    articleCollectionItem: { findMany: vi.fn().mockResolvedValue([]) },
    articleState: { findMany: vi.fn().mockResolvedValue([]) },
    feedSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    folder: { findMany: vi.fn().mockResolvedValue([]) },
    podcastSubscription: { findMany: vi.fn().mockResolvedValue([]) },
    savedSearch: { findMany: vi.fn().mockResolvedValue([]) },
    smartDigestRule: { findMany: vi.fn().mockResolvedValue([]) },
    userSettings: { findUnique: vi.fn().mockResolvedValue(null) },
  }
}

describe("account export", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports only the account's bounded configuration and lightweight references", async () => {
    const store = createStore()
    store.feedSubscription.findMany.mockResolvedValue([
      {
        customTitle: "Arctic updates",
        feed: {
          feedUrl: "https://publisher.example/feed.xml",
          siteUrl: "https://publisher.example",
          title: "Publisher",
        },
        folderId: "folder-1",
        id: "subscription-1",
        isMuted: false,
        isPaused: true,
        sortOrder: 2,
        subscribedAt: new Date("2026-08-01T00:00:00.000Z"),
      },
    ])
    store.podcastSubscription.findMany.mockResolvedValue([
      {
        customTitle: null,
        id: "podcast-subscription-1",
        isMuted: true,
        isPaused: false,
        podcast: {
          feedUrl: "https://podcast.example/feed.xml",
          siteUrl: null,
          title: "Podcast",
        },
        sortOrder: 0,
        subscribedAt: new Date("2026-08-02T00:00:00.000Z"),
      },
    ])
    store.folder.findMany.mockResolvedValue([
      { id: "folder-1", name: "Climate", sortOrder: 1 },
    ])
    store.articleCollection.findMany.mockResolvedValue([
      { id: "collection-1", name: "Reading list", sortOrder: 0 },
    ])
    store.articleCollectionItem.findMany.mockResolvedValue([
      {
        articleId: "article-1",
        collectionId: "collection-1",
        createdAt: new Date("2026-08-03T00:00:00.000Z"),
        podcastEpisodeId: null,
      },
      {
        articleId: null,
        collectionId: "collection-1",
        createdAt: new Date("2026-08-04T00:00:00.000Z"),
        podcastEpisodeId: "episode-1",
      },
    ])
    store.articleState.findMany.mockResolvedValue([
      {
        article: {
          canonicalUrl: "https://publisher.example/article-canonical",
          feed: { feedUrl: "https://publisher.example/feed.xml" },
          id: "article-1",
          publishedAt: new Date("2026-08-05T00:00:00.000Z"),
          title: "Small reference title",
          url: "https://publisher.example/article",
        },
        starredAt: new Date("2026-08-06T00:00:00.000Z"),
      },
    ])
    store.savedSearch.findMany.mockResolvedValue([
      {
        collectionId: "collection-1",
        definitionVersion: 1,
        description: "Useful searches",
        folderId: "folder-1",
        id: "search-1",
        monitorAction: "star",
        monitorEnabled: true,
        name: "Arctic news",
        publishedAfter: new Date("2026-08-01T00:00:00.000Z"),
        publishedBefore: null,
        query: "arctic",
        state: "unread",
        subscriptionId: "subscription-1",
      },
    ])
    store.smartDigestRule.findMany.mockResolvedValue([
      {
        cadence: "DAILY",
        emailEnabled: false,
        excludeTerms: ["opinion"],
        folders: [{ folderId: "folder-2" }, { folderId: "folder-1" }],
        id: "rule-1",
        includeTerms: ["ice"],
        isEnabled: true,
        matchingMode: "RULES",
        name: "Daily Arctic",
        scheduledHour: 8,
        sourceScope: "FOLDERS",
        subscriptions: [
          { subscriptionId: "subscription-2" },
          { subscriptionId: "subscription-1" },
        ],
        timeZone: "UTC",
        topicPrompt: "What changed?",
      },
    ])
    store.userSettings.findUnique.mockResolvedValue({
      aiAutoSummariesEnabled: false,
      dailyDigestEnabled: true,
      dateFormat: "DEFAULT",
      defaultView: "CLASSIC",
      displayMode: "THREE_PANE",
      fontSize: "MEDIUM",
      markReadOnOpen: true,
      openLinksInNewTab: true,
      theme: "SYSTEM",
      timeFormat: "DEFAULT",
      timeZone: "UTC",
    })
    mocks.getPrisma.mockReturnValue(store)

    const accountExport = await buildAccountExport({
      exportedAt: new Date("2026-08-09T12:00:00.000Z"),
      userId: "user-1",
    })

    expect(accountExport).toMatchObject({
      collections: [
        {
          id: "collection-1",
          itemReferences: [
            {
              articleId: "article-1",
              podcastEpisodeId: null,
              savedAt: "2026-08-03T00:00:00.000Z",
            },
            {
              articleId: null,
              podcastEpisodeId: "episode-1",
              savedAt: "2026-08-04T00:00:00.000Z",
            },
          ],
        },
      ],
      exportedAt: "2026-08-09T12:00:00.000Z",
      format: "arctic-rss-account-export",
      savedSearches: [
        {
          monitor: { action: "star", enabled: true },
          publishedAfter: "2026-08-01T00:00:00.000Z",
        },
      ],
      schemaVersion: 1,
      smartDigestRules: [
        {
          folderIds: ["folder-1", "folder-2"],
          subscriptionIds: ["subscription-1", "subscription-2"],
        },
      ],
      starredArticleReferences: [
        {
          articleId: "article-1",
          feedUrl: "https://publisher.example/feed.xml",
          title: "Small reference title",
        },
      ],
      subscriptions: {
        feeds: [
          {
            feedUrl: "https://publisher.example/feed.xml",
            id: "subscription-1",
          },
        ],
        podcasts: [
          {
            feedUrl: "https://podcast.example/feed.xml",
            id: "podcast-subscription-1",
          },
        ],
      },
    })
    expect(JSON.stringify(accountExport)).not.toContain("contentHtml")
    expect(JSON.stringify(accountExport)).not.toContain("contentText")
    expect(store.articleCollectionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { collection: { userId: "user-1" } } })
    )
    expect(store.articleState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isStarred: true, userId: "user-1" } })
    )
    expect(store.feedSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: ACCOUNT_EXPORT_LIMITS.feedSubscriptions + 1,
        where: { userId: "user-1" },
      })
    )
    expect(store.articleState.findMany.mock.calls[0][0].select.article.select).not.toHaveProperty(
      "contentHtml"
    )
  })

  it("refuses a partial export when a bounded section exceeds its limit", async () => {
    const store = createStore()
    store.articleCollectionItem.findMany.mockResolvedValue(
      Array.from({ length: ACCOUNT_EXPORT_LIMITS.collectionItems + 1 }, (_, index) => ({
        articleId: `article-${index}`,
        collectionId: "collection-1",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        podcastEpisodeId: null,
      }))
    )
    mocks.getPrisma.mockReturnValue(store)

    await expect(buildAccountExport({ userId: "user-1" })).rejects.toEqual(
      expect.objectContaining({
        message: expect.stringContaining("collection item references"),
        name: "AccountExportError",
      })
    )
  })

  it("refuses an oversized serialized download", () => {
    expect(() =>
      serializeAccountExport({ padding: "x".repeat(MAX_ACCOUNT_EXPORT_BYTES) } as never)
    ).toThrow(AccountExportError)
  })
})
