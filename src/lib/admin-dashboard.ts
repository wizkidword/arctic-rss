import { getPrisma } from "./db"

type DecimalLike =
  | number
  | string
  | null
  | {
      toNumber(): number
    }

type AdminUserRecord = {
  _count: {
    subscriptions: number
  }
  aiMonthlyLimit: number
  aiMonthlyUsed: number
  createdAt: Date
  disabledAt: Date | null
  email: string
  id: string
  name: string | null
  plan: string
  role: string
}

type AdminFeedRecord = {
  _count: {
    subscriptions: number
  }
  feedUrl: string
  id: string
  lastError: string | null
  lastFailedAt: Date | null
  lastSuccessfulFetchAt: Date | null
  title: string
}

type AiUsageAggregate = {
  _count: {
    _all: number
  }
  _sum: {
    costEstimate: DecimalLike
    inputTokens: number | null
    outputTokens: number | null
  }
}

type AiActionGroup = AiUsageAggregate & {
  action: string
}

type AiProviderGroup = AiUsageAggregate & {
  model: string
  provider: string
}

type AiUsageRecord = {
  action: string
  costEstimate: DecimalLike
  createdAt: Date
  id: string
  inputTokens: number
  model: string
  outputTokens: number
  provider: string
  user: {
    email: string
  }
}

type FailedDigestRecord = {
  errorMessage: string | null
  id: string
  updatedAt: Date
  user: {
    email: string
  }
}

type FailedImportRecord = {
  errorLog: unknown
  id: string
  updatedAt: Date
  user: {
    email: string
  }
}

export type AdminDashboardStore = {
  aiDigest: {
    findMany(args: Record<string, unknown>): Promise<FailedDigestRecord[]>
  }
  aiUsageLog: {
    aggregate(args: Record<string, unknown>): Promise<AiUsageAggregate>
    findMany(args: Record<string, unknown>): Promise<AiUsageRecord[]>
    groupBy(
      args: Record<string, unknown>
    ): Promise<AiActionGroup[] | AiProviderGroup[]>
  }
  article: {
    count(args: Record<string, unknown>): Promise<number>
  }
  feed: {
    count(args: Record<string, unknown>): Promise<number>
    findMany(args: Record<string, unknown>): Promise<AdminFeedRecord[]>
  }
  feedSubscription: {
    count(args: Record<string, unknown>): Promise<number>
  }
  importJob: {
    findMany(args: Record<string, unknown>): Promise<FailedImportRecord[]>
  }
  user: {
    count(args: Record<string, unknown>): Promise<number>
    findMany(args: Record<string, unknown>): Promise<AdminUserRecord[]>
  }
}

export class AdminDashboardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AdminDashboardError"
  }
}

export type AdminDashboardData = Awaited<
  ReturnType<typeof getAdminDashboardWithClient>
>

export async function getAdminDashboard({
  isAdmin,
}: {
  isAdmin: boolean
}) {
  return getAdminDashboardWithClient({
    isAdmin,
    store: getPrisma() as unknown as AdminDashboardStore,
  })
}

export async function getAdminDashboardWithClient({
  isAdmin,
  now = () => new Date(),
  store,
}: {
  isAdmin: boolean
  now?: () => Date
  store: AdminDashboardStore
}) {
  if (!isAdmin) {
    throw new AdminDashboardError("Administrator access is required.")
  }

  const generatedAt = now()
  const monthStart = new Date(
    Date.UTC(generatedAt.getUTCFullYear(), generatedAt.getUTCMonth(), 1)
  )
  const staleBefore = new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000)
  const aiAggregate = {
    _count: {
      _all: true,
    },
    _sum: {
      costEstimate: true,
      inputTokens: true,
      outputTokens: true,
    },
  }

  const [
    userCount,
    activeUserCount,
    feedCount,
    failingFeedCount,
    articleCount,
    activeSubscriptionCount,
    users,
    failingFeeds,
    staleFeedCount,
    aiUsage,
    aiByAction,
    aiByProviderModel,
    recentAiUsage,
    failedDigests,
    failedImports,
  ] = await Promise.all([
    store.user.count({}),
    store.user.count({
      where: {
        disabledAt: null,
      },
    }),
    store.feed.count({}),
    store.feed.count({
      where: {
        lastError: {
          not: null,
        },
      },
    }),
    store.article.count({}),
    store.feedSubscription.count({
      where: {
        isPaused: false,
      },
    }),
    store.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
        aiMonthlyLimit: true,
        aiMonthlyUsed: true,
        createdAt: true,
        disabledAt: true,
        email: true,
        id: true,
        name: true,
        plan: true,
        role: true,
      },
      take: 50,
    }),
    store.feed.findMany({
      orderBy: {
        lastFailedAt: "desc",
      },
      select: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
        feedUrl: true,
        id: true,
        lastError: true,
        lastFailedAt: true,
        lastSuccessfulFetchAt: true,
        title: true,
      },
      take: 50,
      where: {
        lastError: {
          not: null,
        },
      },
    }),
    store.feed.count({
      where: {
        OR: [
          {
            lastSuccessfulFetchAt: null,
          },
          {
            lastSuccessfulFetchAt: {
              lt: staleBefore,
            },
          },
        ],
        subscriptions: {
          some: {
            isPaused: false,
          },
        },
      },
    }),
    store.aiUsageLog.aggregate({
      ...aiAggregate,
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    }),
    store.aiUsageLog.groupBy({
      ...aiAggregate,
      by: ["action"],
      orderBy: {
        action: "asc",
      },
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    }),
    store.aiUsageLog.groupBy({
      ...aiAggregate,
      by: ["provider", "model"],
      orderBy: [{ provider: "asc" }, { model: "asc" }],
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    }),
    store.aiUsageLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        action: true,
        costEstimate: true,
        createdAt: true,
        id: true,
        inputTokens: true,
        model: true,
        outputTokens: true,
        provider: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 10,
      where: {
        createdAt: {
          gte: monthStart,
        },
      },
    }),
    store.aiDigest.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        errorMessage: true,
        id: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 25,
      where: {
        status: "FAILED",
      },
    }),
    store.importJob.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        errorLog: true,
        id: true,
        updatedAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 25,
      where: {
        status: "FAILED",
      },
    }),
  ])

  const persistedFailures = [
    ...failedDigests.map((digest) => ({
      id: digest.id,
      message: boundedMessage(
        digest.errorMessage,
        "AI digest processing failed."
      ),
      occurredAt: digest.updatedAt,
      type: "AI digest" as const,
      userEmail: digest.user.email,
    })),
    ...failedImports.map((job) => ({
      id: job.id,
      message: boundedMessage(job.errorLog, "OPML import failed."),
      occurredAt: job.updatedAt,
      type: "OPML import" as const,
      userEmail: job.user.email,
    })),
  ]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 25)

  return {
    aiUsage: {
      byAction: (aiByAction as AiActionGroup[]).map((group) => ({
        action: group.action,
        costEstimate: finiteNumber(group._sum.costEstimate),
        inputTokens: group._sum.inputTokens ?? 0,
        outputTokens: group._sum.outputTokens ?? 0,
        requestCount: group._count._all,
      })),
      byProviderModel: (aiByProviderModel as AiProviderGroup[]).map(
        (group) => ({
          costEstimate: finiteNumber(group._sum.costEstimate),
          inputTokens: group._sum.inputTokens ?? 0,
          model: group.model,
          outputTokens: group._sum.outputTokens ?? 0,
          provider: group.provider,
          requestCount: group._count._all,
        })
      ),
      costEstimate: finiteNumber(aiUsage._sum.costEstimate),
      inputTokens: aiUsage._sum.inputTokens ?? 0,
      monthStart,
      outputTokens: aiUsage._sum.outputTokens ?? 0,
      recent: recentAiUsage.map((usage) => ({
        action: usage.action,
        costEstimate: finiteNumber(usage.costEstimate),
        createdAt: usage.createdAt,
        id: usage.id,
        inputTokens: usage.inputTokens,
        model: usage.model,
        outputTokens: usage.outputTokens,
        provider: usage.provider,
        userEmail: usage.user.email,
      })),
      requestCount: aiUsage._count._all,
    },
    feedHealth: {
      failingCount: failingFeedCount,
      failingFeeds: failingFeeds.map((feed) => ({
        feedUrl: feed.feedUrl,
        id: feed.id,
        lastError: boundedMessage(feed.lastError, "Feed refresh failed."),
        lastFailedAt: feed.lastFailedAt,
        lastSuccessfulFetchAt: feed.lastSuccessfulFetchAt,
        subscriberCount: feed._count.subscriptions,
        title: feed.title,
      })),
      staleCount: staleFeedCount,
    },
    generatedAt,
    overview: {
      activeSubscriptionCount,
      activeUserCount,
      articleCount,
      failingFeedCount,
      feedCount,
      userCount,
    },
    persistedFailures,
    users: users.map((user) => ({
      aiMonthlyLimit: user.aiMonthlyLimit,
      aiMonthlyUsed: user.aiMonthlyUsed,
      createdAt: user.createdAt,
      disabledAt: user.disabledAt,
      email: user.email,
      id: user.id,
      name: user.name,
      plan: user.plan,
      role: user.role,
      subscriptionCount: user._count.subscriptions,
    })),
  }
}

function finiteNumber(value: DecimalLike | undefined) {
  let converted = 0

  if (typeof value === "number") {
    converted = value
  } else if (typeof value === "string") {
    converted = Number(value)
  } else if (value && typeof value.toNumber === "function") {
    converted = value.toNumber()
  }

  return Number.isFinite(converted) ? converted : 0
}

function boundedMessage(value: unknown, fallback: string) {
  let message = fallback

  if (typeof value === "string" && value.trim()) {
    message = value.trim()
  } else if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string" &&
    value.message.trim()
  ) {
    message = value.message.trim()
  } else if (value !== null && value !== undefined) {
    try {
      message = JSON.stringify(value)
    } catch {
      message = fallback
    }
  }

  return message.length > 500 ? `${message.slice(0, 497)}...` : message
}
