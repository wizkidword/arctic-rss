import { getPrisma } from "./db"
import { enqueueSmartDigestEmail } from "./smart-digest-email-queue"

export const SMART_DIGEST_DELIVERY_RETRY_CONFIRMED_MESSAGE =
  "An operator confirmed that the prior Smart Digest email was not delivered. A retry was explicitly authorized."

type SmartDigestDeliveryReconciliationRun = {
  digest: { id: string } | null
  emailStatus: string | null
  id: string
  providerMessageId: string | null
}

export type SmartDigestDeliveryReconciliationStore = {
  $transaction<T>(
    callback: (
      transaction: SmartDigestDeliveryReconciliationStore,
    ) => Promise<T>,
  ): Promise<T>
  digestRun: {
    findUnique(args: {
      include: { digest: { select: { id: true } } }
      where: { id: string }
    }): Promise<SmartDigestDeliveryReconciliationRun | null>
    update(args: {
      data: Record<string, unknown>
      where: { id: string }
    }): Promise<unknown>
  }
  smartDigest: {
    update(args: {
      data: Record<string, unknown>
      where: { id: string }
    }): Promise<unknown>
  }
}

export type SmartDigestDeliveryReconciliationResult = {
  emailStatus: string | null
  providerMessageId: string | null
  runId: string
  status: "RECONCILED" | "SKIPPED"
}

export async function inspectSmartDigestEmailDelivery({
  runId,
}: {
  runId: string
}) {
  return inspectSmartDigestEmailDeliveryWithStore({
    runId,
    store: getPrisma() as unknown as SmartDigestDeliveryReconciliationStore,
  })
}

export async function inspectSmartDigestEmailDeliveryWithStore({
  runId,
  store,
}: {
  runId: string
  store: SmartDigestDeliveryReconciliationStore
}) {
  return store.digestRun.findUnique({
    include: { digest: { select: { id: true } } },
    where: { id: runId },
  })
}

export async function reconcileSmartDigestEmailDelivery({
  decision,
  runId,
}: {
  decision: "CONFIRM_DELIVERED" | "CONFIRM_NOT_DELIVERED"
  runId: string
}): Promise<SmartDigestDeliveryReconciliationResult> {
  return reconcileSmartDigestEmailDeliveryWithClient({
    decision,
    enqueueEmail: enqueueSmartDigestEmail,
    now: new Date(),
    runId,
    store: getPrisma() as unknown as SmartDigestDeliveryReconciliationStore,
  })
}

export async function reconcileSmartDigestEmailDeliveryWithClient({
  decision,
  enqueueEmail,
  now,
  runId,
  store,
}: {
  decision: "CONFIRM_DELIVERED" | "CONFIRM_NOT_DELIVERED"
  enqueueEmail: (runId: string) => Promise<unknown>
  now: Date
  runId: string
  store: SmartDigestDeliveryReconciliationStore
}): Promise<SmartDigestDeliveryReconciliationResult> {
  const run = await inspectSmartDigestEmailDeliveryWithStore({ runId, store })

  if (
    !run?.digest ||
    (run.emailStatus !== "DELIVERY_UNKNOWN" && run.emailStatus !== "PROCESSING")
  ) {
    return {
      emailStatus: run?.emailStatus ?? null,
      providerMessageId: run?.providerMessageId ?? null,
      runId,
      status: "SKIPPED",
    }
  }

  if (decision === "CONFIRM_DELIVERED") {
    await store.$transaction(async (transaction) => {
      await transaction.smartDigest.update({
        data: {
          emailErrorMessage: null,
          emailedAt: now,
          emailStatus: "SENT",
        },
        where: { id: run.digest!.id },
      })
      await transaction.digestRun.update({
        data: {
          emailDeliveredAt: now,
          emailErrorMessage: null,
          emailStatus: "SENT",
        },
        where: { id: run.id },
      })
    })

    return {
      emailStatus: "SENT",
      providerMessageId: run.providerMessageId,
      runId,
      status: "RECONCILED",
    }
  }

  await store.$transaction(async (transaction) => {
    await transaction.smartDigest.update({
      data: {
        emailErrorMessage: SMART_DIGEST_DELIVERY_RETRY_CONFIRMED_MESSAGE,
        emailStatus: "PENDING",
      },
      where: { id: run.digest!.id },
    })
    await transaction.digestRun.update({
      data: {
        emailAttempts: 0,
        emailErrorMessage: SMART_DIGEST_DELIVERY_RETRY_CONFIRMED_MESSAGE,
        emailStatus: "PENDING",
      },
      where: { id: run.id },
    })
  })
  await enqueueEmail(run.id)

  return {
    emailStatus: "PENDING",
    providerMessageId: run.providerMessageId,
    runId,
    status: "RECONCILED",
  }
}
