import { getPrisma } from "../../src/lib/db";
import {
  claimOpmlImportEntry,
  finalizeOpmlImportEntry,
} from "../../src/lib/opml-import-leases";

const mode = process.env.OPML_LEASE_TEST_MODE;
const importJobId = process.env.OPML_LEASE_TEST_IMPORT_JOB_ID;
const leaseDurationMs = Number(process.env.OPML_LEASE_TEST_LEASE_DURATION_MS);

if (
  (mode !== "stalled-worker" && mode !== "reclaiming-worker") ||
  !importJobId ||
  !Number.isFinite(leaseDurationMs) ||
  leaseDurationMs < 1_000
) {
  throw new Error(
    "OPML lease process test worker received invalid configuration.",
  );
}

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function run() {
  const prisma = getPrisma();

  try {
    const lease = await claimOpmlImportEntry({
      importJobId: importJobId!,
      leaseDurationMs,
      leaseOwner: mode,
      store: prisma,
    });

    if (!lease) {
      throw new Error(
        "The OPML lease process test worker could not claim an entry.",
      );
    }

    writeEvent({
      attempt: lease.attempt,
      event: "claimed",
      leaseExpiresAt: lease.leaseExpiresAt.toISOString(),
    });

    if (mode === "stalled-worker") {
      await waitForCoordinatorSignal();
      writeEvent({ event: "external_work_completed" });
      await sleep(leaseDurationMs + 500);
    }

    const finalized = await finalizeOpmlImportEntry({
      errorMessage: null,
      lease,
      status: "ADDED",
      store: prisma,
    });
    writeEvent({ event: "finalized", finalized });
  } finally {
    process.stdin.destroy();
    await prisma.$disconnect();
  }
}

function writeEvent(event: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

async function waitForCoordinatorSignal() {
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}
