import {
  getBackgroundEligibility,
  type BackgroundEligibilityStore,
} from "./background-eligibility"
import { getPrisma } from "./db"
import { sendSmartDigestEmail, type SmartDigestMailResult } from "./mail"
import type { SmartDigestForEmail } from "./smart-digest-processing"

export const SMART_DIGEST_EMAIL_MAX_ATTEMPTS = 3
export const SMART_DIGEST_DELIVERY_UNKNOWN_MESSAGE =
  "SMTP accepted the Smart Digest email, but its database acknowledgement was not recorded. Operator reconciliation is required before any retry."

type SmartDigestDeliveryRun = {
  digest: SmartDigestForEmail | null
  emailAttempts: number
  emailStatus: string | null
  id: string
  rule: {
    user: {
      email: string
      id: string
    } | null
  } | null
}

export type SendSmartDigestDelivery = ({
  digest,
  messageId,
  to,
}: {
  digest: SmartDigestForEmail
  messageId: string
  to: string
}) => Promise<SmartDigestMailResult>

export type SmartDigestDeliveryStore = {
  $transaction<T>(
    callback: (transaction: SmartDigestDeliveryStore) => Promise<T>,
  ): Promise<T>
  digestRun: {
    findUnique(args: {
      include: {
        digest: {
          include: {
            items: true
          }
        }
        rule: {
          include: {
            user: {
              select: {
                email: true
                id: true
              }
            }
          }
        }
      }
      where: { id: string }
    }): Promise<SmartDigestDeliveryRun | null>
    update(args: {
      data: Record<string, unknown>
      where: { id: string }
    }): Promise<unknown>
    updateMany(args: {
      data: Record<string, unknown>
      where: Record<string, unknown>
    }): Promise<{ count: number }>
  }
  smartDigest: {
    update(args: {
      data: Record<string, unknown>
      where: { id: string }
    }): Promise<unknown>
  }
} & BackgroundEligibilityStore

export type SmartDigestDeliveryResult = {
  status: "SENT" | "SKIPPED"
}

/**
 * Sends a completed digest once. The delivery row is claimed before the SMTP
 * request; an interrupted worker leaves it PROCESSING rather than guessing
 * whether the provider accepted the message and sending a duplicate.
 */
export async function processSmartDigestEmailDelivery({
  runId,
}: {
  runId: string
}): Promise<SmartDigestDeliveryResult> {
  return processSmartDigestEmailDeliveryWithClient({
    now: new Date(),
    runId,
    sendDigestEmail: sendSmartDigestEmail,
    store: getPrisma() as unknown as SmartDigestDeliveryStore,
  })
}

export async function processSmartDigestEmailDeliveryWithClient({
  now,
  runId,
  sendDigestEmail,
  store,
}: {
  now: Date
  runId: string
  sendDigestEmail: SendSmartDigestDelivery
  store: SmartDigestDeliveryStore
}): Promise<SmartDigestDeliveryResult> {
  const run = await store.digestRun.findUnique({
    include: {
      digest: {
        include: {
          items: true,
        },
      },
      rule: {
        include: {
          user: {
            select: {
              email: true,
              id: true,
            },
          },
        },
      },
    },
    where: { id: runId },
  })

  if (
    !run?.digest ||
    !run.rule?.user ||
    (run.emailStatus !== "PENDING" && run.emailStatus !== "FAILED")
  ) {
    return { status: "SKIPPED" }
  }

  const eligibility = await getBackgroundEligibility({
    store,
    userId: run.rule.user.id,
  })
  if (!eligibility.emailAllowed) {
    await recordIneligibleDelivery({ run, store })
    return { status: "SKIPPED" }
  }

  const messageId = smartDigestDeliveryMessageId(run.id)
  const claimed = await store.digestRun.updateMany({
    data: {
      emailAttemptedAt: now,
      emailAttempts: { increment: 1 },
      emailErrorMessage: null,
      emailStatus: "PROCESSING",
      providerMessageId: messageId,
    },
    where: {
      emailAttempts: {
        lt: SMART_DIGEST_EMAIL_MAX_ATTEMPTS,
      },
      emailStatus: {
        in: ["PENDING", "FAILED"],
      },
      id: run.id,
    },
  })

  if (claimed.count === 0) {
    return { status: "SKIPPED" }
  }

  let providerResult: SmartDigestMailResult

  try {
    providerResult = await sendDigestEmail({
      digest: orderedDigestForEmail(run.digest),
      messageId,
      to: run.rule.user.email,
    })
  } catch (error) {
    await recordFailedDelivery({
      error,
      run,
      store,
    })
    throw error
  }

  if (providerResult.status !== "sent") {
    const error = new Error("Smart Digest email delivery is not configured.")
    await recordFailedDelivery({
      error,
      run,
      store,
    })
    throw error
  }

  try {
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
          providerMessageId: providerResult.providerMessageId || messageId,
        },
        where: { id: run.id },
      })
    })
  } catch {
    // SMTP may already have accepted the message. Do not throw and let BullMQ
    // retry the send; make the uncertainty visible when the database is back.
    try {
      await recordUnknownDelivery({
        providerMessageId: providerResult.providerMessageId || messageId,
        run,
        store,
      })
    } catch {
      // A database outage can prevent even the status marker. The existing
      // PROCESSING row remains conservative and the worker still does not resend.
    }

    return { status: "SKIPPED" }
  }

  return { status: "SENT" }
}

async function recordIneligibleDelivery({
  run,
  store,
}: {
  run: SmartDigestDeliveryRun
  store: SmartDigestDeliveryStore
}) {
  await store.$transaction(async (transaction) => {
    await transaction.smartDigest.update({
      data: {
        emailErrorMessage:
          "Account is no longer eligible for Smart Digest email delivery.",
        emailStatus: "NOT_REQUESTED",
      },
      where: { id: run.digest!.id },
    })
    await transaction.digestRun.update({
      data: {
        emailErrorMessage:
          "Account is no longer eligible for Smart Digest email delivery.",
        emailStatus: "NOT_REQUESTED",
      },
      where: { id: run.id },
    })
  })
}

export function smartDigestDeliveryMessageId(runId: string) {
  const domain = smartDigestMessageIdDomain()
  const localPart = runId.replace(/[^a-zA-Z0-9_-]/g, "-")

  return `<smart-digest-${localPart}@${domain}>`
}

function orderedDigestForEmail(
  digest: SmartDigestForEmail,
): SmartDigestForEmail {
  return {
    ...digest,
    items: [...digest.items].sort(
      (first, second) => first.position - second.position,
    ),
  }
}

async function recordFailedDelivery({
  error,
  run,
  store,
}: {
  error: unknown
  run: SmartDigestDeliveryRun
  store: SmartDigestDeliveryStore
}) {
  const message =
    error instanceof Error
      ? error.message
      : "Smart Digest email delivery failed."

  await store.$transaction(async (transaction) => {
    await transaction.smartDigest.update({
      data: {
        emailErrorMessage: "Smart Digest email delivery failed.",
        emailStatus: "FAILED",
      },
      where: { id: run.digest!.id },
    })
    await transaction.digestRun.update({
      data: {
        emailErrorMessage: message,
        emailStatus: "FAILED",
        errorMessage: null,
        processingStartedAt: null,
      },
      where: { id: run.id },
    })
  })
}

async function recordUnknownDelivery({
  providerMessageId,
  run,
  store,
}: {
  providerMessageId: string
  run: SmartDigestDeliveryRun
  store: SmartDigestDeliveryStore
}) {
  await store.$transaction(async (transaction) => {
    await transaction.smartDigest.update({
      data: {
        emailErrorMessage: SMART_DIGEST_DELIVERY_UNKNOWN_MESSAGE,
        emailStatus: "DELIVERY_UNKNOWN",
      },
      where: { id: run.digest!.id },
    })
    await transaction.digestRun.update({
      data: {
        emailErrorMessage: SMART_DIGEST_DELIVERY_UNKNOWN_MESSAGE,
        emailStatus: "DELIVERY_UNKNOWN",
        providerMessageId,
      },
      where: { id: run.id },
    })
  })
}

function smartDigestMessageIdDomain() {
  try {
    const appOrigin = process.env.APP_ORIGIN?.trim()
    return appOrigin ? new URL(appOrigin).hostname : "arcticrss.com"
  } catch {
    return "arcticrss.com"
  }
}
