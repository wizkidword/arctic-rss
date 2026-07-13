import { Prisma } from "../generated/prisma/client"
import { cache } from "react"

import { getPrisma } from "./db"

export const COLLECTION_LIMIT = 100
export const DATABASE_COLLECTION_LIMIT_ERROR = "ARCTIC_RSS_COLLECTION_LIMIT_REACHED"

type ArticleLookup = {
  id: string
}

type PodcastEpisodeLookup = {
  id: string
}

type CollectionLookup = {
  id: string
}

type CollectionListRow = {
  _count: {
    items: number
  }
  id: string
  name: string
}

type ArticleCollectionStore = {
  article: {
    findFirst(args: {
      select: { id: true }
      where: Prisma.ArticleWhereInput
    }): Promise<ArticleLookup | null>
  }
  podcastEpisode: {
    findFirst(args: {
      select: { id: true }
      where: Prisma.PodcastEpisodeWhereInput
    }): Promise<PodcastEpisodeLookup | null>
  }
  articleCollection: {
    create(args: {
      data: {
        name: string
        userId: string
      }
      select: {
        id: true
        name: true
      }
    }): Promise<CollectionLookup & { name: string }>
    findFirst(args: {
      select: { id: true }
      where: Prisma.ArticleCollectionWhereInput
    }): Promise<CollectionLookup | null>
    findMany(args: {
      orderBy: Prisma.ArticleCollectionOrderByWithRelationInput[]
      select: {
        _count: {
          select: {
            items:
              | true
              | {
                  where: Prisma.ArticleCollectionItemWhereInput
                }
          }
        }
        id: true
        name: true
      }
      where: Prisma.ArticleCollectionWhereInput
    }): Promise<CollectionListRow[]>
  }
  articleCollectionItem: {
    deleteMany(args: {
      where: Prisma.ArticleCollectionItemWhereInput
    }): Promise<{ count: number }>
    upsert(args: {
      create: Prisma.ArticleCollectionItemUncheckedCreateInput
      update: Prisma.ArticleCollectionItemUpdateInput
      where: Prisma.ArticleCollectionItemWhereUniqueInput
    }): Promise<unknown>
  }
}

export type ArticleCollectionPickerItem = {
  articleCount: number
  id: string
  name: string
}

export class ArticleCollectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArticleCollectionError"
  }
}

function isDatabaseCollectionLimitError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(DATABASE_COLLECTION_LIMIT_ERROR)
  )
}

export const listArticleCollectionsForUser = cache(
  async function listArticleCollectionsForUser(
    userId: string
  ): Promise<ArticleCollectionPickerItem[]> {
    return listArticleCollectionsForUserWithClient({
      store: getArticleCollectionStore(),
      userId,
    })
  }
)

export async function listArticleCollectionsForUserWithClient({
  store,
  userId,
}: {
  store: ArticleCollectionStore
  userId: string
}): Promise<ArticleCollectionPickerItem[]> {
  const collections = await store.articleCollection.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      _count: {
        select: {
          items: visibleCollectionItemWhere(userId),
        },
      },
      id: true,
      name: true,
    },
    where: { userId },
  })

  return collections.map((collection) => ({
    articleCount: collection._count.items,
    id: collection.id,
    name: collection.name,
  }))
}

function visibleCollectionItemWhere(
  userId: string
): { where: Prisma.ArticleCollectionItemWhereInput } {
  return {
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
                userId,
              },
            },
          },
        },
      ],
    },
  }
}

export async function addArticleToCollection({
  articleId,
  collectionId,
  collectionName,
  userId,
}: {
  articleId: string
  collectionId?: string
  collectionName?: string
  userId: string
}) {
  return addArticleToCollectionWithClient({
    articleId,
    collectionId,
    collectionName,
    store: getArticleCollectionStore(),
    userId,
  })
}

export async function addArticleToCollectionWithClient({
  articleId,
  collectionId,
  collectionName,
  store,
  userId,
}: {
  articleId: string
  collectionId?: string
  collectionName?: string
  store: ArticleCollectionStore
  userId: string
}) {
  const normalizedArticleId = articleId.trim()

  if (!normalizedArticleId) {
    throw new ArticleCollectionError("Article is required.")
  }

  await assertArticleBelongsToUser({
    articleId: normalizedArticleId,
    store,
    userId,
  })

  const normalizedCollectionId = collectionId?.trim()
  const resolvedCollectionId = normalizedCollectionId
    ? await resolveExistingCollectionId({
        collectionId: normalizedCollectionId,
        store,
        userId,
      })
    : await createCollectionId({
        collectionName,
        store,
        userId,
      })

  await store.articleCollectionItem.upsert({
    create: {
      articleId: normalizedArticleId,
      collectionId: resolvedCollectionId,
    },
    update: {},
    where: {
      collectionId_articleId: {
        articleId: normalizedArticleId,
        collectionId: resolvedCollectionId,
      },
    },
  })

  return {
    collectionId: resolvedCollectionId,
  }
}

export async function removeArticleFromCollection({
  articleId,
  collectionId,
  userId,
}: {
  articleId: string
  collectionId: string
  userId: string
}) {
  return removeArticleFromCollectionWithClient({
    articleId,
    collectionId,
    store: getArticleCollectionStore(),
    userId,
  })
}

export async function removeArticleFromCollectionWithClient({
  articleId,
  collectionId,
  store,
  userId,
}: {
  articleId: string
  collectionId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const normalizedArticleId = articleId.trim()
  const normalizedCollectionId = collectionId.trim()

  if (!normalizedArticleId) {
    throw new ArticleCollectionError("Article is required.")
  }

  if (!normalizedCollectionId) {
    throw new ArticleCollectionError("Collection is required.")
  }

  const result = await store.articleCollectionItem.deleteMany({
    where: {
      articleId: normalizedArticleId,
      collection: {
        id: normalizedCollectionId,
        userId,
      },
    },
  })

  if (result.count === 0) {
    throw new ArticleCollectionError("Collection item not found.")
  }

  return {
    collectionId: normalizedCollectionId,
    removedCount: result.count,
  }
}

export async function addPodcastEpisodeToCollection({
  collectionId,
  collectionName,
  episodeId,
  userId,
}: {
  collectionId?: string
  collectionName?: string
  episodeId: string
  userId: string
}) {
  return addPodcastEpisodeToCollectionWithClient({
    collectionId,
    collectionName,
    episodeId,
    store: getArticleCollectionStore(),
    userId,
  })
}

export async function addPodcastEpisodeToCollectionWithClient({
  collectionId,
  collectionName,
  episodeId,
  store,
  userId,
}: {
  collectionId?: string
  collectionName?: string
  episodeId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const normalizedEpisodeId = episodeId.trim()

  if (!normalizedEpisodeId) {
    throw new ArticleCollectionError("Podcast episode is required.")
  }

  await assertPodcastEpisodeBelongsToUser({
    episodeId: normalizedEpisodeId,
    store,
    userId,
  })

  const normalizedCollectionId = collectionId?.trim()
  const resolvedCollectionId = normalizedCollectionId
    ? await resolveExistingCollectionId({
        collectionId: normalizedCollectionId,
        store,
        userId,
      })
    : await createCollectionId({
        collectionName,
        store,
        userId,
      })

  await store.articleCollectionItem.upsert({
    create: {
      collectionId: resolvedCollectionId,
      podcastEpisodeId: normalizedEpisodeId,
    },
    update: {},
    where: {
      collectionId_podcastEpisodeId: {
        collectionId: resolvedCollectionId,
        podcastEpisodeId: normalizedEpisodeId,
      },
    },
  })

  return {
    collectionId: resolvedCollectionId,
  }
}

export async function removePodcastEpisodeFromCollection({
  collectionId,
  episodeId,
  userId,
}: {
  collectionId: string
  episodeId: string
  userId: string
}) {
  return removePodcastEpisodeFromCollectionWithClient({
    collectionId,
    episodeId,
    store: getArticleCollectionStore(),
    userId,
  })
}

export async function removePodcastEpisodeFromCollectionWithClient({
  collectionId,
  episodeId,
  store,
  userId,
}: {
  collectionId: string
  episodeId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const normalizedCollectionId = collectionId.trim()
  const normalizedEpisodeId = episodeId.trim()

  if (!normalizedEpisodeId) {
    throw new ArticleCollectionError("Podcast episode is required.")
  }

  if (!normalizedCollectionId) {
    throw new ArticleCollectionError("Collection is required.")
  }

  const result = await store.articleCollectionItem.deleteMany({
    where: {
      collection: {
        id: normalizedCollectionId,
        userId,
      },
      podcastEpisodeId: normalizedEpisodeId,
    },
  })

  if (result.count === 0) {
    throw new ArticleCollectionError("Collection item not found.")
  }

  return {
    collectionId: normalizedCollectionId,
    removedCount: result.count,
  }
}

async function assertArticleBelongsToUser({
  articleId,
  store,
  userId,
}: {
  articleId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const article = await store.article.findFirst({
    select: { id: true },
    where: {
      feed: {
        subscriptions: {
          some: {
            userId,
          },
        },
      },
      id: articleId,
    },
  })

  if (!article) {
    throw new ArticleCollectionError("Article not found.")
  }
}

async function assertPodcastEpisodeBelongsToUser({
  episodeId,
  store,
  userId,
}: {
  episodeId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const episode = await store.podcastEpisode.findFirst({
    select: { id: true },
    where: {
      id: episodeId,
      podcast: {
        subscriptions: {
          some: {
            userId,
          },
        },
      },
    },
  })

  if (!episode) {
    throw new ArticleCollectionError("Podcast episode not found.")
  }
}

async function resolveExistingCollectionId({
  collectionId,
  store,
  userId,
}: {
  collectionId: string
  store: ArticleCollectionStore
  userId: string
}) {
  const collection = await store.articleCollection.findFirst({
    select: { id: true },
    where: {
      id: collectionId,
      userId,
    },
  })

  if (!collection) {
    throw new ArticleCollectionError("Collection not found.")
  }

  return collection.id
}

async function createCollectionId({
  collectionName,
  store,
  userId,
}: {
  collectionName?: string
  store: ArticleCollectionStore
  userId: string
}) {
  const name = normalizeCollectionName(collectionName ?? "")
  let collection: CollectionLookup & { name: string }

  try {
    collection = await store.articleCollection.create({
      data: {
        name,
        userId,
      },
      select: {
        id: true,
        name: true,
      },
    })
  } catch (error) {
    if (isDatabaseCollectionLimitError(error)) {
      throw new ArticleCollectionError(
        `You can create up to ${COLLECTION_LIMIT} collections.`
      )
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ArticleCollectionError(
        "A collection with that name already exists."
      )
    }

    throw error
  }

  return collection.id
}

function normalizeCollectionName(name: string) {
  const normalizedName = name.trim().replace(/\s+/g, " ")

  if (!normalizedName) {
    throw new ArticleCollectionError("Collection name is required.")
  }

  if (normalizedName.length > 80) {
    throw new ArticleCollectionError(
      "Collection name must be 80 characters or fewer."
    )
  }

  return normalizedName
}

function getArticleCollectionStore() {
  return getPrisma() as unknown as ArticleCollectionStore
}
