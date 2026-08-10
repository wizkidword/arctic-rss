import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { Queue, type QueueOptions } from "bullmq";
import { afterAll, describe, expect, test } from "vitest";

import { getPrisma } from "./db";

const redisUrl = process.env.ARCTIC_RSS_TEST_REDIS_URL ?? "";
const stallTest = process.env.CI && redisUrl ? test : test.skip;
const workerScriptPath = fileURLToPath(
  new URL("../../scripts/ci/opml-bullmq-stall-test-worker.ts", import.meta.url),
);
const tsxCliPath = fileURLToPath(
  new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

type WorkerEvent = {
  attempt?: number;
  event:
    "claimed" | "external_work_completed" | "finalized" | "no_entry" | "ready";
  finalized?: boolean;
};

type StallWorker = {
  child: ChildProcess;
  events: WorkerEvent[];
  stderr: string[];
};

describe("OPML import BullMQ stalled-lock recovery", () => {
  const userIds: string[] = [];
  const workers: StallWorker[] = [];
  const queues: Queue[] = [];
  let prisma: ReturnType<typeof getPrisma> | null = null;

  afterAll(async () => {
    await Promise.all(workers.map((worker) => closeWorker(worker)));
    await Promise.all(
      queues.map(async (queue) => {
        await queue.obliterate({ force: true });
        await queue.close();
      }),
    );
    if (prisma && userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  stallTest(
    "replays a lost BullMQ lock without accepting the stalled worker's late finalization",
    async () => {
      prisma = getPrisma();
      const marker = randomUUID().replaceAll("-", "");
      const user = await prisma.user.create({
        data: { email: `opml-stall-${marker}@example.test` },
      });
      userIds.push(user.id);
      const job = await prisma.importJob.create({
        data: {
          status: "PENDING",
          totalFeeds: 1,
          userId: user.id,
        },
      });
      const entry = await prisma.importJobEntry.create({
        data: {
          importJobId: job.id,
          sequence: 0,
          title: "Example Feed",
          xmlUrl: `https://example.test/opml-stall-${marker}.xml`,
        },
      });
      const queueName = `opml-stall-test-${marker}`;
      const connection: QueueOptions["connection"] = {
        maxRetriesPerRequest: null,
        url: redisUrl,
      };
      const queue = new Queue<{ importJobId: string }>(queueName, {
        connection,
      });
      queues.push(queue);

      const stalledWorker = startWorker({
        importJobId: job.id,
        mode: "stalled-worker",
        queueName,
      });
      workers.push(stalledWorker);
      await expect(waitForEvent(stalledWorker, "ready")).resolves.toMatchObject(
        {
          event: "ready",
        },
      );

      await queue.add("import-opml", { importJobId: job.id });
      await expect(
        waitForEvent(stalledWorker, "claimed"),
      ).resolves.toMatchObject({
        attempt: 1,
      });
      await expect(
        waitForEvent(stalledWorker, "external_work_completed"),
      ).resolves.toMatchObject({ event: "external_work_completed" });

      const reclaimingWorker = startWorker({
        importJobId: job.id,
        mode: "reclaiming-worker",
        queueName,
      });
      workers.push(reclaimingWorker);
      await expect(
        waitForEvent(reclaimingWorker, "ready"),
      ).resolves.toMatchObject({ event: "ready" });
      await expect(
        waitForEvent(reclaimingWorker, "claimed", 12_000),
      ).resolves.toMatchObject({ attempt: 2 });
      await expect(
        waitForEvent(reclaimingWorker, "finalized"),
      ).resolves.toMatchObject({
        finalized: true,
      });
      await expect(
        waitForEvent(stalledWorker, "finalized"),
      ).resolves.toMatchObject({
        finalized: false,
      });

      await expect(
        Promise.all([
          prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }),
          prisma.importJobEntry.findUniqueOrThrow({ where: { id: entry.id } }),
        ]),
      ).resolves.toEqual([
        expect.objectContaining({
          addedFeeds: 1,
          failedFeeds: 0,
          processedFeeds: 1,
          skippedFeeds: 0,
        }),
        expect.objectContaining({
          attempt: 2,
          leaseExpiresAt: null,
          leaseOwner: null,
          status: "ADDED",
        }),
      ]);
    },
    20_000,
  );
});

function startWorker({
  importJobId,
  mode,
  queueName,
}: {
  importJobId: string;
  mode: "reclaiming-worker" | "stalled-worker";
  queueName: string;
}): StallWorker {
  const child = spawn(process.execPath, [tsxCliPath, workerScriptPath], {
    env: {
      ...process.env,
      OPML_STALL_TEST_IMPORT_JOB_ID: importJobId,
      OPML_STALL_TEST_MODE: mode,
      OPML_STALL_TEST_QUEUE_NAME: queueName,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const worker: StallWorker = { child, events: [], stderr: [] };
  let stdoutBuffer = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      worker.events.push(JSON.parse(line) as WorkerEvent);
    }
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    worker.stderr.push(chunk.toString());
  });

  return worker;
}

async function waitForEvent(
  worker: StallWorker,
  event: WorkerEvent["event"],
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const matchingEvent = worker.events.find(
      (candidate) => candidate.event === event,
    );
    if (matchingEvent) {
      return matchingEvent;
    }
    if (worker.child.exitCode !== null) {
      throw new Error(
        `OPML stalled-lock worker exited before ${event}: ${worker.stderr.join("")}`,
      );
    }

    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${event}: ${worker.stderr.join("")}`);
}

async function closeWorker(worker: StallWorker) {
  if (worker.child.exitCode !== null) {
    return;
  }

  const exited = new Promise<void>((resolve) => {
    worker.child.once("exit", () => resolve());
  });
  worker.child.stdin?.end();
  worker.child.kill();
  await exited;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
