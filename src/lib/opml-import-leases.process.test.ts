import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { afterAll, describe, expect, test } from "vitest";

import { getPrisma } from "./db";

const databaseTest = process.env.CI ? test : test.skip;
const workerScriptPath = fileURLToPath(
  new URL("../../scripts/ci/opml-lease-process-worker.ts", import.meta.url),
);
const tsxCliPath = fileURLToPath(
  new URL("../../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

type WorkerEvent = {
  attempt?: number;
  event: "claimed" | "external_work_completed" | "finalized";
  finalized?: boolean;
  leaseExpiresAt?: string;
};

type LeaseWorker = {
  child: ChildProcess;
  events: WorkerEvent[];
  stderr: string[];
};

describe("OPML entry leases across worker processes", () => {
  const userIds: string[] = [];
  const workers: LeaseWorker[] = [];
  let prisma: ReturnType<typeof getPrisma> | null = null;

  afterAll(async () => {
    await Promise.all(workers.map((worker) => closeLeaseWorker(worker)));

    if (prisma && userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  databaseTest(
    "rejects a stalled worker's late finalization after another process reclaims the entry",
    async () => {
      prisma = getPrisma();
      const marker = randomUUID().replaceAll("-", "");
      const user = await prisma.user.create({
        data: { email: `opml-process-${marker}@example.test` },
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
          xmlUrl: `https://example.test/opml-process-${marker}.xml`,
        },
      });

      const stalledWorker = startLeaseWorker({
        importJobId: job.id,
        mode: "stalled-worker",
      });
      workers.push(stalledWorker);
      const firstClaim = await waitForEvent(stalledWorker, "claimed");
      expect(firstClaim).toMatchObject({ attempt: 1 });

      stalledWorker.child.stdin?.write("external work complete\n");
      await expect(
        waitForEvent(stalledWorker, "external_work_completed"),
      ).resolves.toMatchObject({ event: "external_work_completed" });

      const leaseExpiresAt = firstClaim.leaseExpiresAt;
      if (!leaseExpiresAt) {
        throw new Error("The stalled worker did not report its lease expiry.");
      }
      await sleep(
        Math.max(0, new Date(leaseExpiresAt).getTime() - Date.now() + 75),
      );

      const reclaimingWorker = startLeaseWorker({
        importJobId: job.id,
        mode: "reclaiming-worker",
      });
      workers.push(reclaimingWorker);
      await expect(
        waitForEvent(reclaimingWorker, "claimed"),
      ).resolves.toMatchObject({
        attempt: 2,
      });
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

      await Promise.all([
        closeLeaseWorker(stalledWorker),
        closeLeaseWorker(reclaimingWorker),
      ]);
    },
    15_000,
  );
});

function startLeaseWorker({
  importJobId,
  mode,
}: {
  importJobId: string;
  mode: "reclaiming-worker" | "stalled-worker";
}): LeaseWorker {
  const child = spawn(process.execPath, [tsxCliPath, workerScriptPath], {
    env: {
      ...process.env,
      OPML_LEASE_TEST_IMPORT_JOB_ID: importJobId,
      OPML_LEASE_TEST_LEASE_DURATION_MS: "1000",
      OPML_LEASE_TEST_MODE: mode,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const worker: LeaseWorker = { child, events: [], stderr: [] };
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
  worker: LeaseWorker,
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
        `OPML lease worker exited before ${event}: ${worker.stderr.join("")}`,
      );
    }

    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${event}: ${worker.stderr.join("")}`);
}

async function closeLeaseWorker(worker: LeaseWorker) {
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
