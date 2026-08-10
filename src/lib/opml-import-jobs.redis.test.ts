import { randomUUID } from "node:crypto";

import { Queue, type QueueOptions, Worker } from "bullmq";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enqueueFeedRefresh: vi.fn(),
  subscribeToFeed: vi.fn(),
}));

vi.mock("./feed-refresh-queue", () => ({
  enqueueFeedRefresh: mocks.enqueueFeedRefresh,
}));

vi.mock("./feed-subscriptions", () => ({
  FeedSubscriptionError: class FeedSubscriptionError extends Error {},
  subscribeToFeed: mocks.subscribeToFeed,
}));

const redisUrl = process.env.ARCTIC_RSS_TEST_REDIS_URL ?? "";
const redisDescribe = redisUrl ? describe : describe.skip;

redisDescribe("OPML import jobs with real Redis", () => {
  const userIds: string[] = [];
  const cleanup: Array<() => Promise<void>> = [];
  let priorDurableRedisUrl: string | undefined;

  afterEach(async () => {
    await Promise.allSettled(cleanup.splice(0).map((close) => close()));

    const { getPrisma } = await import("./db");
    if (userIds.length) {
      await getPrisma().user.deleteMany({
        where: { id: { in: userIds.splice(0) } },
      });
    }

    if (priorDurableRedisUrl === undefined) {
      delete process.env.DURABLE_REDIS_URL;
    } else {
      process.env.DURABLE_REDIS_URL = priorDurableRedisUrl;
    }
    mocks.enqueueFeedRefresh.mockReset();
    mocks.subscribeToFeed.mockReset();
    vi.resetModules();
  });

  it("makes duplicate BullMQ deliveries harmless while an entry lease is active", async () => {
    priorDurableRedisUrl = process.env.DURABLE_REDIS_URL;
    process.env.DURABLE_REDIS_URL = redisUrl;
    vi.resetModules();

    const [{ getPrisma }, queueModule, jobModule] = await Promise.all([
      import("./db"),
      import("./opml-import-queue"),
      import("./opml-import-jobs"),
    ]);
    const prisma = getPrisma();
    const connection: QueueOptions["connection"] = {
      maxRetriesPerRequest: null,
      url: redisUrl,
    };
    const inspector = new Queue(queueModule.OPML_IMPORT_QUEUE_NAME, {
      connection,
    });
    cleanup.push(async () => {
      await inspector.obliterate({ force: true });
      await inspector.close();
      await queueModule.closeOpmlImportQueue();
    });
    await inspector.obliterate({ force: true });

    const marker = randomUUID().replaceAll("-", "");
    const user = await prisma.user.create({
      data: { email: `opml-redis-${marker}@example.test` },
    });
    userIds.push(user.id);
    const importJob = await prisma.importJob.create({
      data: {
        status: "PENDING",
        totalFeeds: 1,
        userId: user.id,
      },
    });
    const entry = await prisma.importJobEntry.create({
      data: {
        importJobId: importJob.id,
        sequence: 0,
        title: "Example Feed",
        xmlUrl: `https://example.test/opml-redis-${marker}.xml`,
      },
    });

    let releaseSubscription: (() => void) | undefined;
    const subscriptionReleased = new Promise<void>((resolve) => {
      releaseSubscription = resolve;
    });
    let subscriptionStarted: (() => void) | undefined;
    const subscriptionStartedPromise = new Promise<void>((resolve) => {
      subscriptionStarted = resolve;
    });
    mocks.subscribeToFeed.mockImplementation(async () => {
      subscriptionStarted?.();
      await subscriptionReleased;
      return {
        feedId: "feed-1",
        initialArticleCount: 0,
      };
    });

    const outcomes = new Map<string, string>();
    const workers = Array.from(
      { length: 2 },
      () =>
        new Worker<{ jobId: string; run: number }, { status: string }>(
          queueModule.OPML_IMPORT_QUEUE_NAME,
          async (bullJob) => {
            const result = await jobModule.processOpmlImportJob({
              jobId: bullJob.data.jobId,
            });
            outcomes.set(String(bullJob.id), result.status);
            return result;
          },
          { connection, concurrency: 1 },
        ),
    );
    cleanup.push(async () => {
      releaseSubscription?.();
      await Promise.all(workers.map((worker) => worker.close(true)));
    });
    await Promise.all(workers.map((worker) => worker.waitUntilReady()));

    try {
      await Promise.all([
        queueModule.enqueueOpmlImportJob(importJob.id, 1),
        queueModule.enqueueOpmlImportJob(importJob.id, 2),
      ]);
      await subscriptionStartedPromise;
      await waitFor(() => outcomes.size === 1);
      expect(Array.from(outcomes.values())).toEqual(["PROCESSING"]);

      releaseSubscription?.();
      await waitFor(() => outcomes.size === 2);

      expect(mocks.subscribeToFeed).toHaveBeenCalledTimes(1);
      await expect(
        Promise.all([
          prisma.importJob.findUniqueOrThrow({ where: { id: importJob.id } }),
          prisma.importJobEntry.findUniqueOrThrow({ where: { id: entry.id } }),
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          addedFeeds: 1,
          failedFeeds: 0,
          processedFeeds: 1,
          skippedFeeds: 0,
          status: "COMPLETED",
        }),
        expect.objectContaining({ status: "ADDED" }),
      ]);
    } finally {
      releaseSubscription?.();
    }
  }, 20_000);
});

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error("Timed out waiting for the OPML queue state.");
}
