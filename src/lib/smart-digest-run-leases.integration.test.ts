import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, test } from "vitest";

import { getPrisma } from "./db";
import {
  claimSmartDigestRun,
  smartDigestRunLeaseWhere,
} from "./smart-digest-run-leases";

const databaseTest = process.env.CI ? test : test.skip;

describe("Smart Digest run leases in PostgreSQL", () => {
  const userIds: string[] = [];
  let prisma: ReturnType<typeof getPrisma> | null = null;

  afterAll(async () => {
    if (prisma && userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  databaseTest(
    "fences a stale worker after a replacement creates the run's only digest",
    async () => {
      prisma = getPrisma();
      const marker = randomUUID().replaceAll("-", "");
      const user = await prisma.user.create({
        data: { email: `digest-lease-${marker}@example.test` },
      });
      userIds.push(user.id);
      const rule = await prisma.smartDigestRule.create({
        data: {
          name: "Lease fixture",
          topicPrompt: "Fixture",
          userId: user.id,
        },
      });
      const run = await prisma.digestRun.create({
        data: {
          ruleId: rule.id,
          scheduledFor: new Date("2026-08-09T12:00:00.000Z"),
        },
      });

      const claimedAt = new Date("2026-08-09T12:00:00.000Z");
      const firstLease = await claimSmartDigestRun({
        leaseDurationMs: 1_000,
        leaseOwner: "worker-a",
        now: claimedAt,
        runId: run.id,
        store: prisma,
      });
      expect(firstLease).toMatchObject({ attempt: 1, leaseOwner: "worker-a" });

      const secondLease = await claimSmartDigestRun({
        leaseDurationMs: 1_000,
        leaseOwner: "worker-b",
        now: new Date("2026-08-09T12:00:01.001Z"),
        runId: run.id,
        store: prisma,
      });
      expect(secondLease).toMatchObject({ attempt: 2, leaseOwner: "worker-b" });

      if (!firstLease || !secondLease) {
        throw new Error(
          "Expected initial and replacement Smart Digest leases.",
        );
      }

      const finalizedAt = new Date("2026-08-09T12:00:01.002Z");
      const digest = await prisma.$transaction(async (transaction) => {
        const renewed = await transaction.digestRun.updateMany({
          data: {
            lastHeartbeatAt: finalizedAt,
            leaseExpiresAt: new Date("2026-08-09T12:10:01.002Z"),
          },
          where: smartDigestRunLeaseWhere(secondLease, finalizedAt),
        });
        expect(renewed.count).toBe(1);

        const createdDigest = await transaction.smartDigest.upsert({
          create: {
            articleCount: 0,
            completedAt: finalizedAt,
            emailStatus: "NOT_REQUESTED",
            ruleId: rule.id,
            runId: run.id,
            startedAt: finalizedAt,
            status: "COMPLETED_NO_MATCHES",
            title: "Lease fixture",
            topicPrompt: "Fixture",
            userId: user.id,
          },
          update: {},
          where: { runId: run.id },
        });
        await transaction.smartDigestRule.update({
          data: {
            contentWatermarkAt: finalizedAt,
            lastRunAt: finalizedAt,
            nextRunAt: new Date("2026-08-10T12:00:00.000Z"),
          },
          where: { id: rule.id },
        });
        const completed = await transaction.digestRun.updateMany({
          data: {
            completedAt: finalizedAt,
            digestId: createdDigest.id,
            leaseExpiresAt: null,
            leaseOwner: null,
            processingStartedAt: null,
            status: "COMPLETED",
            watermarkFrom: new Date("2026-08-09T10:00:00.000Z"),
            watermarkTo: finalizedAt,
          },
          where: smartDigestRunLeaseWhere(secondLease, finalizedAt),
        });
        expect(completed.count).toBe(1);
        return createdDigest;
      });

      await expect(
        prisma.digestRun.updateMany({
          data: {
            completedAt: new Date("2026-08-09T12:00:01.003Z"),
            status: "FAILED",
          },
          where: smartDigestRunLeaseWhere(
            firstLease,
            new Date("2026-08-09T12:00:01.003Z"),
          ),
        }),
      ).resolves.toEqual({ count: 0 });

      await expect(
        Promise.all([
          prisma.smartDigest.count({ where: { runId: run.id } }),
          prisma.digestRun.findUniqueOrThrow({ where: { id: run.id } }),
          prisma.smartDigestRule.findUniqueOrThrow({ where: { id: rule.id } }),
        ]),
      ).resolves.toEqual([
        1,
        expect.objectContaining({
          attempt: 2,
          digestId: digest.id,
          leaseExpiresAt: null,
          leaseOwner: null,
          status: "COMPLETED",
        }),
        expect.objectContaining({
          contentWatermarkAt: finalizedAt,
          lastRunAt: finalizedAt,
        }),
      ]);
    },
  );
});
