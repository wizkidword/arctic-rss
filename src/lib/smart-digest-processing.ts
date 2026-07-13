import type { Prisma } from "../generated/prisma/client"

import { getPrisma } from "./db"
import { enqueueSmartDigestEmail } from "./smart-digest-email-queue"
import {
  scheduleNextSmartDigestRun,
  SmartDigestError,
  type SmartDigestSourceScope,
} from "./smart-digests"
import { matchSmartDigestArticle } from "./smart-digest-rules"

const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000
export const SMART_DIGEST_LATE_ARRIVAL_LOOKBACK_MS = 2 * 60 * 60 * 1000
export const SMART_DIGEST_PROCESSING_LEASE_MS = 10 * 60 * 1000

type SmartDigestStatusForProcessing = "COMPLETED" | "COMPLETED_NO_MATCHES"
type SmartDigestEmailStatusForProcessing = "NOT_REQUESTED" | "PENDING"
export type DigestRunStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

type SmartDigestRuleFindUniqueArgs = {
  include: {
    folders: true
    subscriptions: true
    user: {
      select: {
        email: true
        id: true
      }
    }
  }
  where: { id: string }
}

type SmartDigestArticleFindManyArgs = {
  include: { feed: true }
  orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
  take: 100
  where: Prisma.ArticleWhereInput
}

type SmartDigestCreateArgs = {
  data: {
    articleCount: number
    completedAt: Date
    emailStatus: SmartDigestEmailStatusForProcessing
    items: {
      create: SmartDigestItemCreateData[]
    }
    ruleId: string
    startedAt: Date
    status: SmartDigestStatusForProcessing
    title: string
    topicPrompt: string
    userId: string
  }
  include: { items: true }
}

type SmartDigestRuleUpdateArgs = {
  data: {
    contentWatermarkAt: Date
    lastMatchedAt?: Date
    lastRunAt: Date
    nextRunAt: Date
  }
  where: { id: string }
}

export type DigestRunRecord = {
  completedAt: Date | null
  digestId: string | null
  emailStatus: string | null
  id: string
  processingStartedAt: Date | null
  ruleId: string
  scheduledFor: Date
  status: DigestRunStatus
}

export type SmartDigestRuleForProcessing = {
  contentWatermarkAt: Date | null
  emailEnabled: boolean
  excludeTerms: string[]
  folders: Array<{
    folderId: string
  }>
  id: string
  includeTerms: string[]
  isEnabled: boolean
  lastMatchedAt: Date | null
  lastRunAt: Date | null
  name: string
  scheduledHour: number
  sourceScope: SmartDigestSourceScope
  subscriptions: Array<{
    subscriptionId: string
  }>
  timeZone: string
  topicPrompt: string
  user: {
    email: string
    id: string
  } | null
  userId: string
}

type SmartDigestCandidateArticle = {
  contentText: string | null
  createdAt: Date
  feed: {
    title: string
  }
  feedId: string
  id: string
  publishedAt: Date | null
  summary: string | null
  title: string
  url: string
}

type SmartDigestItemCreateData = {
  articleId: string
  articleTitle: string
  articleUrl: string
  feedTitle: string
  matchedFields: string[]
  matchedTerms: string[]
  position: number
  publishedAt: Date | null
  reason: string
  summary: string
}

export type SmartDigestEmailItem = Pick<
  SmartDigestItemCreateData,
  | "articleTitle"
  | "articleUrl"
  | "feedTitle"
  | "matchedTerms"
  | "position"
  | "publishedAt"
  | "reason"
  | "summary"
>

export type SmartDigestForEmail = {
  articleCount: number
  id: string
  items: SmartDigestEmailItem[]
  title: string
  topicPrompt: string
}

export type EnqueueSmartDigestEmail = (runId: string) => Promise<unknown>

export type SmartDigestProcessingStore = {
  $transaction<T>(
    callback: (transaction: SmartDigestProcessingStore) => Promise<T>
  ): Promise<T>
  article: {
    findMany(args: SmartDigestArticleFindManyArgs): Promise<SmartDigestCandidateArticle[]>
  }
  digestRun: {
    findUnique(args: { where: { id: string } }): Promise<DigestRunRecord | null>
    update(args: {
      data: Record<string, unknown>
      where: { id: string }
    }): Promise<DigestRunRecord>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
    upsert(args: {
      create: {
        emailStatus: string
        ruleId: string
        scheduledFor: Date
        status: DigestRunStatus
      }
      update: Record<string, never>
      where: {
        ruleId_scheduledFor: {
          ruleId: string
          scheduledFor: Date
        }
      }
    }): Promise<DigestRunRecord>
  }
  smartDigest: {
    create(args: SmartDigestCreateArgs): Promise<SmartDigestForEmail>
  }
  smartDigestRule: {
    findUnique(
      args: SmartDigestRuleFindUniqueArgs
    ): Promise<SmartDigestRuleForProcessing | null>
    update(args: SmartDigestRuleUpdateArgs): Promise<SmartDigestRuleForProcessing | null>
  }
}

export type SmartDigestProcessingResult = {
  articleCount: number
  digestId: string | null
  status: "COMPLETED" | "COMPLETED_NO_MATCHES" | "SKIPPED"
}

/**
 * Generates exactly one durable digest per rule and scheduled instant. Email
 * delivery is deliberately queued after the database transaction commits.
 */
export async function processSmartDigestRule({
  ruleId,
  scheduledFor,
}: {
  ruleId: string
  scheduledFor: string
}): Promise<SmartDigestProcessingResult> {
  return processSmartDigestRuleWithClient({
    enqueueEmail: enqueueSmartDigestEmail,
    now: new Date(),
    ruleId,
    scheduledFor: new Date(scheduledFor),
    store: getPrisma() as unknown as SmartDigestProcessingStore,
  })
}

export async function processSmartDigestRuleWithClient({
  enqueueEmail,
  now,
  ruleId,
  scheduledFor,
  store,
}: {
  enqueueEmail: EnqueueSmartDigestEmail
  now: Date
  ruleId: string
  scheduledFor: Date
  store: SmartDigestProcessingStore
}): Promise<SmartDigestProcessingResult> {
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new SmartDigestError("Smart Digest run has an invalid scheduled time.")
  }

  const run = await store.digestRun.upsert({
    create: {
      emailStatus: "NOT_REQUESTED",
      ruleId,
      scheduledFor,
      status: "PENDING",
    },
    update: {},
    where: {
      ruleId_scheduledFor: {
        ruleId,
        scheduledFor,
      },
    },
  })
  const claimed = await store.digestRun.updateMany({
    data: {
      errorMessage: null,
      processingStartedAt: now,
      status: "PROCESSING",
    },
    where: {
      id: run.id,
      OR: [
        { status: "PENDING" },
        { status: "FAILED" },
        {
          processingStartedAt: {
            lt: new Date(now.getTime() - SMART_DIGEST_PROCESSING_LEASE_MS),
          },
          status: "PROCESSING",
        },
      ],
    },
  })

  if (claimed.count === 0) {
    await enqueuePendingEmail(run, enqueueEmail)
    return skippedRunResult(run)
  }

  const claimedRun = await store.digestRun.findUnique({
    where: { id: run.id },
  })

  if (!claimedRun) {
    throw new SmartDigestError("Smart Digest run not found after it was claimed.")
  }

  // A worker may have died immediately after committing its digest. The run is
  // recovered by marking that existing digest complete rather than creating a
  // second one.
  if (claimedRun.digestId) {
    await store.digestRun.update({
      data: {
        completedAt: now,
        processingStartedAt: null,
        status: "COMPLETED",
      },
      where: { id: claimedRun.id },
    })
    await enqueuePendingEmail(claimedRun, enqueueEmail)
    return skippedRunResult(claimedRun)
  }

  const rule = await store.smartDigestRule.findUnique({
    include: {
      folders: true,
      subscriptions: true,
      user: {
        select: {
          email: true,
          id: true,
        },
      },
    },
    where: { id: ruleId },
  })

  if (!rule?.user || !rule.isEnabled) {
    await failDigestRun({
      message: "Smart Digest rule not found or disabled.",
      runId: claimedRun.id,
      store,
    })
    throw new SmartDigestError("Smart Digest rule not found.")
  }

  const watermarkFrom = digestWatermarkFrom(rule, now)
  const nextRunAt = scheduleNextSmartDigestRun({
    from: now,
    scheduledHour: rule.scheduledHour,
    timeZone: rule.timeZone,
  })

  try {
    const candidates = await store.article.findMany({
      include: { feed: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      where: {
        AND: [
          smartDigestCandidateWhere(rule),
          smartDigestWindowWhere({
            ruleId: rule.id,
            watermarkFrom,
            watermarkTo: now,
          }),
        ],
      },
    })
    const items = matchingDigestItems({
      articles: candidates,
      rule,
    }).slice(0, 50)
    const status: SmartDigestStatusForProcessing = items.length
      ? "COMPLETED"
      : "COMPLETED_NO_MATCHES"
    const emailStatus: SmartDigestEmailStatusForProcessing =
      rule.emailEnabled && items.length ? "PENDING" : "NOT_REQUESTED"

    const digest = await store.$transaction(async (transaction) => {
      const createdDigest = await transaction.smartDigest.create({
        data: {
          articleCount: items.length,
          completedAt: now,
          emailStatus,
          items: {
            create: items,
          },
          ruleId: rule.id,
          startedAt: now,
          status,
          title: rule.name,
          topicPrompt: rule.topicPrompt,
          userId: rule.userId,
        },
        include: { items: true },
      })

      await transaction.smartDigestRule.update({
        data: {
          contentWatermarkAt: now,
          ...(items.length ? { lastMatchedAt: now } : {}),
          lastRunAt: now,
          nextRunAt,
        },
        where: { id: rule.id },
      })
      await transaction.digestRun.update({
        data: {
          completedAt: now,
          digestId: createdDigest.id,
          emailStatus,
          processingStartedAt: null,
          status: "COMPLETED",
          watermarkFrom,
          watermarkTo: now,
        },
        where: { id: claimedRun.id },
      })

      return createdDigest
    })

    if (emailStatus === "PENDING") {
      await enqueueEmail(claimedRun.id)
    }

    return {
      articleCount: digest.articleCount,
      digestId: digest.id,
      status,
    }
  } catch (error) {
    await failDigestRun({
      message: safeErrorMessage(error),
      runId: claimedRun.id,
      store,
    })
    throw error
  }
}

export function smartDigestCandidateWhere(
  rule: Pick<
    SmartDigestRuleForProcessing,
    "folders" | "sourceScope" | "subscriptions" | "userId"
  >
): Prisma.ArticleWhereInput {
  if (rule.sourceScope === "FOLDERS") {
    return {
      feed: {
        subscriptions: {
          some: {
            folderId: {
              in: rule.folders.map((folder) => folder.folderId),
            },
            isPaused: false,
            userId: rule.userId,
          },
        },
      },
    }
  }

  if (rule.sourceScope === "FEEDS") {
    return {
      feed: {
        subscriptions: {
          some: {
            id: {
              in: rule.subscriptions.map(
                (subscription) => subscription.subscriptionId
              ),
            },
            isPaused: false,
            userId: rule.userId,
          },
        },
      },
    }
  }

  return {
    feed: {
      subscriptions: {
        some: {
          isPaused: false,
          userId: rule.userId,
        },
      },
    },
  }
}

/** Keeps a small late-arrival window without repeating an article for a rule. */
export function smartDigestWindowWhere({
  ruleId,
  watermarkFrom,
  watermarkTo,
}: {
  ruleId: string
  watermarkFrom: Date
  watermarkTo: Date
}): Prisma.ArticleWhereInput {
  return {
    AND: [
      {
        OR: [
          {
            publishedAt: {
              gte: watermarkFrom,
              lte: watermarkTo,
            },
          },
          {
            createdAt: {
              gte: watermarkFrom,
              lte: watermarkTo,
            },
          },
        ],
      },
      {
        smartDigestItems: {
          none: {
            digest: {
              ruleId,
            },
          },
        },
      },
    ],
  }
}

export function digestWatermarkFrom(
  rule: Pick<SmartDigestRuleForProcessing, "contentWatermarkAt" | "lastRunAt">,
  now: Date
) {
  const watermark =
    rule.contentWatermarkAt ??
    rule.lastRunAt ??
    new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS)

  return new Date(watermark.getTime() - SMART_DIGEST_LATE_ARRIVAL_LOOKBACK_MS)
}

function matchingDigestItems({
  articles,
  rule,
}: {
  articles: SmartDigestCandidateArticle[]
  rule: SmartDigestRuleForProcessing
}): SmartDigestItemCreateData[] {
  const items: SmartDigestItemCreateData[] = []

  for (const article of articles) {
    const match = matchSmartDigestArticle({
      article: {
        contentText: article.contentText,
        feedTitle: article.feed.title,
        summary: article.summary,
        title: article.title,
      },
      excludeTerms: rule.excludeTerms,
      includeTerms: rule.includeTerms,
    })

    if (!match.matched) {
      continue
    }

    items.push({
      articleId: article.id,
      articleTitle: article.title,
      articleUrl: article.url,
      feedTitle: article.feed.title,
      matchedFields: match.matchedFields,
      matchedTerms: match.matchedTerms,
      position: items.length + 1,
      publishedAt: article.publishedAt,
      reason: match.reason,
      summary: compactArticleSummary(article),
    })
  }

  return items
}

async function enqueuePendingEmail(
  run: DigestRunRecord,
  enqueueEmail: EnqueueSmartDigestEmail
) {
  if (run.digestId && run.emailStatus === "PENDING") {
    await enqueueEmail(run.id)
  }
}

function skippedRunResult(run: DigestRunRecord): SmartDigestProcessingResult {
  return {
    articleCount: 0,
    digestId: run.digestId,
    status: "SKIPPED",
  }
}

async function failDigestRun({
  message,
  runId,
  store,
}: {
  message: string
  runId: string
  store: SmartDigestProcessingStore
}) {
  await store.digestRun.update({
    data: {
      errorMessage: message,
      processingStartedAt: null,
      status: "FAILED",
    },
    where: { id: runId },
  })
}

function compactArticleSummary(article: SmartDigestCandidateArticle) {
  const source = compactWhitespace(
    article.summary || article.contentText || article.title
  )
  const fallback = compactWhitespace(article.title)
  const summary = source || fallback

  if (summary.length <= 240) {
    return summary
  }

  return `${summary.slice(0, 237).trimEnd()}...`
}

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Smart Digest processing failed."
}
