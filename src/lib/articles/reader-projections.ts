import { Prisma } from "../../generated/prisma/client"
import { imageProxyUrl } from "../image-proxy-url"
import { sanitizeArticleHtml, type SanitizedArticleHtml } from "./sanitization"

export type ReaderArticleAiSummary = {
  bulletSummary: string[]
  category: string | null
  id: string
  keyTakeaway: string | null
  model: string
  provider: string
  readingTimeSeconds: number | null
  sentiment: string | null
  shortSummary: string
  tokenCount: number | null
}

export type ReaderArticleListItem = {
  feedFaviconUrl: string | null
  feedId: string
  feedTitle: string
  id: string
  imageUrl: string | null
  isRead: boolean
  isStarred: boolean
  publishedAt: Date | null
  summary: string | null
  title: string
  url: string
}

export type ReaderArticle = ReaderArticleListItem & {
  aiSummary: ReaderArticleAiSummary | null
  author: string | null
  contentText: string | null
  readAt: Date | null
  sanitizedContentHtml: SanitizedArticleHtml | null
  starredAt: Date | null
}

export type StoryClusterArticleProjection = {
  feedTitle: string
  id: string
  publishedAt: Date | null
  title: string
  url: string
}

type ReaderArticleListRecord = {
  createdAt: Date
  feed: {
    faviconUrl: string | null
    id: string
    title: string
  }
  feedId: string
  id: string
  imageUrl: string | null
  publishedAt: Date | null
  states: Array<{
    isRead: boolean
    isStarred: boolean
  }>
  summary: string | null
  title: string
  url: string
}

type ReaderArticleRecord = {
  aiSummaries: Array<{
    bulletSummary: unknown
    category: string | null
    id: string
    keyTakeaway: string | null
    model: string
    provider: string
    readingTimeSeconds: number | null
    sentiment: string | null
    shortSummary: string
    tokenCount: number | null
  }>
  author: string | null
  contentHtml: string | null
  contentText: string | null
  createdAt: Date
  feed: {
    faviconUrl: string | null
    id: string
    title: string
  }
  feedId: string
  id: string
  imageUrl: string | null
  publishedAt: Date | null
  states: Array<{
    archivedAt: Date | null
    isRead: boolean
    isStarred: boolean
    readAt: Date | null
    starredAt: Date | null
  }>
  summary: string | null
  title: string
  url: string
}

type StoryClusterArticleRecord = {
  feed: {
    title: string
  }
  id: string
  publishedAt: Date | null
  title: string
  url: string
}

export type PublicReaderArticleListStore = {
  article: {
    findMany(args: {
      select: Prisma.ArticleSelect
      orderBy: Array<{ publishedAt: "desc" } | { createdAt: "desc" }>
      take: number
      where: Prisma.ArticleWhereInput
    }): Promise<ReaderArticleListRecord[]>
  }
}

export type ReaderArticleListStore = {
  article: {
    findMany(args: {
      orderBy: Array<
        | { publishedAt: { nulls: "last"; sort: "desc" } }
        | { createdAt: "desc" }
        | { id: "desc" }
      >
      select: Prisma.ArticleSelect
      take: number
      where: Prisma.ArticleWhereInput
    }): Promise<ReaderArticleListRecord[]>
  }
}

export type ReaderArticleListItemsStore = {
  article: {
    findMany(args: {
      select: Prisma.ArticleSelect
      where: Prisma.ArticleWhereInput
    }): Promise<ReaderArticleListRecord[]>
  }
}

export type StoryClusterArticleStore = {
  article: {
    findMany(args: {
      select: Prisma.ArticleSelect
      where: Prisma.ArticleWhereInput
    }): Promise<StoryClusterArticleRecord[]>
  }
}

export type ReaderArticleStore = {
  article: {
    findMany(args: {
      include: Prisma.ArticleInclude
      where: Prisma.ArticleWhereInput
    }): Promise<ReaderArticleRecord[]>
  }
}

export function readerArticleListSelect(userId: string) {
  return {
    feed: {
      select: {
        faviconUrl: true,
        id: true,
        title: true,
      },
    },
    feedId: true,
    createdAt: true,
    id: true,
    imageUrl: true,
    publishedAt: true,
    states: {
      select: {
        isRead: true,
        isStarred: true,
      },
      take: 1,
      where: {
        userId,
      },
    },
    summary: true,
    title: true,
    url: true,
  } satisfies Prisma.ArticleSelect
}

export function storyClusterArticleSelect() {
  return {
    feed: {
      select: {
        title: true,
      },
    },
    id: true,
    publishedAt: true,
    title: true,
    url: true,
  } satisfies Prisma.ArticleSelect
}

export function readerArticleInclude(userId: string) {
  return {
    aiSummaries: {
      orderBy: {
        createdAt: "desc",
      },
      select: {
        bulletSummary: true,
        category: true,
        id: true,
        keyTakeaway: true,
        model: true,
        provider: true,
        readingTimeSeconds: true,
        sentiment: true,
        shortSummary: true,
        tokenCount: true,
      },
      take: 1,
    },
    feed: {
      select: {
        faviconUrl: true,
        id: true,
        title: true,
      },
    },
    states: {
      take: 1,
      where: {
        userId,
      },
    },
  } satisfies Prisma.ArticleInclude
}

export function mapReaderArticleListItem(
  article: ReaderArticleListRecord
): ReaderArticleListItem {
  const state = article.states[0]

  return {
    feedFaviconUrl: article.feed.faviconUrl,
    feedId: article.feedId,
    feedTitle: article.feed.title,
    id: article.id,
    imageUrl: imageProxyUrl(article.imageUrl),
    isRead: state?.isRead ?? false,
    isStarred: state?.isStarred ?? false,
    publishedAt: article.publishedAt,
    summary: article.summary,
    title: article.title,
    url: article.url,
  }
}

export function mapStoryClusterArticle(
  article: StoryClusterArticleRecord
): StoryClusterArticleProjection {
  return {
    feedTitle: article.feed.title,
    id: article.id,
    publishedAt: article.publishedAt,
    title: article.title,
    url: article.url,
  }
}

export function mapReaderArticle(article: ReaderArticleRecord): ReaderArticle {
  const aiSummary = article.aiSummaries[0]

  return {
    ...mapReaderArticleListItem(article),
    aiSummary: aiSummary
      ? {
          bulletSummary: normalizeBulletSummary(aiSummary.bulletSummary),
          category: aiSummary.category,
          id: aiSummary.id,
          keyTakeaway: aiSummary.keyTakeaway,
          model: aiSummary.model,
          provider: aiSummary.provider,
          readingTimeSeconds: aiSummary.readingTimeSeconds,
          sentiment: aiSummary.sentiment,
          shortSummary: aiSummary.shortSummary,
          tokenCount: aiSummary.tokenCount,
        }
      : null,
    author: article.author,
    contentText: article.contentText,
    readAt: article.states[0]?.readAt ?? null,
    sanitizedContentHtml: sanitizeArticleHtml(article.contentHtml),
    starredAt: article.states[0]?.starredAt ?? null,
  }
}

function normalizeBulletSummary(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((bullet): bullet is string => typeof bullet === "string")
}
