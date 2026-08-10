import { randomUUID } from "node:crypto"
import { afterAll, describe, expect, test } from "vitest"

import { getPrisma } from "./db"
import {
  claimOpmlImportEntry,
  finalizeOpmlImportEntry,
} from "./opml-import-leases"
import { processOpmlImportJob } from "./opml-import-jobs"

const databaseTest = process.env.CI ? test : test.skip

describe("OPML import entry leases in PostgreSQL", () => {
  const userIds: string[] = []
  let prisma: ReturnType<typeof getPrisma> | null = null

  afterAll(async () => {
    if (prisma && userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
  })

  databaseTest(
    "rejects a stale finalization after a reclaimed entry is fenced",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const user = await prisma.user.create({
        data: { email: `opml-lease-${marker}@example.test` },
      })
      userIds.push(user.id)
      const job = await prisma.importJob.create({
        data: {
          status: "PENDING",
          totalFeeds: 1,
          userId: user.id,
        },
      })
      await prisma.importJobEntry.create({
        data: {
          importJobId: job.id,
          sequence: 0,
          title: "Example Feed",
          xmlUrl: `https://example.test/opml-${marker}.xml`,
        },
      })

      const claimedAt = new Date("2026-08-09T12:00:00.000Z")
      const [firstClaim, secondClaim] = await Promise.all([
        claimOpmlImportEntry({
          importJobId: job.id,
          leaseOwner: "worker-a",
          now: claimedAt,
          store: prisma,
        }),
        claimOpmlImportEntry({
          importJobId: job.id,
          leaseOwner: "worker-b",
          now: claimedAt,
          store: prisma,
        }),
      ])
      const workerA = firstClaim ?? secondClaim
      expect(workerA).toMatchObject({ attempt: 1 })
      expect([firstClaim, secondClaim].filter(Boolean)).toHaveLength(1)

      const reclaimedAt = new Date("2026-08-09T12:01:00.001Z")
      const workerB = await claimOpmlImportEntry({
        importJobId: job.id,
        leaseOwner: "worker-b",
        now: reclaimedAt,
        store: prisma,
      })
      expect(workerB).toMatchObject({ attempt: 2, leaseOwner: "worker-b" })

      if (!workerA || !workerB) {
        throw new Error("Expected both initial and reclaimed OPML entry leases.")
      }

      await expect(
        finalizeOpmlImportEntry({
          errorMessage: null,
          lease: workerA,
          now: new Date("2026-08-09T12:01:00.002Z"),
          status: "ADDED",
          store: prisma,
        }),
      ).resolves.toBe(false)
      await expect(
        finalizeOpmlImportEntry({
          errorMessage: null,
          lease: workerB,
          now: new Date("2026-08-09T12:01:00.003Z"),
          status: "ADDED",
          store: prisma,
        }),
      ).resolves.toBe(true)

      await expect(
        Promise.all([
          prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }),
          prisma.importJobEntry.findUniqueOrThrow({
            where: { importJobId_sequence: { importJobId: job.id, sequence: 0 } },
          }),
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          addedFeeds: 1,
          failedFeeds: 0,
          processedFeeds: 1,
          skippedFeeds: 0,
          totalFeeds: 1,
        }),
        expect.objectContaining({
          attempt: 2,
          leaseExpiresAt: null,
          leaseOwner: null,
          status: "ADDED",
        }),
      ])
    },
  )

  databaseTest(
    "rejects finalization after an import cancellation request",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const user = await prisma.user.create({
        data: { email: `opml-cancel-${marker}@example.test` },
      })
      userIds.push(user.id)
      const job = await prisma.importJob.create({
        data: {
          status: "PROCESSING",
          totalFeeds: 1,
          userId: user.id,
        },
      })
      await prisma.importJobEntry.create({
        data: {
          importJobId: job.id,
          sequence: 0,
          title: "Example Feed",
          xmlUrl: `https://example.test/opml-cancel-${marker}.xml`,
        },
      })
      const claimedAt = new Date("2026-08-09T13:00:00.000Z")
      const lease = await claimOpmlImportEntry({
        importJobId: job.id,
        leaseOwner: "worker-a",
        now: claimedAt,
        store: prisma,
      })

      if (!lease) {
        throw new Error("Expected an OPML entry lease before cancellation.")
      }

      await prisma.importJob.update({
        data: { cancelRequestedAt: new Date("2026-08-09T13:00:00.001Z") },
        where: { id: job.id },
      })

      await expect(
        finalizeOpmlImportEntry({
          errorMessage: null,
          lease,
          now: new Date("2026-08-09T13:00:00.002Z"),
          status: "ADDED",
          store: prisma,
        }),
      ).resolves.toBe(false)
      await expect(
        Promise.all([
          prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }),
          prisma.importJobEntry.findUniqueOrThrow({
            where: { importJobId_sequence: { importJobId: job.id, sequence: 0 } },
          }),
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          addedFeeds: 0,
          processedFeeds: 0,
        }),
        expect.objectContaining({
          status: "PROCESSING",
        }),
      ])
    },
  )

  databaseTest(
    "completes an import only after no pending or processing entry remains",
    async () => {
      prisma = getPrisma()
      const marker = randomUUID().replaceAll("-", "")
      const user = await prisma.user.create({
        data: { email: `opml-complete-${marker}@example.test` },
      })
      userIds.push(user.id)
      const job = await prisma.importJob.create({
        data: {
          status: "PENDING",
          totalFeeds: 0,
          userId: user.id,
        },
      })

      await expect(
        processOpmlImportJob({
          jobId: job.id,
          now: () => new Date("2026-08-09T14:00:00.000Z"),
        }),
      ).resolves.toEqual({ status: "COMPLETED" })
      await expect(
        prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }),
      ).resolves.toMatchObject({
        completedAt: new Date("2026-08-09T14:00:00.000Z"),
        status: "COMPLETED",
      })
    },
  )
})
