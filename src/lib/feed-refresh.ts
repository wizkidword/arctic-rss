import { getPrisma } from "./db"
import { parseFeedArticles, type ParsedFeedArticle } from "./feed-articles"
import {
  normalizeHttpUrl,
  safeFetchText,
  type SafeFetchTextResult,
} from "./url-safety"

type RefreshableFeed = {
  feedUrl: string
  id: string
}

type FeedRefreshStore = {
  article: {
    upsert(args: {
      create: Record<string, unknown>
      update: Record<string, unknown>
      where: {
        feedId_externalId: {
          externalId: string
          feedId: string
        }
      }
    }): Promise<unknown>
  }
  feed: {
    findUnique(args: {
      select: {
        feedUrl: true
        id: true
      }
      where: {
        id: string
      }
    }): Promise<RefreshableFeed | null>
    update(args: {
      data: Record<string, unknown>
      where: {
        id: string
      }
    }): Promise<unknown>
  }
}

type RefreshFeedOptions = {
  feedId: string
  fetchText?: (url: URL) => Promise<SafeFetchTextResult>
  now?: () => Date
  store?: FeedRefreshStore
}

export type RefreshFeedResult = {
  articleCount: number
  feedId: string
}

export class FeedRefreshError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FeedRefreshError"
  }
}

export async function refreshFeed(feedId: string) {
  return refreshFeedWithClient({
    feedId,
    store: getFeedRefreshStore(),
  })
}

export async function refreshFeedWithClient({
  feedId,
  fetchText = safeFetchText,
  now = () => new Date(),
  store = getFeedRefreshStore(),
}: RefreshFeedOptions): Promise<RefreshFeedResult> {
  const feed = await store.feed.findUnique({
    select: {
      feedUrl: true,
      id: true,
    },
    where: { id: feedId },
  })

  if (!feed) {
    throw new FeedRefreshError("Feed not found.")
  }

  const fetchedAt = now()

  try {
    const response = await fetchText(normalizeHttpUrl(feed.feedUrl))
    const articles = parseFeedArticles(response.text, response.url.href)

    for (const article of articles) {
      await store.article.upsert(articleUpsertArgs(feed.id, article))
    }

    await store.feed.update({
      data: {
        lastError: null,
        lastFailedAt: null,
        lastFetchedAt: fetchedAt,
        lastSuccessfulFetchAt: fetchedAt,
      },
      where: { id: feed.id },
    })

    return {
      articleCount: articles.length,
      feedId: feed.id,
    }
  } catch (error) {
    await store.feed.update({
      data: {
        lastError: errorMessage(error),
        lastFailedAt: fetchedAt,
        lastFetchedAt: fetchedAt,
      },
      where: { id: feed.id },
    })

    throw error
  }
}

function articleUpsertArgs(feedId: string, article: ParsedFeedArticle) {
  return {
    create: withoutUndefined({
      ...article,
      feedId,
    }),
    update: withoutUndefined({
      author: article.author,
      canonicalUrl: article.canonicalUrl,
      contentHtml: article.contentHtml,
      contentText: article.contentText,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      summary: article.summary,
      title: article.title,
      url: article.url,
    }),
    where: {
      feedId_externalId: {
        externalId: article.externalId,
        feedId,
      },
    },
  }
}

function withoutUndefined(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  )
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message.slice(0, 500)
  }

  return "Feed refresh failed."
}

function getFeedRefreshStore() {
  return getPrisma() as unknown as FeedRefreshStore
}
