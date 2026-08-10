import { randomUUID } from "node:crypto";

export const SMART_DIGEST_PROCESSING_LEASE_MS = 10 * 60 * 1_000;

export type SmartDigestRunLease = {
  attempt: number;
  id: string;
  leaseExpiresAt: Date;
  leaseOwner: string;
};

type SmartDigestRunLeaseRecord = {
  attempt: number;
  id: string;
  leaseExpiresAt: Date | null;
  leaseOwner: string | null;
  status: string;
};

type SmartDigestRunLeaseStore = {
  digestRun: {
    findUnique(args: {
      where: { id: string };
    }): Promise<SmartDigestRunLeaseRecord | null>;
    updateMany(args: {
      data: Record<string, unknown>;
      where: Record<string, unknown>;
    }): Promise<{ count: number }>;
  };
};

export async function claimSmartDigestRun({
  leaseDurationMs = SMART_DIGEST_PROCESSING_LEASE_MS,
  leaseOwner = randomUUID(),
  now = new Date(),
  runId,
  store,
}: {
  leaseDurationMs?: number;
  leaseOwner?: string;
  now?: Date;
  runId: string;
  store: SmartDigestRunLeaseStore;
}): Promise<SmartDigestRunLease | null> {
  const leaseExpiresAt = addMilliseconds(now, leaseDurationMs);
  const claimed = await store.digestRun.updateMany({
    data: {
      attempt: { increment: 1 },
      errorMessage: null,
      lastHeartbeatAt: now,
      leaseExpiresAt,
      leaseOwner,
      processingStartedAt: now,
      status: "PROCESSING",
    },
    where: {
      id: runId,
      OR: [
        { status: "PENDING" },
        { status: "FAILED" },
        {
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          status: "PROCESSING",
        },
      ],
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const run = await store.digestRun.findUnique({ where: { id: runId } });
  if (
    !run ||
    run.attempt < 1 ||
    run.leaseOwner !== leaseOwner ||
    !run.leaseExpiresAt ||
    run.leaseExpiresAt.getTime() !== leaseExpiresAt.getTime() ||
    run.status !== "PROCESSING"
  ) {
    return null;
  }

  return {
    attempt: run.attempt,
    id: run.id,
    leaseExpiresAt: run.leaseExpiresAt,
    leaseOwner,
  };
}

export async function renewSmartDigestRunLease({
  lease,
  leaseDurationMs = SMART_DIGEST_PROCESSING_LEASE_MS,
  now = new Date(),
  store,
}: {
  lease: SmartDigestRunLease;
  leaseDurationMs?: number;
  now?: Date;
  store: SmartDigestRunLeaseStore;
}) {
  const updated = await store.digestRun.updateMany({
    data: {
      lastHeartbeatAt: now,
      leaseExpiresAt: addMilliseconds(now, leaseDurationMs),
    },
    where: smartDigestRunLeaseWhere(lease, now),
  });

  return updated.count === 1;
}

export function smartDigestRunLeaseWhere(
  lease: Pick<SmartDigestRunLease, "attempt" | "id" | "leaseOwner">,
  now = new Date(),
) {
  return {
    attempt: lease.attempt,
    id: lease.id,
    leaseExpiresAt: { gt: now },
    leaseOwner: lease.leaseOwner,
    status: "PROCESSING" as const,
  };
}

export async function runWithSmartDigestRunLeaseHeartbeat<Result>({
  lease,
  now = () => new Date(),
  store,
  work,
}: {
  lease: SmartDigestRunLease;
  now?: () => Date;
  store: SmartDigestRunLeaseStore;
  work: () => Promise<Result>;
}) {
  let leaseHeld = true;
  let renewal = Promise.resolve();
  const heartbeat = setInterval(
    () => {
      renewal = renewal
        .then(async () => {
          if (!leaseHeld) {
            return;
          }

          leaseHeld = await renewSmartDigestRunLease({
            lease,
            now: now(),
            store,
          });
        })
        .catch(() => {
          leaseHeld = false;
        });
    },
    Math.max(1_000, Math.floor(SMART_DIGEST_PROCESSING_LEASE_MS / 2)),
  );

  heartbeat.unref?.();

  try {
    const result = await work();
    await renewal;
    if (leaseHeld) {
      leaseHeld = await renewSmartDigestRunLease({
        lease,
        now: now(),
        store,
      });
    }

    return { leaseHeld, result };
  } finally {
    clearInterval(heartbeat);
  }
}

function addMilliseconds(now: Date, durationMs: number) {
  return new Date(now.getTime() + Math.max(1_000, Math.floor(durationMs)));
}
