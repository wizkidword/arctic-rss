import { defaultUserSettings } from "./settings"
import { getPrisma } from "./db"
import { eligibleAiDigestArticleWhere } from "./ai-digests"

type DashboardUser = {
  aiMonthlyLimit: number
  aiMonthlyUsed: number
  settings: {
    aiAutoSummariesEnabled: boolean
    dailyDigestEnabled: boolean
  } | null
}

type DashboardSummary = {
  article: {
    feed: {
      title: string
    }
    id: string
    title: string
    url: string
  }
  createdAt: Date
  id: string
  model: string
  provider: string
  shortSummary: string
}

type DigestArticle = {
  aiSummaries: Array<{
    shortSummary: string
  }>
  contentText: string | null
  feed: {
    title: string
  }
  id: string
  publishedAt: Date | null
  summary: string | null
  title: string
  url: string
}

type DashboardDigest = {
  articleCount: number
  completedAt: Date | null
  createdAt: Date
  errorMessage: string | null
  id: string
  overview: string | null
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  title: string | null
}

export type AiDashboardStore = {
  article: {
    count(args: Record<string, unknown>): Promise<number>
    findMany(args: Record<string, unknown>): Promise<DigestArticle[]>
  }
  aiDigest: {
    findMany(args: Record<string, unknown>): Promise<DashboardDigest[]>
  }
  articleAiSummary: {
    count(args: Record<string, unknown>): Promise<number>
    findMany(args: Record<string, unknown>): Promise<DashboardSummary[]>
  }
  user: {
    findUnique(args: Record<string, unknown>): Promise<DashboardUser | null>
  }
  userSettings: {
    upsert(args: Record<string, unknown>): Promise<unknown>
  }
}

export async function getAiDashboardForUser({
  userId,
}: {
  userId: string
}) {
  return getAiDashboardWithClient({
    store: getPrisma() as unknown as AiDashboardStore,
    userId,
  })
}

export async function getAiDashboardWithClient({
  now = () => new Date(),
  store,
  userId,
}: {
  now?: () => Date
  store: AiDashboardStore
  userId: string
}) {
  const activeSubscription = {
    feed: {
      subscriptions: {
        some: {
          isPaused: false,
          userId,
        },
      },
    },
  }
  const digestStart = new Date(now().getTime() - 24 * 60 * 60 * 1000)
  const [
    user,
    summaryCount,
    recentSummaries,
    digestArticles,
    eligibleDigestArticleCount,
    digestHistory,
  ] =
    await Promise.all([
      store.user.findUnique({
        select: {
          aiMonthlyLimit: true,
          aiMonthlyUsed: true,
          settings: {
            select: {
              aiAutoSummariesEnabled: true,
              dailyDigestEnabled: true,
            },
          },
        },
        where: {
          id: userId,
        },
      }),
      store.articleAiSummary.count({
        where: {
          article: activeSubscription,
        },
      }),
      store.articleAiSummary.findMany({
        include: {
          article: {
            select: {
              feed: {
                select: {
                  title: true,
                },
              },
              id: true,
              title: true,
              url: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        where: {
          article: activeSubscription,
        },
      }),
      store.article.findMany({
        include: {
          aiSummaries: {
            orderBy: {
              createdAt: "desc",
            },
            select: {
              shortSummary: true,
            },
            take: 1,
          },
          feed: {
            select: {
              title: true,
            },
          },
        },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
        where: {
          AND: [
            activeSubscription,
            {
              publishedAt: {
                gte: digestStart,
              },
            },
            {
              states: {
                none: {
                  isRead: true,
                  userId,
                },
              },
            },
          ],
        },
      }),
      store.article.count({
        where: eligibleAiDigestArticleWhere(userId),
      }),
      store.aiDigest.findMany({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          articleCount: true,
          completedAt: true,
          createdAt: true,
          errorMessage: true,
          id: true,
          overview: true,
          status: true,
          title: true,
        },
        take: 10,
        where: {
          userId,
        },
      }),
    ])

  if (!user) {
    throw new Error("User not found.")
  }

  const monthlyRemaining = Math.max(
    0,
    user.aiMonthlyLimit - user.aiMonthlyUsed
  )
  const percentUsed =
    user.aiMonthlyLimit > 0
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round((user.aiMonthlyUsed / user.aiMonthlyLimit) * 100)
          )
        )
      : 0

  return {
    activeDigest:
      digestHistory.find(
        (digest) =>
          digest.status === "PENDING" || digest.status === "PROCESSING"
      ) ?? null,
    digestArticles: digestArticles.map((article) => ({
      feedTitle: article.feed.title,
      id: article.id,
      publishedAt: article.publishedAt,
      summary:
        article.aiSummaries[0]?.shortSummary ||
        article.summary ||
        summarizeFallback(article.contentText),
      title: article.title,
      url: article.url,
    })),
    digestHistory,
    eligibleDigestArticleCount,
    preferences: {
      aiAutoSummariesEnabled:
        user.settings?.aiAutoSummariesEnabled ?? false,
      dailyDigestEnabled: user.settings?.dailyDigestEnabled ?? false,
    },
    recentSummaries: recentSummaries.map((summary) => ({
      articleId: summary.article.id,
      articleTitle: summary.article.title,
      createdAt: summary.createdAt,
      feedTitle: summary.article.feed.title,
      id: summary.id,
      model: summary.model,
      provider: summary.provider,
      shortSummary: summary.shortSummary,
      url: summary.article.url,
    })),
    summaryCount,
    usage: {
      monthlyLimit: user.aiMonthlyLimit,
      monthlyRemaining,
      monthlyUsed: user.aiMonthlyUsed,
      percentUsed,
    },
  }
}

export async function updateAiPreferencesForUser({
  aiAutoSummariesEnabled,
  dailyDigestEnabled,
  userId,
}: {
  aiAutoSummariesEnabled: boolean
  dailyDigestEnabled: boolean
  userId: string
}) {
  return updateAiPreferencesWithClient({
    aiAutoSummariesEnabled,
    dailyDigestEnabled,
    store: getPrisma() as unknown as AiDashboardStore,
    userId,
  })
}

export async function updateAiPreferencesWithClient({
  aiAutoSummariesEnabled,
  dailyDigestEnabled,
  store,
  userId,
}: {
  aiAutoSummariesEnabled: boolean
  dailyDigestEnabled: boolean
  store: AiDashboardStore
  userId: string
}) {
  const defaults = defaultUserSettings()

  return store.userSettings.upsert({
    create: {
      ...defaults,
      aiAutoSummariesEnabled,
      dailyDigestEnabled,
      userId,
    },
    update: {
      aiAutoSummariesEnabled,
      dailyDigestEnabled,
    },
    where: {
      userId,
    },
  })
}

function summarizeFallback(content: string | null) {
  const compact = content?.replace(/\s+/g, " ").trim()

  if (!compact) {
    return "No summary available."
  }

  return compact.length > 280
    ? `${compact.slice(0, 277).trimEnd()}...`
    : compact
}
