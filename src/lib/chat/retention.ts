import { Prisma, type PrismaClient } from "@/generated/prisma/client"

import { withChatRecordLock } from "./record-lock"

export const CHAT_MESSAGE_RETENTION_DAYS = 90
export const CHAT_DELETED_MESSAGE_PURGE_HOURS = 24
export const CHAT_ORDINARY_REPORT_RETENTION_DAYS = 365
export const CHAT_SERIOUS_REPORT_RETENTION_DAYS = 730
export const CHAT_AUDIT_RETENTION_DAYS = 730
export const CHAT_HISTORICAL_MEMBERSHIP_RETENTION_DAYS = 30
export const CHAT_LEGAL_HOLD_REVIEW_DAYS = 90

const DEFAULT_BATCH_SIZE = 250
const MAX_BATCH_SIZE = 1_000
const DEFAULT_MAX_BATCHES = 10
const MAX_MAX_BATCHES = 100
const DEFAULT_MAX_RUNTIME_MS = 45_000
const MIN_MAX_RUNTIME_MS = 1_000
const MAX_MAX_RUNTIME_MS = 120_000
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1_000
const MIN_INTERVAL_MS = 60 * 60 * 1_000
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1_000

type ChatRetentionDatabase = Pick<
  PrismaClient,
  | "$executeRaw"
  | "$queryRaw"
  | "accountDeletionRecord"
  | "chatAuditLog"
  | "chatLegalHold"
  | "chatMessage"
  | "chatReport"
  | "chatRoomMember"
>

export type ChatRetentionStore = ChatRetentionDatabase & Pick<PrismaClient, "$transaction">

type RetentionCursor = {
  eligibleAt: string
  id: string
}

export type ChatRetentionContinuation = Partial<
  Record<"auditLogs" | "deletionRecords" | "memberships" | "messages" | "reports", RetentionCursor>
>

type RetentionCandidate = {
  eligibleAt: Date
  id: string
}

type MembershipCandidate = RetentionCandidate & {
  roomId: string
  userId: string
}

type PurgeCounts = {
  auditLogs: number
  deletionRecords: number
  memberships: number
  messages: number
  reports: number
}

type EligibleCounts = {
  auditLogs: number
  deletionRecords: number
  memberships: number
  messages: number
  reports: number
}

export type ChatRetentionSummary = {
  batches: number
  continuation: ChatRetentionContinuation | null
  eligible: EligibleCounts
  failureCount: number
  holdSkips: number
  legalHoldReviewsDue: number
  oldestEligibleAt: string | null
  protectedMembershipSkips: number
  purgedAuditLogs: number
  purgedDeletionRecords: number
  purgedMemberships: number
  purgedMessages: number
  purgedReports: number
  remainingEligible: number
  runtimeMs: number
  skipped: boolean
  workBudgetExhausted: boolean
}

export function getChatRetentionSettings(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return {
    batchSize: parseBoundedInteger(
      environment.ARCTIC_IRC_RETENTION_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      1,
      MAX_BATCH_SIZE
    ),
    intervalMs: parseBoundedInteger(
      environment.ARCTIC_IRC_RETENTION_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS
    ),
    maxBatches: parseBoundedInteger(
      environment.ARCTIC_IRC_RETENTION_MAX_BATCHES,
      DEFAULT_MAX_BATCHES,
      1,
      MAX_MAX_BATCHES
    ),
    maxRuntimeMs: parseBoundedInteger(
      environment.ARCTIC_IRC_RETENTION_MAX_RUNTIME_MS,
      DEFAULT_MAX_RUNTIME_MS,
      MIN_MAX_RUNTIME_MS,
      MAX_MAX_RUNTIME_MS
    ),
  }
}

/**
 * Purges retention-eligible records in small, restart-safe batches. A
 * transaction-scoped advisory lock ensures only one worker performs a pass at
 * a time; record-level locks continue to serialize each deletion with a legal
 * hold mutation.
 */
export async function purgeExpiredChatRecords({
  batchSize = DEFAULT_BATCH_SIZE,
  continuation,
  maxBatches = DEFAULT_MAX_BATCHES,
  maxRuntimeMs = DEFAULT_MAX_RUNTIME_MS,
  now = new Date(),
  store,
}: {
  batchSize?: number
  continuation?: ChatRetentionContinuation
  maxBatches?: number
  maxRuntimeMs?: number
  now?: Date
  store: ChatRetentionStore
}): Promise<ChatRetentionSummary> {
  const boundedBatchSize = Math.min(Math.max(Math.trunc(batchSize), 1), MAX_BATCH_SIZE)
  const boundedMaxBatches = Math.min(Math.max(Math.trunc(maxBatches), 1), MAX_MAX_BATCHES)
  const boundedMaxRuntimeMs = Math.min(
    Math.max(Math.trunc(maxRuntimeMs), MIN_MAX_RUNTIME_MS),
    MAX_MAX_RUNTIME_MS
  )
  const startedAt = Date.now()

  return store.$transaction(
    async (transaction) => {
      const retentionStore = transaction as unknown as ChatRetentionDatabase
      const lock = await retentionStore.$queryRaw<{ locked: boolean }[]>(Prisma.sql`
        SELECT pg_try_advisory_xact_lock(hashtext('arctic-rss:chat-retention')) AS "locked"
      `)

      if (!lock[0]?.locked) {
        return emptySummary({ runtimeMs: Date.now() - startedAt, skipped: true })
      }

      return purgeExpiredChatRecordsWithStore({
        batchSize: boundedBatchSize,
        continuation,
        maxBatches: boundedMaxBatches,
        maxRuntimeMs: boundedMaxRuntimeMs,
        now,
        startedAt,
        store: retentionStore,
      })
    },
    {
      // The run is intentionally short and bounded. Leave room for the
      // transaction to commit after the configured work budget is exhausted.
      maxWait: 5_000,
      timeout: Math.min(boundedMaxRuntimeMs + 5_000, 125_000),
    }
  )
}

async function purgeExpiredChatRecordsWithStore({
  batchSize,
  continuation,
  maxBatches,
  maxRuntimeMs,
  now,
  startedAt,
  store,
}: {
  batchSize: number
  continuation?: ChatRetentionContinuation
  maxBatches: number
  maxRuntimeMs: number
  now: Date
  startedAt: number
  store: ChatRetentionDatabase
}): Promise<ChatRetentionSummary> {
  const thresholds = getRetentionThresholds(now)
  const [eligible, legalHoldReviewsDue] = await Promise.all([
    countEligibleRecords({ store, thresholds }),
    store.chatLegalHold.count({ where: { releasedAt: null, reviewAt: { lte: now } } }),
  ])
  const purged: PurgeCounts = {
    auditLogs: 0,
    deletionRecords: 0,
    memberships: 0,
    messages: 0,
    reports: 0,
  }
  let holdSkips = 0
  let protectedMembershipSkips = 0
  let cursors: ChatRetentionContinuation = { ...continuation }
  let batches = 0
  let oldestEligibleAt: Date | undefined
  let exhausted = false

  while (batches < maxBatches && Date.now() - startedAt < maxRuntimeMs) {
    const page = await selectRetentionPage({ batchSize, cursors, store, thresholds })

    if (!page.hasRecords) {
      cursors = {}
      break
    }

    batches += 1
    oldestEligibleAt ??= page.oldestEligibleAt
    cursors = page.nextCursors

    const [messages, reports, auditLogs] = await Promise.all([
      deleteUnheldRecords({
        ids: page.messages.map((record) => record.id),
        model: (transaction) => transaction.chatMessage,
        store,
        subjectType: "CHAT_MESSAGE",
      }),
      deleteUnheldRecords({
        ids: page.reports.map((record) => record.id),
        model: (transaction) => transaction.chatReport,
        store,
        subjectType: "CHAT_REPORT",
      }),
      deleteUnheldRecords({
        ids: page.auditLogs.map((record) => record.id),
        model: (transaction) => transaction.chatAuditLog,
        store,
        subjectType: "CHAT_AUDIT_LOG",
      }),
    ])
    const protectedMemberships = await findProtectedMemberships({
      memberships: page.memberships,
      store,
    })
    const deletableMembershipIds = page.memberships
      .filter((membership) => !protectedMemberships.has(membership.id))
      .map((membership) => membership.id)
    const [deletionRecords, memberships] = await Promise.all([
      page.deletionRecords.length
        ? store.accountDeletionRecord
            .deleteMany({ where: { id: { in: page.deletionRecords.map((record) => record.id) } } })
            .then((result) => result.count)
        : Promise.resolve(0),
      deletableMembershipIds.length
        ? store.chatRoomMember
            .deleteMany({
              where: {
                id: { in: deletableMembershipIds },
                leftAt: { lte: thresholds.historicalMembershipExpiry },
                status: "LEFT",
              },
            })
            .then((result) => result.count)
        : Promise.resolve(0),
    ])

    purged.messages += messages.purged
    purged.reports += reports.purged
    purged.auditLogs += auditLogs.purged
    purged.deletionRecords += deletionRecords
    purged.memberships += memberships
    holdSkips += messages.holdSkips + reports.holdSkips + auditLogs.holdSkips
    protectedMembershipSkips += protectedMemberships.size
  }

  if (batches === maxBatches || Date.now() - startedAt >= maxRuntimeMs) {
    exhausted = true
  }

  const totalPurged = Object.values(purged).reduce((total, count) => total + count, 0)
  const totalEligible = Object.values(eligible).reduce((total, count) => total + count, 0)

  return {
    batches,
    continuation: exhausted && Object.keys(cursors).length ? cursors : null,
    eligible,
    failureCount: 0,
    holdSkips,
    legalHoldReviewsDue,
    oldestEligibleAt: oldestEligibleAt?.toISOString() ?? null,
    protectedMembershipSkips,
    purgedAuditLogs: purged.auditLogs,
    purgedDeletionRecords: purged.deletionRecords,
    purgedMemberships: purged.memberships,
    purgedMessages: purged.messages,
    purgedReports: purged.reports,
    remainingEligible: Math.max(0, totalEligible - totalPurged),
    runtimeMs: Date.now() - startedAt,
    skipped: false,
    workBudgetExhausted: exhausted,
  }
}

async function selectRetentionPage({
  batchSize,
  cursors,
  store,
  thresholds,
}: {
  batchSize: number
  cursors: ChatRetentionContinuation
  store: Pick<ChatRetentionDatabase, "$queryRaw">
  thresholds: RetentionThresholds
}) {
  const [messages, reports, auditLogs, deletionRecords, memberships] = await Promise.all([
    selectMessages({ batchSize, cursor: cursors.messages, store, thresholds }),
    selectReports({ batchSize, cursor: cursors.reports, store, thresholds }),
    selectAuditLogs({ batchSize, cursor: cursors.auditLogs, store, thresholds }),
    selectDeletionRecords({ batchSize, cursor: cursors.deletionRecords, store, thresholds }),
    selectMemberships({ batchSize, cursor: cursors.memberships, store, thresholds }),
  ])
  const all = [...messages, ...reports, ...auditLogs, ...deletionRecords, ...memberships]
  const nextCursors: ChatRetentionContinuation = {
    ...cursors,
    ...cursorFor("messages", messages),
    ...cursorFor("reports", reports),
    ...cursorFor("auditLogs", auditLogs),
    ...cursorFor("deletionRecords", deletionRecords),
    ...cursorFor("memberships", memberships),
  }

  return {
    auditLogs,
    deletionRecords,
    hasRecords: all.length > 0,
    memberships,
    messages,
    nextCursors,
    oldestEligibleAt: all.length
      ? new Date(Math.min(...all.map((record) => record.eligibleAt.getTime())))
      : undefined,
    reports,
  }
}

async function selectMessages({
  batchSize,
  cursor,
  store,
  thresholds,
}: SelectorInput) {
  return selectCandidates({
    batchSize,
    cursor,
    query: Prisma.sql`
      SELECT "id", "eligibleAt"
      FROM (
        SELECT
          "id",
          LEAST(
            "createdAt" + INTERVAL '90 days',
            COALESCE("deletedAt" + INTERVAL '24 hours', 'infinity'::timestamp)
          ) AS "eligibleAt"
        FROM "ChatMessage"
        WHERE "createdAt" <= ${thresholds.messageExpiry}
           OR "deletedAt" <= ${thresholds.deletedMessageExpiry}
      ) AS eligible_records
    `,
    store,
  })
}

async function selectReports({
  batchSize,
  cursor,
  store,
  thresholds,
}: SelectorInput) {
  return selectCandidates({
    batchSize,
    cursor,
    query: Prisma.sql`
      SELECT "id", "eligibleAt"
      FROM (
        SELECT
          "id",
          CASE
            WHEN "retentionClass" = 'ORDINARY' THEN "closedAt" + INTERVAL '365 days'
            WHEN "retentionClass" = 'SERIOUS' THEN "closedAt" + INTERVAL '730 days'
          END AS "eligibleAt"
        FROM "ChatReport"
        WHERE ("retentionClass" = 'ORDINARY' AND "closedAt" <= ${thresholds.ordinaryReportExpiry})
           OR ("retentionClass" = 'SERIOUS' AND "closedAt" <= ${thresholds.seriousReportExpiry})
      ) AS eligible_records
    `,
    store,
  })
}

async function selectAuditLogs({ batchSize, cursor, store, thresholds }: SelectorInput) {
  return selectCandidates({
    batchSize,
    cursor,
    query: Prisma.sql`
      SELECT "id", "createdAt" AS "eligibleAt"
      FROM "ChatAuditLog"
      WHERE "createdAt" <= ${thresholds.auditExpiry}
    `,
    store,
  })
}

async function selectDeletionRecords({ batchSize, cursor, store, thresholds }: SelectorInput) {
  return selectCandidates({
    batchSize,
    cursor,
    query: Prisma.sql`
      SELECT "id", "completedAt" AS "eligibleAt"
      FROM "AccountDeletionRecord"
      WHERE "completedAt" <= ${thresholds.auditExpiry}
    `,
    store,
  })
}

async function selectMemberships({ batchSize, cursor, store, thresholds }: SelectorInput) {
  const rows = await selectRaw<MembershipCandidate>({
    batchSize,
    cursor,
    query: Prisma.sql`
      SELECT "id", "roomId", "userId", "leftAt" AS "eligibleAt"
      FROM "ChatRoomMember"
      WHERE "status" = 'LEFT' AND "leftAt" <= ${thresholds.historicalMembershipExpiry}
    `,
    store,
  })

  return rows.map((record) => ({ ...record, eligibleAt: new Date(record.eligibleAt) }))
}

type SelectorInput = {
  batchSize: number
  cursor?: RetentionCursor
  store: Pick<ChatRetentionDatabase, "$queryRaw">
  thresholds: RetentionThresholds
}

async function selectCandidates({
  batchSize,
  cursor,
  query,
  store,
}: {
  batchSize: number
  cursor?: RetentionCursor
  query: Prisma.Sql
  store: Pick<ChatRetentionDatabase, "$queryRaw">
}) {
  const rows = await selectRaw<RetentionCandidate>({ batchSize, cursor, query, store })
  return rows.map((record) => ({ ...record, eligibleAt: new Date(record.eligibleAt) }))
}

async function selectRaw<T extends RetentionCandidate>({
  batchSize,
  cursor,
  query,
  store,
}: {
  batchSize: number
  cursor?: RetentionCursor
  query: Prisma.Sql
  store: Pick<ChatRetentionDatabase, "$queryRaw">
}) {
  const cursorFilter = cursor
    ? Prisma.sql`
        AND ("eligibleAt", "id") > (${new Date(cursor.eligibleAt)}, ${cursor.id})
      `
    : Prisma.empty

  return store.$queryRaw<T[]>(Prisma.sql`
    SELECT *
    FROM (${query}) AS ordered_eligible_records
    WHERE 1 = 1 ${cursorFilter}
    ORDER BY "eligibleAt" ASC, "id" ASC
    LIMIT ${batchSize}
  `)
}

function cursorFor(
  key: keyof ChatRetentionContinuation,
  records: Array<RetentionCandidate>
): ChatRetentionContinuation {
  const last = records.at(-1)

  return last
    ? {
        [key]: {
          eligibleAt: last.eligibleAt.toISOString(),
          id: last.id,
        },
      }
    : {}
}

async function countEligibleRecords({
  store,
  thresholds,
}: {
  store: Pick<
    ChatRetentionDatabase,
    "accountDeletionRecord" | "chatAuditLog" | "chatMessage" | "chatReport" | "chatRoomMember"
  >
  thresholds: RetentionThresholds
}): Promise<EligibleCounts> {
  const [messages, reports, auditLogs, deletionRecords, memberships] = await Promise.all([
    store.chatMessage.count({
      where: {
        OR: [
          { createdAt: { lte: thresholds.messageExpiry } },
          { deletedAt: { lte: thresholds.deletedMessageExpiry } },
        ],
      },
    }),
    store.chatReport.count({
      where: {
        OR: [
          { closedAt: { lte: thresholds.ordinaryReportExpiry }, retentionClass: "ORDINARY" },
          { closedAt: { lte: thresholds.seriousReportExpiry }, retentionClass: "SERIOUS" },
        ],
      },
    }),
    store.chatAuditLog.count({ where: { createdAt: { lte: thresholds.auditExpiry } } }),
    store.accountDeletionRecord.count({ where: { completedAt: { lte: thresholds.auditExpiry } } }),
    store.chatRoomMember.count({
      where: { leftAt: { lte: thresholds.historicalMembershipExpiry }, status: "LEFT" },
    }),
  ])

  return { auditLogs, deletionRecords, memberships, messages, reports }
}

async function findProtectedMemberships({
  memberships,
  store,
}: {
  memberships: Array<{ id: string; roomId: string; userId: string }>
  store: Pick<ChatRetentionDatabase, "chatReport">
}) {
  if (!memberships.length) {
    return new Set<string>()
  }

  const roomIds = [...new Set(memberships.map((membership) => membership.roomId))]
  const userIds = [...new Set(memberships.map((membership) => membership.userId))]
  const reports = await store.chatReport.findMany({
    select: { reporterUserId: true, roomId: true, targetUserId: true },
    where: {
      OR: [
        {
          OR: [{ reporterUserId: { in: userIds } }, { targetUserId: { in: userIds } }],
          roomId: { in: roomIds },
        },
        {
          OR: [{ reporterUserId: { in: userIds } }, { targetUserId: { in: userIds } }],
          roomId: null,
        },
      ],
      status: { in: ["OPEN", "REVIEWING"] },
    },
  })
  const protectedRecordIds = new Set<string>()

  for (const report of reports) {
    const userIdsInReport = [report.reporterUserId, report.targetUserId].filter(
      (userId): userId is string => Boolean(userId)
    )

    for (const userId of userIdsInReport) {
      for (const membership of memberships) {
        if (
          membership.userId === userId &&
          (report.roomId === null || membership.roomId === report.roomId)
        ) {
          protectedRecordIds.add(membership.id)
        }
      }
    }
  }

  return protectedRecordIds
}

async function deleteUnheldRecords({
  ids,
  model,
  store,
  subjectType,
}: {
  ids: string[]
  model: (transaction: ChatRetentionDatabase) => {
    deleteMany: (args: { where: { id: string } }) => Promise<{ count: number }>
  }
  store: ChatRetentionDatabase
  subjectType: "CHAT_AUDIT_LOG" | "CHAT_MESSAGE" | "CHAT_REPORT"
}) {
  let holdSkips = 0
  let purged = 0

  for (const id of ids) {
    const result = await withChatRecordLock({
      recordId: id,
      scope: subjectType,
      store,
      work: async (transaction) => {
        const activeHold = await transaction.chatLegalHold.findFirst({
          select: { id: true },
          where: { releasedAt: null, subjectId: id, subjectType },
        })

        if (activeHold) {
          return { holdSkips: 1, purged: 0 }
        }

        const deleted = await model(transaction).deleteMany({ where: { id } })
        return { holdSkips: 0, purged: deleted.count }
      },
    })
    holdSkips += result.holdSkips
    purged += result.purged
  }

  return { holdSkips, purged }
}

type RetentionThresholds = ReturnType<typeof getRetentionThresholds>

function getRetentionThresholds(now: Date) {
  return {
    auditExpiry: subtractDays(now, CHAT_AUDIT_RETENTION_DAYS),
    deletedMessageExpiry: new Date(
      now.getTime() - CHAT_DELETED_MESSAGE_PURGE_HOURS * 60 * 60 * 1_000
    ),
    historicalMembershipExpiry: subtractDays(now, CHAT_HISTORICAL_MEMBERSHIP_RETENTION_DAYS),
    messageExpiry: subtractDays(now, CHAT_MESSAGE_RETENTION_DAYS),
    ordinaryReportExpiry: subtractDays(now, CHAT_ORDINARY_REPORT_RETENTION_DAYS),
    seriousReportExpiry: subtractDays(now, CHAT_SERIOUS_REPORT_RETENTION_DAYS),
  }
}

function emptySummary({ runtimeMs, skipped }: { runtimeMs: number; skipped: boolean }): ChatRetentionSummary {
  return {
    batches: 0,
    continuation: null,
    eligible: { auditLogs: 0, deletionRecords: 0, memberships: 0, messages: 0, reports: 0 },
    failureCount: 0,
    holdSkips: 0,
    legalHoldReviewsDue: 0,
    oldestEligibleAt: null,
    protectedMembershipSkips: 0,
    purgedAuditLogs: 0,
    purgedDeletionRecords: 0,
    purgedMemberships: 0,
    purgedMessages: 0,
    purgedReports: 0,
    remainingEligible: 0,
    runtimeMs,
    skipped,
    workBudgetExhausted: false,
  }
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = value?.trim() ? Number(value) : fallback

  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1_000)
}
