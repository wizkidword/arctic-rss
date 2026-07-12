import { getPrisma } from "./db"
import { extractReadableArticleContent } from "./article-content-extraction"
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
  fetchArticleContent?: (url: URL) => Promise<SafeFetchTextResult>
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
  fetchArticleContent = safeFetchText,
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
    const articles = await hydrateLinkedArticleContent({
      articles: parseFeedArticles(response.text, response.url.href),
      feedUrl: feed.feedUrl,
      fetchArticleContent,
      responseUrl: response.url.href,
    })

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

async function hydrateLinkedArticleContent({
  articles,
  feedUrl,
  fetchArticleContent,
  responseUrl,
}: {
  articles: ParsedFeedArticle[]
  feedUrl: string
  fetchArticleContent: (url: URL) => Promise<SafeFetchTextResult>
  responseUrl: string
}) {
  if (!isHackerNewsFeed(feedUrl) && !isHackerNewsFeed(responseUrl)) {
    return articles
  }

  const hydratedArticles: ParsedFeedArticle[] = []

  for (const article of articles) {
    if (!needsLinkedArticleHydration(article)) {
      hydratedArticles.push(article)
      continue
    }

    try {
      const response = await fetchArticleContent(normalizeHttpUrl(article.url))
      const extracted = extractReadableArticleContent(
        response.text,
        response.url.href
      )

      if (!extracted) {
        hydratedArticles.push(article)
        continue
      }

      hydratedArticles.push({
        ...article,
        contentHtml: extracted.contentHtml,
        contentText: extracted.contentText,
        imageUrl: article.imageUrl ?? extracted.imageUrl,
        summary:
          meaningfulSummary(article.summary) ??
          extracted.summary ??
          excerpt(extracted.contentText),
      })
    } catch {
      hydratedArticles.push(article)
    }
  }

  return hydratedArticles
}

function isHackerNewsFeed(value: string) {
  try {
    return new URL(value).hostname.toLowerCase() === "news.ycombinator.com"
  } catch {
    return false
  }
}

function needsLinkedArticleHydration(article: ParsedFeedArticle) {
  const contentText = article.contentText?.trim()

  return !contentText || contentText.toLowerCase() === "comments"
}

function meaningfulSummary(value: string | undefined) {
  const summary = value?.trim()

  if (!summary || summary.toLowerCase() === "comments") {
    return undefined
  }

  return summary
}

function excerpt(value: string) {
  return value.length <= 240 ? value : `${value.slice(0, 237).trimEnd()}...`
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
