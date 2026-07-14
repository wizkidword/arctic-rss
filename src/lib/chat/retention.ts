import type { PrismaClient } from "@/generated/prisma/client"

export const CHAT_MESSAGE_RETENTION_DAYS = 90
export const CHAT_DELETED_MESSAGE_PURGE_HOURS = 24
export const CHAT_ORDINARY_REPORT_RETENTION_DAYS = 365
export const CHAT_SERIOUS_REPORT_RETENTION_DAYS = 730
export const CHAT_AUDIT_RETENTION_DAYS = 730
export const CHAT_HISTORICAL_MEMBERSHIP_RETENTION_DAYS = 30
export const CHAT_LEGAL_HOLD_REVIEW_DAYS = 90

const DEFAULT_BATCH_SIZE = 250
const MAX_BATCH_SIZE = 1_000
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1_000
const MIN_INTERVAL_MS = 60 * 60 * 1_000
const MAX_INTERVAL_MS = 24 * 60 * 60 * 1_000

export type ChatRetentionStore = Pick<
  PrismaClient,
  | "accountDeletionRecord"
  | "chatAuditLog"
  | "chatLegalHold"
  | "chatMessage"
  | "chatReport"
  | "chatRoomMember"
>

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
  }
}

export async function purgeExpiredChatRecords({
  batchSize = DEFAULT_BATCH_SIZE,
  now = new Date(),
  store,
}: {
  batchSize?: number
  now?: Date
  store: ChatRetentionStore
}) {
  const boundedBatchSize = Math.min(Math.max(Math.trunc(batchSize), 1), MAX_BATCH_SIZE)
  const messageExpiry = subtractDays(now, CHAT_MESSAGE_RETENTION_DAYS)
  const deletedMessageExpiry = new Date(
    now.getTime() - CHAT_DELETED_MESSAGE_PURGE_HOURS * 60 * 60 * 1_000
  )
  const ordinaryReportExpiry = subtractDays(now, CHAT_ORDINARY_REPORT_RETENTION_DAYS)
  const seriousReportExpiry = subtractDays(now, CHAT_SERIOUS_REPORT_RETENTION_DAYS)
  const auditExpiry = subtractDays(now, CHAT_AUDIT_RETENTION_DAYS)
  const historicalMembershipExpiry = subtractDays(now, CHAT_HISTORICAL_MEMBERSHIP_RETENTION_DAYS)

  const [messageIds, reportIds, auditIds, deletionRecordIds, memberships, legalHoldReviewsDue] = await Promise.all([
    store.chatMessage.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      take: boundedBatchSize,
      where: {
        OR: [
          { createdAt: { lte: messageExpiry } },
          { deletedAt: { lte: deletedMessageExpiry } },
        ],
      },
    }),
    store.chatReport.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      take: boundedBatchSize,
      where: {
        OR: [
          {
            closedAt: { lte: ordinaryReportExpiry },
            retentionClass: "ORDINARY",
          },
          {
            closedAt: { lte: seriousReportExpiry },
            retentionClass: "SERIOUS",
          },
        ],
      },
    }),
    store.chatAuditLog.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      take: boundedBatchSize,
      where: { createdAt: { lte: auditExpiry } },
    }),
    store.accountDeletionRecord.findMany({
      orderBy: { id: "asc" },
      select: { id: true },
      take: boundedBatchSize,
      where: { completedAt: { lte: auditExpiry } },
    }),
    store.chatRoomMember.findMany({
      orderBy: { id: "asc" },
      select: { id: true, roomId: true, userId: true },
      take: boundedBatchSize,
      where: {
        leftAt: { lte: historicalMembershipExpiry },
        status: "LEFT",
      },
    }),
    store.chatLegalHold.count({
      where: { releasedAt: null, reviewAt: { lte: now } },
    }),
  ])

  const protectedMemberships = await findProtectedMemberships({
    memberships,
    store,
  })
  const deletableMembershipIds = memberships
    .filter((membership) => !protectedMemberships.has(membership.id))
    .map((membership) => membership.id)

  const [purgedMessages, purgedReports, purgedAuditLogs, purgedDeletionRecords, purgedMemberships] = await Promise.all([
    deleteUnheldRecords({
      ids: messageIds.map((record) => record.id),
      model: store.chatMessage,
      store,
      subjectType: "CHAT_MESSAGE",
    }),
    deleteUnheldRecords({
      ids: reportIds.map((record) => record.id),
      model: store.chatReport,
      store,
      subjectType: "CHAT_REPORT",
    }),
    deleteUnheldRecords({
      ids: auditIds.map((record) => record.id),
      model: store.chatAuditLog,
      store,
      subjectType: "CHAT_AUDIT_LOG",
    }),
    store.accountDeletionRecord.deleteMany({
      where: { id: { in: deletionRecordIds.map((record) => record.id) } },
    }).then((result) => result.count),
    deletableMembershipIds.length
      ? store.chatRoomMember.deleteMany({
          where: {
            id: { in: deletableMembershipIds },
            leftAt: { lte: historicalMembershipExpiry },
            status: "LEFT",
          },
        }).then((result) => result.count)
      : Promise.resolve(0),
  ])

  return {
    legalHoldReviewsDue,
    purgedAuditLogs,
    purgedDeletionRecords,
    purgedMessages,
    purgedMemberships,
    purgedReports,
  }
}

async function findProtectedMemberships({
  memberships,
  store,
}: {
  memberships: Array<{ id: string; roomId: string; userId: string }>
  store: Pick<ChatRetentionStore, "chatReport">
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
  model: {
    deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<{ count: number }>
  }
  store: Pick<ChatRetentionStore, "chatLegalHold">
  subjectType: "CHAT_AUDIT_LOG" | "CHAT_MESSAGE" | "CHAT_REPORT"
}) {
  if (!ids.length) {
    return 0
  }

  const holds = await store.chatLegalHold.findMany({
    select: { subjectId: true },
    where: {
      releasedAt: null,
      subjectId: { in: ids },
      subjectType,
    },
  })
  const heldIds = new Set(holds.map((hold) => hold.subjectId))
  const deletableIds = ids.filter((id) => !heldIds.has(id))

  if (!deletableIds.length) {
    return 0
  }

  const result = await model.deleteMany({ where: { id: { in: deletableIds } } })
  return result.count
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
