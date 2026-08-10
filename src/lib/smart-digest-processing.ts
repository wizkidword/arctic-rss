import type { Prisma } from "../generated/prisma/client"

import {
  getBackgroundEligibility,
  type BackgroundEligibilityStore,
} from "./background-eligibility"
import { getPrisma } from "./db"
import { enqueueSmartDigestEmail } from "./smart-digest-email-queue"
import {
  claimSmartDigestRun,
  runWithSmartDigestRunLeaseHeartbeat,
  smartDigestRunLeaseWhere,
  type SmartDigestRunLease,
  SMART_DIGEST_PROCESSING_LEASE_MS,
} from "./smart-digest-run-leases"
import {
  scheduleNextSmartDigestRun,
  SmartDigestError,
  type SmartDigestSourceScope,
} from "./smart-digests"
import { matchSmartDigestArticle } from "./smart-digest-rules"

const FIRST_RUN_LOOKBACK_MS = 24 * 60 * 60 * 1000
export const SMART_DIGEST_LATE_ARRIVAL_LOOKBACK_MS = 2 * 60 * 60 * 1000
export { SMART_DIGEST_PROCESSING_LEASE_MS }

type SmartDigestStatusForProcessing = "COMPLETED" | "COMPLETED_NO_MATCHES"
type SmartDigestEmailStatusForProcessing = "NOT_REQUESTED" | "PENDING"
export type DigestRunStatus =
  "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELED"

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
    runId: string
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
  attempt: number
  completedAt: Date | null
  digestId: string | null
  emailStatus: string | null
  id: string
  lastHeartbeatAt: Date | null
  leaseExpiresAt: Date | null
  leaseOwner: string | null
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
    callback: (transaction: SmartDigestProcessingStore) => Promise<T>,
  ): Promise<T>
  article: {
    findMany(
      args: SmartDigestArticleFindManyArgs,
    ): Promise<SmartDigestCandidateArticle[]>
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
    upsert(args: {
      create: SmartDigestCreateArgs["data"]
      include: SmartDigestCreateArgs["include"]
      update: Record<string, never>
      where: { runId: string }
    }): Promise<SmartDigestForEmail>
  }
  smartDigestRule: {
    findUnique(
      args: SmartDigestRuleFindUniqueArgs,
    ): Promise<SmartDigestRuleForProcessing | null>
    update(
      args: SmartDigestRuleUpdateArgs,
    ): Promise<SmartDigestRuleForProcessing | null>
  }
} & BackgroundEligibilityStore

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
    leaseNow: () => new Date(),
    now: new Date(),
    ruleId,
    scheduledFor: new Date(scheduledFor),
    store: getPrisma() as unknown as SmartDigestProcessingStore,
  })
}

export async function processSmartDigestRuleWithClient({
  enqueueEmail,
  leaseNow = () => now,
  now,
  ruleId,
  scheduledFor,
  store,
}: {
  enqueueEmail: EnqueueSmartDigestEmail
  leaseNow?: () => Date
  now: Date
  ruleId: string
  scheduledFor: Date
  store: SmartDigestProcessingStore
}): Promise<SmartDigestProcessingResult> {
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new SmartDigestError(
      "Smart Digest run has an invalid scheduled time.",
    )
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
    return skippedResult()
  }

  const eligibility = await getBackgroundEligibility({
    store,
    userId: rule.userId,
  })
  if (!eligibility.active || !eligibility.aiAllowed) {
    return skippedResult()
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
  const lease = await claimSmartDigestRun({
    now: leaseNow(),
    runId: run.id,
    store,
  })

  if (!lease) {
    await enqueuePendingEmail(run, enqueueEmail)
    return skippedRunResult(run)
  }

  const claimedRun = await store.digestRun.findUnique({
    where: { id: run.id },
  })

  if (!claimedRun) {
    throw new SmartDigestError(
      "Smart Digest run not found after it was claimed.",
    )
  }

  // A worker may have died immediately after committing its digest. The run is
  // recovered by marking that existing digest complete rather than creating a
  // second one.
  if (claimedRun.digestId) {
    const recovered = await store.digestRun.updateMany({
      data: {
        completedAt: now,
        lastHeartbeatAt: now,
        leaseExpiresAt: null,
        leaseOwner: null,
        processingStartedAt: null,
        status: "COMPLETED",
      },
      where: smartDigestRunLeaseWhere(lease, leaseNow()),
    })
    if (recovered.count === 0) {
      return skippedRunResult(claimedRun)
    }
    await enqueuePendingEmail(claimedRun, enqueueEmail)
    return skippedRunResult(claimedRun)
  }

  const watermarkFrom = digestWatermarkFrom(rule, now)
  const nextRunAt = scheduleNextSmartDigestRun({
    from: now,
    scheduledHour: rule.scheduledHour,
    timeZone: rule.timeZone,
  })

  try {
    const candidateWork = await runWithSmartDigestRunLeaseHeartbeat({
      lease,
      now: leaseNow,
      store,
      work: () =>
        store.article.findMany({
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
        }),
    })
    if (!candidateWork.leaseHeld) {
      return skippedRunResult(claimedRun)
    }
    const candidates = candidateWork.result
    const items = matchingDigestItems({
      articles: candidates,
      rule,
    }).slice(0, 50)
    const status: SmartDigestStatusForProcessing = items.length
      ? "COMPLETED"
      : "COMPLETED_NO_MATCHES"
    const emailStatus: SmartDigestEmailStatusForProcessing =
      rule.emailEnabled && items.length ? "PENDING" : "NOT_REQUESTED"

    const currentEligibility = await getBackgroundEligibility({
      store,
      userId: rule.userId,
    })
    if (!currentEligibility.active || !currentEligibility.aiAllowed) {
      await failDigestRun({
        lease,
        message:
          "Smart Digest owner is no longer eligible for background work.",
        now: leaseNow(),
        store,
      })
      return skippedRunResult(claimedRun)
    }

    const digest = await store.$transaction(async (transaction) => {
      const renewedAt = leaseNow()
      const renewed = await transaction.digestRun.updateMany({
        data: {
          lastHeartbeatAt: renewedAt,
          leaseExpiresAt: new Date(
            renewedAt.getTime() + SMART_DIGEST_PROCESSING_LEASE_MS,
          ),
        },
        where: smartDigestRunLeaseWhere(lease, renewedAt),
      })
      if (renewed.count === 0) {
        return null
      }

      const createdDigest = await transaction.smartDigest.upsert({
        create: {
          articleCount: items.length,
          completedAt: now,
          emailStatus,
          items: {
            create: items,
          },
          ruleId: rule.id,
          runId: claimedRun.id,
          startedAt: now,
          status,
          title: rule.name,
          topicPrompt: rule.topicPrompt,
          userId: rule.userId,
        },
        include: { items: true },
        update: {},
        where: { runId: claimedRun.id },
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
      const completed = await transaction.digestRun.updateMany({
        data: {
          completedAt: now,
          digestId: createdDigest.id,
          emailStatus,
          lastHeartbeatAt: leaseNow(),
          leaseExpiresAt: null,
          leaseOwner: null,
          processingStartedAt: null,
          status: "COMPLETED",
          watermarkFrom,
          watermarkTo: now,
        },
        where: smartDigestRunLeaseWhere(lease, leaseNow()),
      })

      return completed.count === 1 ? createdDigest : null
    })

    if (!digest) {
      return skippedRunResult(claimedRun)
    }

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
      lease,
      message: safeErrorMessage(error),
      now: leaseNow(),
      store,
    })
    throw error
  }
}

export function smartDigestCandidateWhere(
  rule: Pick<
    SmartDigestRuleForProcessing,
    "folders" | "sourceScope" | "subscriptions" | "userId"
  >,
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
                (subscription) => subscription.subscriptionId,
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
  now: Date,
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
  enqueueEmail: EnqueueSmartDigestEmail,
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

function skippedResult(): SmartDigestProcessingResult {
  return {
    articleCount: 0,
    digestId: null,
    status: "SKIPPED",
  }
}

async function failDigestRun({
  lease,
  message,
  now,
  store,
}: {
  lease: SmartDigestRunLease
  message: string
  now: Date
  store: SmartDigestProcessingStore
}) {
  await store.digestRun.updateMany({
    data: {
      errorMessage: message,
      lastHeartbeatAt: now,
      leaseExpiresAt: null,
      leaseOwner: null,
      processingStartedAt: null,
      status: "FAILED",
    },
    where: smartDigestRunLeaseWhere(lease, now),
  })
}

function compactArticleSummary(article: SmartDigestCandidateArticle) {
  const source = compactWhitespace(
    article.summary || article.contentText || article.title,
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
  return error instanceof Error
    ? error.message
    : "Smart Digest processing failed."
}
