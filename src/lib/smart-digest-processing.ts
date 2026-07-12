import type { Prisma } from "../generated/prisma/client"

import { getPrisma } from "./db"
import {
  scheduleNextSmartDigestRun,
  SmartDigestError,
  type SmartDigestSourceScope,
} from "./smart-digests"
import { matchSmartDigestArticle } from "./smart-digest-rules"

type SmartDigestStatusForProcessing = "COMPLETED" | "COMPLETED_NO_MATCHES"
type SmartDigestEmailStatusForProcessing =
  | "FAILED"
  | "NOT_REQUESTED"
  | "PENDING"
  | "SENT"

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
    lastMatchedAt?: Date
    lastRunAt: Date
    nextRunAt: Date
  }
  where: { id: string }
}

type SmartDigestUpdateArgs = {
  data:
    | {
        emailedAt: Date
        emailStatus: "SENT"
      }
    | {
        emailErrorMessage: string
        emailStatus: "FAILED"
      }
  where: { id: string }
}

export type SmartDigestRuleForProcessing = {
  emailEnabled: boolean
  excludeTerms: string[]
  folders: Array<{
    folderId: string
  }>
  id: string
  includeTerms: string[]
  isEnabled: boolean
  lastMatchedAt: Date | null
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

export type SendSmartDigestEmail = ({
  digest,
  to,
}: {
  digest: SmartDigestForEmail
  to: string
}) => Promise<unknown>

export type SmartDigestProcessingStore = {
  article: {
    findMany(args: SmartDigestArticleFindManyArgs): Promise<SmartDigestCandidateArticle[]>
  }
  smartDigest: {
    create(args: SmartDigestCreateArgs): Promise<SmartDigestForEmail>
    update(args: SmartDigestUpdateArgs): Promise<SmartDigestForEmail>
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
  digestId: string
  status: SmartDigestStatusForProcessing
}

export async function processSmartDigestRule({
  ruleId,
  sendDigestEmail = noopSmartDigestEmailSender,
}: {
  ruleId: string
  sendDigestEmail?: SendSmartDigestEmail
}): Promise<SmartDigestProcessingResult> {
  return processSmartDigestRuleWithClient({
    now: new Date(),
    ruleId,
    sendDigestEmail,
    store: getPrisma() as unknown as SmartDigestProcessingStore,
  })
}

export async function processSmartDigestRuleWithClient({
  now,
  ruleId,
  sendDigestEmail,
  store,
}: {
  now: Date
  ruleId: string
  sendDigestEmail: SendSmartDigestEmail
  store: SmartDigestProcessingStore
}): Promise<SmartDigestProcessingResult> {
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
    throw new SmartDigestError("Smart Digest rule not found.")
  }

  const nextRunAt = scheduleNextSmartDigestRun({
    from: now,
    scheduledHour: rule.scheduledHour,
    timeZone: rule.timeZone,
  })
  const candidates = await store.article.findMany({
    include: { feed: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    where: smartDigestCandidateWhere(rule),
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
  // Not fully idempotent across post-create failures yet; worker retry policy
  // should account for duplicate digest risk before production hardening.
  const digest = await store.smartDigest.create({
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

  await store.smartDigestRule.update({
    data: {
      ...(items.length ? { lastMatchedAt: now } : {}),
      lastRunAt: now,
      nextRunAt,
    },
    where: { id: rule.id },
  })

  if (rule.emailEnabled && items.length) {
    try {
      await sendDigestEmail({ digest: orderedDigestForEmail(digest), to: rule.user.email })
      await store.smartDigest.update({
        data: {
          emailedAt: now,
          emailStatus: "SENT",
        },
        where: { id: digest.id },
      })
    } catch {
      // Email delivery failures are recorded on the digest and do not retry the
      // generation job; a later resend flow can retry email delivery.
      await store.smartDigest.update({
        data: {
          emailErrorMessage: "Smart Digest email delivery failed.",
          emailStatus: "FAILED",
        },
        where: { id: digest.id },
      })
    }
  }

  return {
    articleCount: items.length,
    digestId: digest.id,
    status,
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

function orderedDigestForEmail(digest: SmartDigestForEmail): SmartDigestForEmail {
  return {
    ...digest,
    items: [...digest.items].sort((first, second) => first.position - second.position),
  }
}

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

// TODO(Task 5): replace with the real Smart Digest mail integration.
async function noopSmartDigestEmailSender() {}
