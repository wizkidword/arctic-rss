import { describe, expect, it, vi } from "vitest"

import {
  addArticleToCollectionWithClient,
  addPodcastEpisodeToCollectionWithClient,
  listArticleCollectionsForUserWithClient,
  removeArticleFromCollectionWithClient,
  removePodcastEpisodeFromCollectionWithClient,
} from "./article-collections"

function createCollectionStore({
  article = { id: "article-1" },
  collection = { id: "collection-1" },
  collections = [
    { _count: { items: 2 }, id: "collection-1", name: "Research" },
  ],
  podcastEpisode = { id: "episode-1" },
}: {
  article?: { id: string } | null
  collection?: { id: string } | null
  collections?: Array<{ _count: { items: number }; id: string; name: string }>
  podcastEpisode?: { id: string } | null
} = {}) {
  return {
    article: {
      findFirst: vi.fn().mockResolvedValue(article),
    },
    podcastEpisode: {
      findFirst: vi.fn().mockResolvedValue(podcastEpisode),
    },
    articleCollection: {
      create: vi.fn().mockResolvedValue({ id: "collection-new", name: "Deep Reads" }),
      findFirst: vi.fn().mockResolvedValue(collection),
      findMany: vi.fn().mockResolvedValue(collections),
    },
    articleCollectionItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
  }
}

describe("article collections", () => {
  it("lists a user's collections with article counts", async () => {
    const store = createCollectionStore()

    const collections = await listArticleCollectionsForUserWithClient({
      store,
      userId: "user-1",
    })

    expect(collections).toEqual([
      { articleCount: 2, id: "collection-1", name: "Research" },
    ])
    expect(store.articleCollection.findMany).toHaveBeenCalledWith({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        _count: {
          select: {
            items: {
              where: {
                OR: [
                  {
                    podcastEpisodeId: {
                      not: null,
                    },
                  },
                  {
                    article: {
                      states: {
                        none: {
                          archivedAt: {
                            not: null,
                          },
                          userId: "user-1",
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        id: true,
        name: true,
      },
      where: { userId: "user-1" },
    })
  })

  it("adds an article to an existing collection owned by the current user", async () => {
    const store = createCollectionStore()

    await addArticleToCollectionWithClient({
      articleId: "article-1",
      collectionId: "collection-1",
      store,
      userId: "user-1",
    })

    expect(store.article.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        feed: {
          subscriptions: {
            some: {
              userId: "user-1",
            },
          },
        },
        id: "article-1",
      },
    })
    expect(store.articleCollection.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "collection-1",
        userId: "user-1",
      },
    })
    expect(store.articleCollectionItem.upsert).toHaveBeenCalledWith({
      create: {
        articleId: "article-1",
        collectionId: "collection-1",
      },
      update: {},
      where: {
        collectionId_articleId: {
          articleId: "article-1",
          collectionId: "collection-1",
        },
      },
    })
  })

  it("creates a named collection before adding the article", async () => {
    const store = createCollectionStore({ collection: null })

    await addArticleToCollectionWithClient({
      articleId: "article-1",
      collectionName: "  Deep   Reads  ",
      store,
      userId: "user-1",
    })

    expect(store.articleCollection.create).toHaveBeenCalledWith({
      data: {
        name: "Deep Reads",
        userId: "user-1",
      },
      select: {
        id: true,
        name: true,
      },
    })
    expect(store.articleCollectionItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          articleId: "article-1",
          collectionId: "collection-new",
        },
      })
    )
  })

  it("does not add articles outside the user's subscriptions", async () => {
    const store = createCollectionStore({ article: null })

    await expect(
      addArticleToCollectionWithClient({
        articleId: "article-1",
        collectionId: "collection-1",
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Article not found.")

    expect(store.articleCollectionItem.upsert).not.toHaveBeenCalled()
  })

  it("removes an article from a collection owned by the current user", async () => {
    const store = createCollectionStore()

    await removeArticleFromCollectionWithClient({
      articleId: "article-1",
      collectionId: "collection-1",
      store,
      userId: "user-1",
    })

    expect(store.articleCollectionItem.deleteMany).toHaveBeenCalledWith({
      where: {
        articleId: "article-1",
        collection: {
          id: "collection-1",
          userId: "user-1",
        },
      },
    })
  })

  it("does not silently remove collection items that are not owned by the user", async () => {
    const store = createCollectionStore()
    store.articleCollectionItem.deleteMany.mockResolvedValue({ count: 0 })

    await expect(
      removeArticleFromCollectionWithClient({
        articleId: "article-1",
        collectionId: "collection-1",
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Collection item not found.")
  })

  it("adds subscribed podcast episodes to collections", async () => {
    const store = createCollectionStore()

    await expect(
      addPodcastEpisodeToCollectionWithClient({
        collectionId: "collection-1",
        episodeId: "episode-1",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({ collectionId: "collection-1" })

    expect(store.podcastEpisode.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: "episode-1",
        podcast: {
          subscriptions: {
            some: {
              userId: "user-1",
            },
          },
        },
      },
    })
    expect(store.articleCollectionItem.upsert).toHaveBeenCalledWith({
      create: {
        collectionId: "collection-1",
        podcastEpisodeId: "episode-1",
      },
      update: {},
      where: {
        collectionId_podcastEpisodeId: {
          collectionId: "collection-1",
          podcastEpisodeId: "episode-1",
        },
      },
    })
  })

  it("does not add podcast episodes outside the user's subscriptions", async () => {
    const store = createCollectionStore({ podcastEpisode: null })

    await expect(
      addPodcastEpisodeToCollectionWithClient({
        collectionId: "collection-1",
        episodeId: "episode-1",
        store,
        userId: "user-1",
      })
    ).rejects.toThrow("Podcast episode not found.")

    expect(store.articleCollectionItem.upsert).not.toHaveBeenCalled()
  })

  it("removes podcast episodes from collections owned by the current user", async () => {
    const store = createCollectionStore()

    await removePodcastEpisodeFromCollectionWithClient({
      collectionId: "collection-1",
      episodeId: "episode-1",
      store,
      userId: "user-1",
    })

    expect(store.articleCollectionItem.deleteMany).toHaveBeenCalledWith({
      where: {
        collection: {
          id: "collection-1",
          userId: "user-1",
        },
        podcastEpisodeId: "episode-1",
      },
    })
  })
})
