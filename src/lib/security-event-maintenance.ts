import type { PrismaClient } from "@/generated/prisma/client"

import { getPrisma } from "@/lib/db"

export const SECURITY_EVENT_RETENTION_DAYS = 90
export const DEFAULT_SECURITY_EVENT_CLEANUP_BATCH_SIZE = 100

type SecurityEventMaintenanceStore = Pick<PrismaClient, "securityEvent">

type SecurityEventMaintenanceDeps = {
  batchSize?: number
  now?: Date
  store?: unknown
}

export async function cleanupExpiredSecurityEvents(
  deps: SecurityEventMaintenanceDeps = {}
) {
  const store = (deps.store ?? getPrisma()) as SecurityEventMaintenanceStore
  const now = deps.now ?? new Date()
  const batchSize = getBatchSize(deps.batchSize)
  const expiresAt = new Date(now.getTime() - SECURITY_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1_000)
  const events = await store.securityEvent.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: batchSize,
    where: { createdAt: { lte: expiresAt } },
  })

  if (!events.length) {
    return { securityEventsDeleted: 0 }
  }

  const result = await store.securityEvent.deleteMany({
    where: {
      createdAt: { lte: expiresAt },
      id: { in: events.map((event) => event.id) },
    },
  })

  return { securityEventsDeleted: result.count }
}

function getBatchSize(value?: number) {
  if (!Number.isInteger(value) || !value || value < 1) {
    return DEFAULT_SECURITY_EVENT_CLEANUP_BATCH_SIZE
  }

  return Math.min(value, 1_000)
}
