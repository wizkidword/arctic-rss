import { randomUUID } from "node:crypto"

export const OPML_IMPORT_ENTRY_LEASE_MS = 60_000

export type OpmlImportEntryLease = {
  attempt: number
  folderName: string | null
  id: string
  importJobId: string
  leaseExpiresAt: Date
  leaseOwner: string
  sequence: number
  title: string
  xmlUrl: string
}

type OpmlImportEntryLeaseStore = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>
  importJobEntry: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>
  }
}

export async function claimOpmlImportEntry({
  importJobId,
  leaseDurationMs = OPML_IMPORT_ENTRY_LEASE_MS,
  leaseOwner = randomUUID(),
  now = new Date(),
  store,
}: {
  importJobId: string
  leaseDurationMs?: number
  leaseOwner?: string
  now?: Date
  store: OpmlImportEntryLeaseStore
}): Promise<OpmlImportEntryLease | null> {
  const leaseExpiresAt = addMilliseconds(now, leaseDurationMs)
  const entries = await store.$queryRaw<OpmlImportEntryLease[]>`
    WITH next_entry AS (
      SELECT entry."id"
      FROM "ImportJobEntry" AS entry
      JOIN "ImportJob" AS job ON job."id" = entry."importJobId"
      WHERE entry."importJobId" = ${importJobId}
        AND job."status" IN ('PENDING', 'PROCESSING')
        AND job."cancelRequestedAt" IS NULL
        AND (
          entry."status" = 'PENDING'
          OR (
            entry."status" = 'PROCESSING'
            AND (
              entry."leaseExpiresAt" IS NULL
              OR entry."leaseExpiresAt" <= ${now}
            )
          )
        )
      ORDER BY entry."sequence" ASC
      FOR UPDATE OF entry SKIP LOCKED
      LIMIT 1
    )
    UPDATE "ImportJobEntry" AS entry
    SET
      "attempt" = entry."attempt" + 1,
      "leaseOwner" = ${leaseOwner},
      "leaseExpiresAt" = ${leaseExpiresAt},
      "processingStartedAt" = ${now},
      "status" = 'PROCESSING',
      "updatedAt" = CURRENT_TIMESTAMP
    FROM next_entry
    WHERE entry."id" = next_entry."id"
    RETURNING
      entry."attempt",
      entry."folderName",
      entry."id",
      entry."importJobId",
      entry."leaseExpiresAt",
      entry."leaseOwner",
      entry."sequence",
      entry."title",
      entry."xmlUrl"
  `

  return entries[0] ?? null
}

/**
 * Completes one claimed entry and advances the parent counters in one fenced
 * PostgreSQL statement. A late worker returns false without touching either
 * the entry or the import job.
 */
export async function finalizeOpmlImportEntry({
  errorMessage,
  lease,
  now = new Date(),
  status,
  store,
}: {
  errorMessage: string | null
  lease: Pick<OpmlImportEntryLease, "attempt" | "id" | "leaseOwner">
  now?: Date
  status: "ADDED" | "FAILED" | "SKIPPED"
  store: OpmlImportEntryLeaseStore
}) {
  const addedIncrement = status === "ADDED" ? 1 : 0
  const failedIncrement = status === "FAILED" ? 1 : 0
  const skippedIncrement = status === "SKIPPED" ? 1 : 0
  const updated = await store.$queryRaw<Array<{ id: string }>>`
    WITH target AS (
      SELECT entry."id", entry."importJobId"
      FROM "ImportJobEntry" AS entry
      JOIN "ImportJob" AS job ON job."id" = entry."importJobId"
      WHERE entry."id" = ${lease.id}
        AND entry."attempt" = ${lease.attempt}
        AND entry."leaseOwner" = ${lease.leaseOwner}
        AND entry."leaseExpiresAt" > ${now}
        AND entry."status" = 'PROCESSING'
        AND job."status" IN ('PENDING', 'PROCESSING')
        AND job."cancelRequestedAt" IS NULL
        AND job."processedFeeds" < job."totalFeeds"
      FOR UPDATE OF entry, job
    ),
    finalized AS (
      UPDATE "ImportJobEntry" AS entry
      SET
        "errorMessage" = ${errorMessage},
        "leaseExpiresAt" = NULL,
        "leaseOwner" = NULL,
        "processedAt" = ${now},
        "status" = ${status},
        "updatedAt" = CURRENT_TIMESTAMP
      FROM target
      WHERE entry."id" = target."id"
      RETURNING target."importJobId"
    )
    UPDATE "ImportJob" AS job
    SET
      "addedFeeds" = job."addedFeeds" + ${addedIncrement},
      "failedFeeds" = job."failedFeeds" + ${failedIncrement},
      "processedFeeds" = job."processedFeeds" + 1,
      "skippedFeeds" = job."skippedFeeds" + ${skippedIncrement},
      "updatedAt" = CURRENT_TIMESTAMP
    FROM finalized
    WHERE job."id" = finalized."importJobId"
    RETURNING job."id"
  `

  return updated.length === 1
}

export async function renewOpmlImportEntryLease({
  lease,
  leaseDurationMs = OPML_IMPORT_ENTRY_LEASE_MS,
  now = new Date(),
  store,
}: {
  lease: Pick<OpmlImportEntryLease, "attempt" | "id" | "leaseOwner">
  leaseDurationMs?: number
  now?: Date
  store: OpmlImportEntryLeaseStore
}) {
  const updated = await store.importJobEntry.updateMany({
    data: {
      leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
    },
    where: {
      attempt: lease.attempt,
      id: lease.id,
      leaseExpiresAt: { gt: now },
      leaseOwner: lease.leaseOwner,
      status: "PROCESSING",
    },
  })

  return updated.count === 1
}

export async function runWithOpmlImportEntryLeaseHeartbeat<Result>({
  lease,
  now = () => new Date(),
  store,
  work,
}: {
  lease: Pick<OpmlImportEntryLease, "attempt" | "id" | "leaseOwner">
  now?: () => Date
  store: OpmlImportEntryLeaseStore
  work: () => Promise<Result>
}) {
  let leaseHeld = true
  let renewal = Promise.resolve()
  const heartbeat = setInterval(() => {
    renewal = renewal
      .then(async () => {
        if (!leaseHeld) {
          return
        }

        leaseHeld = await renewOpmlImportEntryLease({
          lease,
          now: now(),
          store,
        })
      })
      .catch(() => {
        leaseHeld = false
      })
  }, Math.max(1_000, Math.floor(OPML_IMPORT_ENTRY_LEASE_MS / 2)))

  heartbeat.unref?.()

  try {
    const result = await work()
    await renewal
    if (leaseHeld) {
      leaseHeld = await renewOpmlImportEntryLease({
        lease,
        now: now(),
        store,
      })
    }

    return { leaseHeld, result }
  } finally {
    clearInterval(heartbeat)
  }
}

function addMilliseconds(now: Date, durationMs: number) {
  return new Date(now.getTime() + Math.max(1_000, Math.floor(durationMs)))
}
