import { unstable_cache } from "next/cache"

import { getPrisma } from "./db"

export const ADMIN_DASHBOARD_OVERVIEW_CACHE_TAG = "admin-dashboard-overview"
export const ADMIN_DASHBOARD_AI_USAGE_CACHE_TAG = "admin-dashboard-ai-usage"
export const ADMIN_DASHBOARD_PAGE_SIZE = 25
const ADMIN_DASHBOARD_MAX_PAGE = 10_000
const ADMIN_DASHBOARD_MAX_RANGE_DAYS = 366
const ADMIN_DASHBOARD_MAX_FEEDBACK_SEARCH_LENGTH = 120

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
  aiUsagePeriods: Array<{
    consumedUnits: number
    reservedUnits: number
  }>
  createdAt: Date
  disabledAt: Date | null
  email: string
  id: string
  lastLoginAt: Date | null
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

type BugReportRecord = {
  contactEmail: string | null
  createdAt: Date
  description: string
  id: string
  pageUrl: string | null
  status: string
  title: string
  userAgent: string | null
  user: {
    email: string
  } | null
}

type FeatureSuggestionRecord = {
  contactEmail: string | null
  createdAt: Date
  description: string
  id: string
  pageUrl: string | null
  status: string
  title: string
  userAgent: string | null
  user: {
    email: string
  } | null
}

export type AdminDashboardStore = {
  aiDigest: {
    findMany(args: Record<string, unknown>): Promise<FailedDigestRecord[]>
  }
  aiUsageLog: {
    aggregate(args: Record<string, unknown>): Promise<AiUsageAggregate>
    findMany(args: Record<string, unknown>): Promise<AiUsageRecord[]>
    groupBy(
      args: Record<string, unknown>,
    ): Promise<AiActionGroup[] | AiProviderGroup[]>
  }
  article: {
    count(args: Record<string, unknown>): Promise<number>
  }
  bugReport: {
    findMany(args: Record<string, unknown>): Promise<BugReportRecord[]>
  }
  featureSuggestion: {
    findMany(args: Record<string, unknown>): Promise<FeatureSuggestionRecord[]>
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

export type AdminDashboardFilters = {
  activityEnd: Date
  activityStart: Date
  bugReportsPage: number
  feedbackSearch: string
  from: string
  to: string
  featureSuggestionsPage: number
  feedsPage: number
  usersPage: number
}

export type AdminDashboardPagination = {
  hasNextPage: boolean
  page: number
  pageSize: number
}

type AdminActivityRange = Pick<
  AdminDashboardFilters,
  "activityEnd" | "activityStart"
>

type AdminDashboardOverview = {
  generatedAt: Date
  overview: {
    activeSubscriptionCount: number
    activeUserCount: number
    articleCount: number
    failingFeedCount: number
    feedCount: number
    userCount: number
  }
}

type AdminDashboardFeedHealth = {
  failingCount: number
  staleCount: number
}

export function parseAdminDashboardFilters(
  params: Record<string, string | string[] | undefined>,
  now = new Date(),
): AdminDashboardFilters {
  const defaultStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  )
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const requestedStart = parseUtcDate(firstValue(params.from))
  const requestedEnd = parseUtcDate(firstValue(params.to))
  const rangeIsValid =
    requestedStart &&
    requestedEnd &&
    requestedEnd.getTime() >= requestedStart.getTime() &&
    requestedEnd.getTime() - requestedStart.getTime() <=
      ADMIN_DASHBOARD_MAX_RANGE_DAYS * 24 * 60 * 60 * 1_000
  const activityStart = rangeIsValid ? requestedStart : defaultStart
  const inclusiveEnd = rangeIsValid ? requestedEnd : defaultEnd

  return {
    activityEnd: new Date(inclusiveEnd.getTime() + 24 * 60 * 60 * 1_000),
    activityStart,
    bugReportsPage: parsePage(params.bugReportsPage),
    feedbackSearch: parseFeedbackSearch(params.feedbackSearch),
    featureSuggestionsPage: parsePage(params.featureSuggestionsPage),
    feedsPage: parsePage(params.feedsPage),
    from: dateInputValue(activityStart),
    to: dateInputValue(inclusiveEnd),
    usersPage: parsePage(params.usersPage),
  }
}

export async function getAdminDashboardOverview() {
  return getCachedAdminDashboardOverview()
}

export async function getAdminDashboardUsers({
  page,
}: {
  page: number
}) {
  return getAdminDashboardUsersWithClient({
    isAdmin: true,
    page,
    store: getPrisma() as unknown as AdminDashboardStore,
  })
}

export async function getAdminDashboardFeedHealth({
  page,
}: {
  page: number
}) {
  const [counts, feeds] = await Promise.all([
    getCachedAdminDashboardFeedHealth(),
    getAdminDashboardFailingFeedsWithClient({
      isAdmin: true,
      page,
      store: getPrisma() as unknown as AdminDashboardStore,
    }),
  ])

  return {
    ...counts,
    ...feeds,
  }
}

export async function getAdminDashboardFeedback({
  filters,
}: {
  filters: Pick<
    AdminDashboardFilters,
    | "activityEnd"
    | "activityStart"
    | "bugReportsPage"
    | "feedbackSearch"
    | "featureSuggestionsPage"
  >
}) {
  return getAdminDashboardFeedbackWithClient({
    filters,
    isAdmin: true,
    store: getPrisma() as unknown as AdminDashboardStore,
  })
}

export async function getAdminDashboardAiUsage({
  filters,
}: {
  filters: AdminActivityRange
}) {
  const keyParts = [
    "admin-dashboard-ai-usage-v1",
    filters.activityStart.toISOString(),
    filters.activityEnd.toISOString(),
  ]

  return unstable_cache(
    () =>
      getAdminDashboardAiUsageWithClient({
        filters,
        isAdmin: true,
        store: getPrisma() as unknown as AdminDashboardStore,
      }),
    keyParts,
    {
      revalidate: 60,
      tags: [ADMIN_DASHBOARD_AI_USAGE_CACHE_TAG],
    },
  )()
}

export async function getAdminDashboardPersistedFailures({
  filters,
}: {
  filters: AdminActivityRange
}) {
  return getAdminDashboardPersistedFailuresWithClient({
    filters,
    isAdmin: true,
    store: getPrisma() as unknown as AdminDashboardStore,
  })
}

export async function getAdminDashboard({ isAdmin }: { isAdmin: boolean }) {
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
    Date.UTC(generatedAt.getUTCFullYear(), generatedAt.getUTCMonth(), 1),
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
    bugReports,
    featureSuggestions,
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
        aiUsagePeriods: {
          select: {
            consumedUnits: true,
            reservedUnits: true,
          },
          where: {
            periodStart: monthStart,
          },
        },
        createdAt: true,
        disabledAt: true,
        email: true,
        id: true,
        lastLoginAt: true,
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
    store.bugReport.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        contactEmail: true,
        createdAt: true,
        description: true,
        id: true,
        pageUrl: true,
        status: true,
        title: true,
        userAgent: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 50,
    }),
    store.featureSuggestion.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        contactEmail: true,
        createdAt: true,
        description: true,
        id: true,
        pageUrl: true,
        status: true,
        title: true,
        userAgent: true,
        user: {
          select: {
            email: true,
          },
        },
      },
      take: 50,
    }),
  ])

  const persistedFailures = [
    ...failedDigests.map((digest) => ({
      id: digest.id,
      message: boundedMessage(
        digest.errorMessage,
        "AI digest processing failed.",
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
    .sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
    )
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
        }),
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
    bugReports: bugReports.map((report) => ({
      contactEmail: report.contactEmail,
      createdAt: report.createdAt,
      description: boundedMessage(report.description, "No details provided."),
      id: report.id,
      pageUrl: report.pageUrl,
      status: report.status,
      title: boundedMessage(report.title, "Untitled report"),
      userAgent: report.userAgent,
      userEmail: report.user?.email ?? report.contactEmail ?? "Unknown reader",
    })),
    featureSuggestions: featureSuggestions.map((suggestion) => ({
      contactEmail: suggestion.contactEmail,
      createdAt: suggestion.createdAt,
      description: boundedMessage(
        suggestion.description,
        "No details provided.",
      ),
      id: suggestion.id,
      pageUrl: suggestion.pageUrl,
      status: suggestion.status,
      title: boundedMessage(suggestion.title, "Untitled suggestion"),
      userAgent: suggestion.userAgent,
      userEmail:
        suggestion.user?.email ?? suggestion.contactEmail ?? "Unknown reader",
    })),
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
      aiMonthlyUsed:
        (user.aiUsagePeriods[0]?.consumedUnits ?? 0) +
        (user.aiUsagePeriods[0]?.reservedUnits ?? 0),
      createdAt: user.createdAt,
      disabledAt: user.disabledAt,
      email: user.email,
      id: user.id,
      lastLoginAt: user.lastLoginAt,
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

const getCachedAdminDashboardOverview = unstable_cache(
  () =>
    getAdminDashboardOverviewWithClient({
      isAdmin: true,
      store: getPrisma() as unknown as AdminDashboardStore,
    }),
  ["admin-dashboard-overview-v1"],
  {
    revalidate: 30,
    tags: [ADMIN_DASHBOARD_OVERVIEW_CACHE_TAG],
  },
)

const getCachedAdminDashboardFeedHealth = unstable_cache(
  () =>
    getAdminDashboardFeedHealthCountsWithClient({
      isAdmin: true,
      store: getPrisma() as unknown as AdminDashboardStore,
    }),
  ["admin-dashboard-feed-health-v1"],
  {
    revalidate: 30,
    tags: [ADMIN_DASHBOARD_OVERVIEW_CACHE_TAG],
  },
)

export async function getAdminDashboardOverviewWithClient({
  isAdmin,
  now = () => new Date(),
  store,
}: {
  isAdmin: boolean
  now?: () => Date
  store: AdminDashboardStore
}): Promise<AdminDashboardOverview> {
  assertAdmin(isAdmin)

  const generatedAt = now()
  const [
    userCount,
    activeUserCount,
    feedCount,
    failingFeedCount,
    articleCount,
    activeSubscriptionCount,
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
  ])

  return {
    generatedAt,
    overview: {
      activeSubscriptionCount,
      activeUserCount,
      articleCount,
      failingFeedCount,
      feedCount,
      userCount,
    },
  }
}

export async function getAdminDashboardUsersWithClient({
  isAdmin,
  now = () => new Date(),
  page,
  store,
}: {
  isAdmin: boolean
  now?: () => Date
  page: number
  store: AdminDashboardStore
}) {
  assertAdmin(isAdmin)

  const currentPage = boundedPage(page)
  const monthStart = startOfUtcMonth(now())
  const rows = await store.user.findMany({
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
      aiUsagePeriods: {
        select: {
          consumedUnits: true,
          reservedUnits: true,
        },
        where: {
          periodStart: monthStart,
        },
      },
      createdAt: true,
      disabledAt: true,
      email: true,
      id: true,
      lastLoginAt: true,
      name: true,
      plan: true,
      role: true,
    },
    skip: (currentPage - 1) * ADMIN_DASHBOARD_PAGE_SIZE,
    take: ADMIN_DASHBOARD_PAGE_SIZE + 1,
  })

  const result = paginate(
    rows.map((user) => ({
      aiMonthlyLimit: user.aiMonthlyLimit,
      aiMonthlyUsed:
        (user.aiUsagePeriods[0]?.consumedUnits ?? 0) +
        (user.aiUsagePeriods[0]?.reservedUnits ?? 0),
      createdAt: user.createdAt,
      disabledAt: user.disabledAt,
      email: user.email,
      id: user.id,
      lastLoginAt: user.lastLoginAt,
      name: user.name,
      plan: user.plan,
      role: user.role,
      subscriptionCount: user._count.subscriptions,
    })),
    currentPage,
  )

  return {
    pagination: result.pagination,
    users: result.items,
  }
}

export async function getAdminDashboardFeedHealthCountsWithClient({
  isAdmin,
  now = () => new Date(),
  store,
}: {
  isAdmin: boolean
  now?: () => Date
  store: AdminDashboardStore
}): Promise<AdminDashboardFeedHealth> {
  assertAdmin(isAdmin)

  const staleBefore = new Date(now().getTime() - 24 * 60 * 60 * 1_000)
  const [failingCount, staleCount] = await Promise.all([
    store.feed.count({
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
  ])

  return {
    failingCount,
    staleCount,
  }
}

export async function getAdminDashboardFailingFeedsWithClient({
  isAdmin,
  page,
  store,
}: {
  isAdmin: boolean
  page: number
  store: AdminDashboardStore
}) {
  assertAdmin(isAdmin)

  const currentPage = boundedPage(page)
  const rows = await store.feed.findMany({
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
    skip: (currentPage - 1) * ADMIN_DASHBOARD_PAGE_SIZE,
    take: ADMIN_DASHBOARD_PAGE_SIZE + 1,
    where: {
      lastError: {
        not: null,
      },
    },
  })

  const result = paginate(
    rows.map((feed) => ({
      feedUrl: feed.feedUrl,
      id: feed.id,
      lastError: boundedMessage(feed.lastError, "Feed refresh failed."),
      lastFailedAt: feed.lastFailedAt,
      lastSuccessfulFetchAt: feed.lastSuccessfulFetchAt,
      subscriberCount: feed._count.subscriptions,
      title: feed.title,
    })),
    currentPage,
  )

  return {
    failingFeeds: result.items,
    pagination: result.pagination,
  }
}

export async function getAdminDashboardFeedbackWithClient({
  filters,
  isAdmin,
  store,
}: {
  filters: Pick<
    AdminDashboardFilters,
    | "activityEnd"
    | "activityStart"
    | "bugReportsPage"
    | "feedbackSearch"
    | "featureSuggestionsPage"
  >
  isAdmin: boolean
  store: AdminDashboardStore
}) {
  assertAdmin(isAdmin)

  const bugReportsPage = boundedPage(filters.bugReportsPage)
  const featureSuggestionsPage = boundedPage(filters.featureSuggestionsPage)
  const where = feedbackWhere(filters)
  const [bugReports, featureSuggestions] = await Promise.all([
    store.bugReport.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: feedbackSelection(),
      skip: (bugReportsPage - 1) * ADMIN_DASHBOARD_PAGE_SIZE,
      take: ADMIN_DASHBOARD_PAGE_SIZE + 1,
      where,
    }),
    store.featureSuggestion.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: feedbackSelection(),
      skip: (featureSuggestionsPage - 1) * ADMIN_DASHBOARD_PAGE_SIZE,
      take: ADMIN_DASHBOARD_PAGE_SIZE + 1,
      where,
    }),
  ])

  return {
    bugReports: paginate(
      bugReports.map(mapFeedbackRecord),
      bugReportsPage,
    ),
    featureSuggestions: paginate(
      featureSuggestions.map(mapFeedbackRecord),
      featureSuggestionsPage,
    ),
  }
}

export async function getAdminDashboardAiUsageWithClient({
  filters,
  isAdmin,
  store,
}: {
  filters: AdminActivityRange
  isAdmin: boolean
  store: AdminDashboardStore
}) {
  assertAdmin(isAdmin)

  const aggregate = {
    _count: {
      _all: true,
    },
    _sum: {
      costEstimate: true,
      inputTokens: true,
      outputTokens: true,
    },
  }
  const where = {
    createdAt: dateRangeWhere(filters),
  }
  const [usage, byAction, byProviderModel, recent] = await Promise.all([
    store.aiUsageLog.aggregate({ ...aggregate, where }),
    store.aiUsageLog.groupBy({
      ...aggregate,
      by: ["action"],
      orderBy: {
        action: "asc",
      },
      where,
    }),
    store.aiUsageLog.groupBy({
      ...aggregate,
      by: ["provider", "model"],
      orderBy: [{ provider: "asc" }, { model: "asc" }],
      where,
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
      where,
    }),
  ])

  return {
    byAction: (byAction as AiActionGroup[]).map((group) => ({
      action: group.action,
      costEstimate: finiteNumber(group._sum.costEstimate),
      inputTokens: group._sum.inputTokens ?? 0,
      outputTokens: group._sum.outputTokens ?? 0,
      requestCount: group._count._all,
    })),
    byProviderModel: (byProviderModel as AiProviderGroup[]).map((group) => ({
      costEstimate: finiteNumber(group._sum.costEstimate),
      inputTokens: group._sum.inputTokens ?? 0,
      model: group.model,
      outputTokens: group._sum.outputTokens ?? 0,
      provider: group.provider,
      requestCount: group._count._all,
    })),
    costEstimate: finiteNumber(usage._sum.costEstimate),
    inputTokens: usage._sum.inputTokens ?? 0,
    rangeEnd: filters.activityEnd,
    rangeStart: filters.activityStart,
    outputTokens: usage._sum.outputTokens ?? 0,
    recent: recent.map((item) => ({
      action: item.action,
      costEstimate: finiteNumber(item.costEstimate),
      createdAt: item.createdAt,
      id: item.id,
      inputTokens: item.inputTokens,
      model: item.model,
      outputTokens: item.outputTokens,
      provider: item.provider,
      userEmail: item.user.email,
    })),
    requestCount: usage._count._all,
  }
}

export async function getAdminDashboardPersistedFailuresWithClient({
  filters,
  isAdmin,
  store,
}: {
  filters: AdminActivityRange
  isAdmin: boolean
  store: AdminDashboardStore
}) {
  assertAdmin(isAdmin)

  const updatedAt = dateRangeWhere(filters)
  const [failedDigests, failedImports] = await Promise.all([
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
        updatedAt,
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
        updatedAt,
      },
    }),
  ])

  return [
    ...failedDigests.map((digest) => ({
      id: digest.id,
      message: boundedMessage(digest.errorMessage, "AI digest processing failed."),
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
    .sort(
      (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime(),
    )
    .slice(0, 25)
}

function assertAdmin(isAdmin: boolean) {
  if (!isAdmin) {
    throw new AdminDashboardError("Administrator access is required.")
  }
}

function dateRangeWhere({
  activityEnd,
  activityStart,
}: AdminActivityRange) {
  return {
    gte: activityStart,
    lt: activityEnd,
  }
}

function feedbackWhere(
  filters: Pick<
    AdminDashboardFilters,
    "activityEnd" | "activityStart" | "feedbackSearch"
  >,
) {
  const createdAt = dateRangeWhere(filters)

  if (!filters.feedbackSearch) {
    return { createdAt }
  }

  const contains = {
    contains: filters.feedbackSearch,
    mode: "insensitive" as const,
  }

  return {
    OR: [
      { title: contains },
      { description: contains },
      { contactEmail: contains },
      { pageUrl: contains },
      { userAgent: contains },
      {
        user: {
          is: {
            email: contains,
          },
        },
      },
    ],
    createdAt,
  }
}

function feedbackSelection() {
  return {
    contactEmail: true,
    createdAt: true,
    description: true,
    id: true,
    pageUrl: true,
    status: true,
    title: true,
    userAgent: true,
    user: {
      select: {
        email: true,
      },
    },
  }
}

function mapFeedbackRecord(record: BugReportRecord | FeatureSuggestionRecord) {
  return {
    contactEmail: record.contactEmail,
    createdAt: record.createdAt,
    description: boundedMessage(record.description, "No details provided."),
    id: record.id,
    pageUrl: record.pageUrl,
    status: record.status,
    title: boundedMessage(record.title, "Untitled report"),
    userAgent: record.userAgent,
    userEmail: record.user?.email ?? record.contactEmail ?? "Unknown reader",
  }
}

function paginate<T>(rows: T[], page: number) {
  const hasNextPage = rows.length > ADMIN_DASHBOARD_PAGE_SIZE

  return {
    items: rows.slice(0, ADMIN_DASHBOARD_PAGE_SIZE),
    pagination: {
      hasNextPage,
      page,
      pageSize: ADMIN_DASHBOARD_PAGE_SIZE,
    },
  }
}

function boundedPage(value: number) {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, ADMIN_DASHBOARD_MAX_PAGE)
    : 1
}

function parsePage(value: string | string[] | undefined) {
  const parsed = Number(firstValue(value))

  return boundedPage(parsed)
}

function parseFeedbackSearch(value: string | string[] | undefined) {
  return (firstValue(value) ?? "")
    .trim()
    .slice(0, ADMIN_DASHBOARD_MAX_FEEDBACK_SEARCH_LENGTH)
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function parseUtcDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [year, month, day] = value.split("-").map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))

  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? parsed
    : null
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10)
}

function startOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1))
}
