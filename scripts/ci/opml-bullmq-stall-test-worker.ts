import { Worker, type QueueOptions } from "bullmq";

import { getPrisma } from "../../src/lib/db";
import {
  claimOpmlImportEntry,
  finalizeOpmlImportEntry,
} from "../../src/lib/opml-import-leases";

const importJobId = process.env.OPML_STALL_TEST_IMPORT_JOB_ID;
const mode = process.env.OPML_STALL_TEST_MODE;
const queueName = process.env.OPML_STALL_TEST_QUEUE_NAME;
const redisUrl = process.env.ARCTIC_RSS_TEST_REDIS_URL;

if (
  (mode !== "stalled-worker" && mode !== "reclaiming-worker") ||
  !importJobId ||
  !queueName ||
  !redisUrl
) {
  throw new Error(
    "OPML BullMQ stall test worker received invalid configuration.",
  );
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function run() {
  const prisma = getPrisma();
  const connection: QueueOptions["connection"] = {
    maxRetriesPerRequest: null,
    url: redisUrl,
  };
  let finish: (() => void) | undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const worker = new Worker<{ importJobId: string }>(
    queueName!,
    async (job) => {
      const lease = await claimOpmlImportEntry({
        importJobId: job.data.importJobId,
        leaseDurationMs: 1_000,
        leaseOwner: mode,
        store: prisma,
      });

      if (!lease) {
        writeEvent({ event: "no_entry" });
        finish?.();
        return;
      }

      writeEvent({
        attempt: lease.attempt,
        event: "claimed",
        leaseExpiresAt: lease.leaseExpiresAt.toISOString(),
      });

      if (mode === "stalled-worker") {
        writeEvent({ event: "external_work_completed" });
        blockEventLoop(2_500);
      }

      const finalized = await finalizeOpmlImportEntry({
        errorMessage: null,
        lease,
        status: "ADDED",
        store: prisma,
      });
      writeEvent({ event: "finalized", finalized });
      finish?.();
      return { finalized };
    },
    {
      connection,
      lockDuration: 1_000,
      maxStalledCount: 1,
      stalledInterval: 500,
    },
  );

  try {
    await worker.waitUntilReady();
    writeEvent({ event: "ready" });
    await finished;
  } finally {
    await worker.close(true);
    process.stdin.destroy();
    await prisma.$disconnect();
  }
}

function writeEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

function blockEventLoop(durationMs: number) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, durationMs);
}
