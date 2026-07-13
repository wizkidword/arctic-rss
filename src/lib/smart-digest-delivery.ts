import { getPrisma } from "./db"
import {
  sendSmartDigestEmail,
  type SmartDigestMailResult,
} from "./mail"
import type { SmartDigestForEmail } from "./smart-digest-processing"

export const SMART_DIGEST_EMAIL_MAX_ATTEMPTS = 3

type SmartDigestDeliveryRun = {
  digest: SmartDigestForEmail | null
  emailAttempts: number
  emailStatus: string | null
  id: string
  rule: {
    user: {
      email: string
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
    callback: (transaction: SmartDigestDeliveryStore) => Promise<T>
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
}

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

  // Do not put this acknowledgement in the send try/catch. If SMTP accepted
  // the message but the database acknowledgement fails, the run remains
  // PROCESSING and future retries skip it instead of sending another email.
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

  return { status: "SENT" }
}

export function smartDigestDeliveryMessageId(runId: string) {
  const domain = smartDigestMessageIdDomain()
  const localPart = runId.replace(/[^a-zA-Z0-9_-]/g, "-")

  return `<smart-digest-${localPart}@${domain}>`
}

function orderedDigestForEmail(digest: SmartDigestForEmail): SmartDigestForEmail {
  return {
    ...digest,
    items: [...digest.items].sort((first, second) => first.position - second.position),
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
    error instanceof Error ? error.message : "Smart Digest email delivery failed."

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

function smartDigestMessageIdDomain() {
  try {
    const appOrigin = process.env.APP_ORIGIN?.trim()
    return appOrigin ? new URL(appOrigin).hostname : "arcticrss.com"
  } catch {
    return "arcticrss.com"
  }
}
