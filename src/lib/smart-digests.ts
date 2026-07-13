import type { Prisma } from "../generated/prisma/client"
import type { Plan } from "../generated/prisma/enums"

import { getPrisma } from "./db"
import { isSupportedTimeZone, type SupportedTimeZone } from "./settings"
import {
  isDatabaseSmartDigestLimitError,
  smartDigestEnabledLimitForPlan,
} from "./smart-digest-limits"
import { parseSmartDigestTerms } from "./smart-digest-rules"

export type SmartDigestSourceScope = "ALL_FEEDS" | "FOLDERS" | "FEEDS"

export type SmartDigestInput = {
  emailEnabled: boolean
  excludeTerms: string
  feedSubscriptionIds?: string[]
  folderIds?: string[]
  includeTerms: string
  name: string
  scheduledHour: number
  sourceScope: SmartDigestSourceScope
  timeZone: string
  topicPrompt: string
}

export type NormalizedSmartDigestInput = Omit<
  SmartDigestInput,
  "excludeTerms" | "feedSubscriptionIds" | "folderIds" | "includeTerms"
> & {
  excludeTerms: string[]
  feedSubscriptionIds: string[]
  folderIds: string[]
  includeTerms: string[]
  timeZone: SupportedTimeZone
}

type SmartDigestUserPlan = {
  _count: {
    smartDigestRules: number
  }
  plan: Plan
}

type SmartDigestUserFindUniqueArgs = {
  select: {
    _count: {
      select: {
        smartDigestRules: {
          where: {
            isEnabled: true
          }
        }
      }
    }
    plan: true
  }
  where: { id: string }
}

type SmartDigestFolderLookup = {
  id: string
}

type SmartDigestFolderLookupFindManyArgs = {
  select: { id: true }
  where: {
    id: { in: string[] }
    userId: string
  }
}

type SmartDigestSourceFolder = {
  id: string
  name: string
}

type SmartDigestSourceFolderFindManyArgs = {
  orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
  select: {
    id: true
    name: true
  }
  where: { userId: string }
}

type SmartDigestSubscriptionLookup = {
  id: string
}

type SmartDigestSubscriptionLookupFindManyArgs = {
  select: { id: true }
  where: {
    id: { in: string[] }
    isPaused: false
    userId: string
  }
}

type SmartDigestSourceSubscription = {
  id: string
  customTitle: string | null
  feed: {
    faviconUrl: string | null
    title: string
  }
  folder: {
    id: string
    name: string
  } | null
  folderId: string | null
}

type SmartDigestSourceSubscriptionFindManyArgs = {
  include: {
    feed: true
    folder: true
  }
  orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }]
  where: {
    isPaused: false
    userId: string
  }
}

type SmartDigestRuleCreateData = {
  cadence: "DAILY"
  emailEnabled: boolean
  excludeTerms: string[]
  folders: {
    create: Array<{
      folderId: string
      userId: string
    }>
  }
  includeTerms: string[]
  name: string
  nextRunAt: Date
  scheduledHour: number
  sourceScope: SmartDigestSourceScope
  subscriptions: {
    create: Array<{
      subscriptionId: string
      userId: string
    }>
  }
  timeZone: SupportedTimeZone
  topicPrompt: string
  userId: string
}

type SmartDigestRuleCreateArgs = {
  data: SmartDigestRuleCreateData
}

type SmartDigestRuleListInclude = {
  digests: true
  folders: {
    include: {
      folder: true
    }
  }
  subscriptions: {
    include: {
      subscription: {
        include: {
          feed: true
        }
      }
    }
  }
}

type SmartDigestRuleDetailInclude = Omit<SmartDigestRuleListInclude, "digests">

type SmartDigestDetailInclude = {
  items: true
  rule: {
    select: {
      id: true
      name: true
    }
  }
}

type SmartDigestRuleFindManyArgs = {
  include: {
    digests: {
      orderBy: { createdAt: "desc" }
      take: 1
    }
    folders: {
      include: {
        folder: true
      }
    }
    subscriptions: {
      include: {
        subscription: {
          include: {
            feed: true
          }
        }
      }
    }
  }
  orderBy: [{ isEnabled: "desc" }, { createdAt: "desc" }]
  where: { userId: string }
}

type SmartDigestRuleFindFirstArgs = {
  include: SmartDigestRuleDetailInclude
  where: {
    id: string
    userId: string
  }
}

export type SmartDigestRuleRecord = Prisma.SmartDigestRuleGetPayload<true>
export type SmartDigestRuleListItem = Prisma.SmartDigestRuleGetPayload<{
  include: SmartDigestRuleListInclude
}>
export type SmartDigestRuleDetail = Prisma.SmartDigestRuleGetPayload<{
  include: SmartDigestRuleDetailInclude
}>
export type SmartDigestDetailRecord = Prisma.SmartDigestGetPayload<{
  include: SmartDigestDetailInclude
}>

export type SmartDigestSourceOptions = {
  folders: SmartDigestSourceFolder[]
  subscriptions: Array<{
    faviconUrl: string | null
    folderId: string | null
    folderName: string | null
    id: string
    title: string
  }>
}

export type SmartDigestStore = {
  feedSubscription: {
    findMany(
      args: SmartDigestSubscriptionLookupFindManyArgs
    ): Promise<SmartDigestSubscriptionLookup[]>
    findMany(
      args: SmartDigestSourceSubscriptionFindManyArgs
    ): Promise<SmartDigestSourceSubscription[]>
  }
  folder: {
    findMany(
      args: SmartDigestFolderLookupFindManyArgs
    ): Promise<SmartDigestFolderLookup[]>
    findMany(
      args: SmartDigestSourceFolderFindManyArgs
    ): Promise<SmartDigestSourceFolder[]>
  }
  smartDigestRule: {
    create(args: SmartDigestRuleCreateArgs): Promise<SmartDigestRuleRecord>
    findFirst(
      args: SmartDigestRuleFindFirstArgs
    ): Promise<SmartDigestRuleDetail | null>
    findMany(args: SmartDigestRuleFindManyArgs): Promise<SmartDigestRuleListItem[]>
  }
  user: {
    findUnique(args: SmartDigestUserFindUniqueArgs): Promise<SmartDigestUserPlan | null>
  }
}

export class SmartDigestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SmartDigestError"
  }
}

export function normalizeSmartDigestInput(
  input: SmartDigestInput
): NormalizedSmartDigestInput {
  const name = compactWhitespace(input.name)
  const topicPrompt = compactWhitespace(input.topicPrompt)
  const includeTerms = normalizeTermList(input.includeTerms)

  if (!name) {
    throw new SmartDigestError("Name is required.")
  }

  if (!topicPrompt) {
    throw new SmartDigestError("Topic prompt is required.")
  }

  if (!includeTerms.length) {
    throw new SmartDigestError("Add at least one include term.")
  }

  const sourceScope = isSmartDigestSourceScope(input.sourceScope)
    ? input.sourceScope
    : "ALL_FEEDS"
  const scheduledHour = normalizeScheduledHour(input.scheduledHour)
  const timeZone = isSupportedTimeZone(input.timeZone) ? input.timeZone : "UTC"
  let feedSubscriptionIds = normalizeIds(input.feedSubscriptionIds)
  let folderIds = normalizeIds(input.folderIds)

  if (sourceScope === "ALL_FEEDS") {
    feedSubscriptionIds = []
    folderIds = []
  }

  if (sourceScope === "FOLDERS") {
    if (!folderIds.length) {
      throw new SmartDigestError("Choose at least one folder.")
    }

    feedSubscriptionIds = []
  }

  if (sourceScope === "FEEDS") {
    if (!feedSubscriptionIds.length) {
      throw new SmartDigestError("Choose at least one feed.")
    }

    folderIds = []
  }

  return {
    emailEnabled: Boolean(input.emailEnabled),
    excludeTerms: normalizeTermList(input.excludeTerms),
    feedSubscriptionIds,
    folderIds,
    includeTerms,
    name,
    scheduledHour,
    sourceScope,
    timeZone,
    topicPrompt,
  }
}

export function scheduleNextSmartDigestRun({
  from,
  scheduledHour,
  timeZone,
}: {
  from: Date
  scheduledHour: number
  timeZone: string
}) {
  const normalizedTimeZone = isSupportedTimeZone(timeZone) ? timeZone : "UTC"
  const normalizedHour = normalizeScheduledHour(scheduledHour)
  const localFrom = zonedDateParts(from, normalizedTimeZone)
  let candidate = zonedLocalTimeToUtc({
    day: localFrom.day,
    hour: normalizedHour,
    minute: 0,
    month: localFrom.month,
    second: 0,
    timeZone: normalizedTimeZone,
    year: localFrom.year,
  })

  if (candidate.getTime() <= from.getTime()) {
    const tomorrow = addUtcCalendarDays(
      localFrom.year,
      localFrom.month,
      localFrom.day,
      1
    )
    candidate = zonedLocalTimeToUtc({
      day: tomorrow.day,
      hour: normalizedHour,
      minute: 0,
      month: tomorrow.month,
      second: 0,
      timeZone: normalizedTimeZone,
      year: tomorrow.year,
    })
  }

  return candidate
}

export async function createSmartDigestRuleForUser({
  input,
  userId,
}: {
  input: SmartDigestInput
  userId: string
}): Promise<SmartDigestRuleRecord> {
  return createSmartDigestRuleForUserWithClient({
    input,
    store: getSmartDigestStore(),
    userId,
  })
}

export async function createSmartDigestRuleForUserWithClient({
  input,
  now = new Date(),
  store,
  userId,
}: {
  input: SmartDigestInput
  now?: Date
  store: SmartDigestStore
  userId: string
}): Promise<SmartDigestRuleRecord> {
  const normalized = normalizeSmartDigestInput(input)
  const user = await store.user.findUnique({
    select: {
      _count: {
        select: {
          smartDigestRules: {
            where: {
              isEnabled: true,
            },
          },
        },
      },
      plan: true,
    },
    where: { id: userId },
  })

  if (!user) {
    throw new SmartDigestError("User not found.")
  }

  // Service-boundary cap check; billing-grade concurrency needs stricter locking.
  const limit = smartDigestEnabledLimitForPlan(user.plan)

  if (user._count.smartDigestRules >= limit) {
    throw new SmartDigestError(limitMessageForPlan(user.plan))
  }

  if (normalized.sourceScope === "FOLDERS") {
    await assertFoldersBelongToUser({
      folderIds: normalized.folderIds,
      store,
      userId,
    })
  }

  if (normalized.sourceScope === "FEEDS") {
    await assertSubscriptionsBelongToUser({
      store,
      subscriptionIds: normalized.feedSubscriptionIds,
      userId,
    })
  }

  try {
    return await store.smartDigestRule.create({
      data: {
        cadence: "DAILY",
        emailEnabled: normalized.emailEnabled,
        excludeTerms: normalized.excludeTerms,
        folders: {
          create: normalized.folderIds.map((folderId) => ({
            folderId,
            userId,
          })),
        },
        includeTerms: normalized.includeTerms,
        name: normalized.name,
        nextRunAt: scheduleNextSmartDigestRun({
          from: now,
          scheduledHour: normalized.scheduledHour,
          timeZone: normalized.timeZone,
        }),
        scheduledHour: normalized.scheduledHour,
        sourceScope: normalized.sourceScope,
        subscriptions: {
          create: normalized.feedSubscriptionIds.map((subscriptionId) => ({
            subscriptionId,
            userId,
          })),
        },
        timeZone: normalized.timeZone,
        topicPrompt: normalized.topicPrompt,
        userId,
      },
    })
  } catch (error) {
    if (isDatabaseSmartDigestLimitError(error)) {
      throw new SmartDigestError(limitMessageForPlan(user.plan))
    }

    throw error
  }
}

export async function listSmartDigestRulesForUser(userId: string) {
  return listSmartDigestRulesForUserWithClient({
    store: getSmartDigestStore(),
    userId,
  })
}

export async function listSmartDigestRulesForUserWithClient({
  store,
  userId,
}: {
  store: SmartDigestStore
  userId: string
}): Promise<SmartDigestRuleListItem[]> {
  return store.smartDigestRule.findMany({
    include: {
      digests: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      folders: {
        include: {
          folder: true,
        },
      },
      subscriptions: {
        include: {
          subscription: {
            include: {
              feed: true,
            },
          },
        },
      },
    },
    orderBy: [{ isEnabled: "desc" }, { createdAt: "desc" }],
    where: { userId },
  })
}

export async function getSmartDigestRuleForUser({
  ruleId,
  userId,
}: {
  ruleId: string
  userId: string
}): Promise<SmartDigestRuleDetail | null> {
  return getSmartDigestRuleForUserWithClient({
    ruleId,
    store: getSmartDigestStore(),
    userId,
  })
}

export async function getSmartDigestRuleForUserWithClient({
  ruleId,
  store,
  userId,
}: {
  ruleId: string
  store: SmartDigestStore
  userId: string
}): Promise<SmartDigestRuleDetail | null> {
  return store.smartDigestRule.findFirst({
    include: {
      folders: {
        include: {
          folder: true,
        },
      },
      subscriptions: {
        include: {
          subscription: {
            include: {
              feed: true,
            },
          },
        },
      },
    },
    where: {
      id: ruleId,
      userId,
    },
  })
}

export async function listSmartDigestSourceOptions(userId: string) {
  return listSmartDigestSourceOptionsWithClient({
    store: getSmartDigestStore(),
    userId,
  })
}

export async function getSmartDigestForUser({
  digestId,
  userId,
}: {
  digestId: string
  userId: string
}): Promise<SmartDigestDetailRecord | null> {
  return getPrisma().smartDigest.findFirst({
    include: {
      items: {
        orderBy: { position: "asc" },
      },
      rule: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    where: {
      id: digestId,
      userId,
    },
  })
}

export async function listSmartDigestSourceOptionsWithClient({
  store,
  userId,
}: {
  store: SmartDigestStore
  userId: string
}): Promise<SmartDigestSourceOptions> {
  const [folders, subscriptions] = await Promise.all([
    store.folder.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
      },
      where: { userId },
    }),
    store.feedSubscription.findMany({
      include: {
        feed: true,
        folder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { subscribedAt: "desc" }],
      where: {
        isPaused: false,
        userId,
      },
    }),
  ])

  return {
    folders,
    subscriptions: subscriptions.map((subscription) => ({
      faviconUrl: subscription.feed.faviconUrl,
      folderId: subscription.folderId,
      folderName: subscription.folder?.name ?? null,
      id: subscription.id,
      title: subscription.customTitle || subscription.feed.title,
    })),
  }
}

async function assertFoldersBelongToUser({
  folderIds,
  store,
  userId,
}: {
  folderIds: string[]
  store: SmartDigestStore
  userId: string
}) {
  const folders = await store.folder.findMany({
    select: { id: true },
    where: {
      id: { in: folderIds },
      userId,
    },
  })

  if (folders.length !== folderIds.length) {
    throw new SmartDigestError("Selected folders were not found.")
  }
}

async function assertSubscriptionsBelongToUser({
  store,
  subscriptionIds,
  userId,
}: {
  store: SmartDigestStore
  subscriptionIds: string[]
  userId: string
}) {
  const subscriptions = await store.feedSubscription.findMany({
    select: { id: true },
    where: {
      id: { in: subscriptionIds },
      isPaused: false,
      userId,
    },
  })

  if (subscriptions.length !== subscriptionIds.length) {
    throw new SmartDigestError("Selected feeds were not found or are paused.")
  }
}

function normalizeTermList(value: string) {
  const terms = splitTermParts(value).flatMap((part) =>
    parseSmartDigestTerms(part).map((term) => term.value)
  )
  const seen = new Set<string>()

  return terms.filter((term) => {
    if (seen.has(term)) {
      return false
    }

    seen.add(term)
    return true
  })
}

function splitTermParts(value: string) {
  const parts: string[] = []
  let current = ""
  let inQuote = false

  for (const character of value) {
    if (character === "\"") {
      inQuote = !inQuote
      current += character
      continue
    }

    if (!inQuote && (character === "," || character === "\n")) {
      parts.push(current)
      current = ""
      continue
    }

    current += character
  }

  parts.push(current)
  return parts
}

function normalizeIds(ids: string[] | undefined) {
  const seen = new Set<string>()

  return (ids ?? [])
    .map((id) => id.trim())
    .filter((id) => {
      if (!id || seen.has(id)) {
        return false
      }

      seen.add(id)
      return true
    })
}

function compactWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizeScheduledHour(value: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 8
  }

  return Math.min(23, Math.max(0, Math.round(value)))
}

function isSmartDigestSourceScope(value: unknown): value is SmartDigestSourceScope {
  return value === "ALL_FEEDS" || value === "FOLDERS" || value === "FEEDS"
}

function limitMessageForPlan(plan: Plan) {
  if (plan === "FREE") {
    return "Free accounts can enable one Smart Digest."
  }

  if (plan === "PRO") {
    return "Pro accounts can enable up to 10 Smart Digests."
  }

  return "You have reached the Smart Digest limit for your plan."
}

function zonedDateParts(date: Date, timeZone: SupportedTimeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date)

  return {
    day: Number(partValue(parts, "day")),
    hour: Number(partValue(parts, "hour")),
    minute: Number(partValue(parts, "minute")),
    month: Number(partValue(parts, "month")),
    second: Number(partValue(parts, "second")),
    year: Number(partValue(parts, "year")),
  }
}

function zonedLocalTimeToUtc({
  day,
  hour,
  minute,
  month,
  second,
  timeZone,
  year,
}: {
  day: number
  hour: number
  minute: number
  month: number
  second: number
  timeZone: SupportedTimeZone
  year: number
}) {
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute, second)
  let candidate = targetUtc

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedDateParts(new Date(candidate), timeZone)
    const localAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    const difference = localAsUtc - targetUtc

    if (difference === 0) {
      break
    }

    candidate -= difference
  }

  return new Date(candidate)
}

function addUtcCalendarDays(
  year: number,
  month: number,
  day: number,
  amount: number
) {
  const date = new Date(Date.UTC(year, month - 1, day + amount))

  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  }
}

function partValue(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((part) => part.type === type)?.value ?? ""
}

function getSmartDigestStore() {
  return getPrisma() as unknown as SmartDigestStore
}
