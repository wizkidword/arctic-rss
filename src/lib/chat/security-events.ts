import { randomUUID } from "node:crypto"

import Redis from "ioredis"

import { redisConnectionOptions } from "@/lib/feed-refresh-queue"

export const CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL =
  "arctic-rss:chat:account-security-events:v1"

const ACCOUNT_SECURITY_EVENT_REASONS = [
  "password_reset",
  "auth_version_changed",
  "account_disabled",
  "role_changed",
  "plan_changed",
  "chat_access_revoked",
  "email_verification_changed",
  "policy_acceptance_invalidated",
] as const

export type AccountSecurityEventReason =
  (typeof ACCOUNT_SECURITY_EVENT_REASONS)[number]

export type AccountSecurityEvent = {
  authVersion?: number
  eventId: string
  occurredAt: string
  reason: AccountSecurityEventReason
  userId: string
  version: 1
}

export type AccountSecurityEventPublisher = {
  publish: (channel: string, message: string) => Promise<number>
}

let publisher: Redis | undefined

export function createAccountSecurityEvent({
  authVersion,
  eventId = randomUUID(),
  occurredAt = new Date(),
  reason,
  userId,
}: {
  authVersion?: number
  eventId?: string
  occurredAt?: Date
  reason: AccountSecurityEventReason
  userId: string
}): AccountSecurityEvent {
  return {
    ...(authVersion === undefined ? {} : { authVersion }),
    eventId,
    occurredAt: occurredAt.toISOString(),
    reason,
    userId,
    version: 1,
  }
}

export function parseAccountSecurityEvent(value: string): AccountSecurityEvent | null {
  try {
    const event = JSON.parse(value) as unknown

    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return null
    }

    const candidate = event as Partial<AccountSecurityEvent>
    const validAuthVersion =
      candidate.authVersion === undefined ||
      (Number.isInteger(candidate.authVersion) && candidate.authVersion >= 0)

    if (
      candidate.version !== 1 ||
      !isIdentifier(candidate.eventId) ||
      !isIdentifier(candidate.userId) ||
      !isSecurityEventReason(candidate.reason) ||
      typeof candidate.occurredAt !== "string" ||
      Number.isNaN(Date.parse(candidate.occurredAt)) ||
      !validAuthVersion
    ) {
      return null
    }

    return candidate as AccountSecurityEvent
  } catch {
    return null
  }
}

export async function notifyAccountSecurityChange(
  input: Omit<Parameters<typeof createAccountSecurityEvent>[0], "eventId" | "occurredAt">,
  {
    environment = process.env,
    publisher: suppliedPublisher,
  }: {
    environment?: Readonly<Record<string, string | undefined>>
    publisher?: AccountSecurityEventPublisher
  } = {}
) {
  if (!suppliedPublisher && !isChatSecurityEventPublishingEnabled(environment)) {
    return { delivered: false, skipped: true }
  }

  const event = createAccountSecurityEvent(input)

  try {
    await (suppliedPublisher ?? getAccountSecurityEventPublisher()).publish(
      CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL,
      JSON.stringify(event)
    )
    console.info(
      JSON.stringify({
        event: "chat_account_security_event_published",
        reason: event.reason,
      })
    )
    return { delivered: true, skipped: false }
  } catch {
    // Database authorization state is already authoritative. A gateway's bounded
    // fresh authorization check removes access if this best-effort signal is lost.
    console.warn(
      JSON.stringify({
        event: "chat_account_security_event_publish_failed",
        reason: event.reason,
      })
    )
    return { delivered: false, skipped: false }
  }
}

function getAccountSecurityEventPublisher() {
  if (!publisher || publisher.status === "end") {
    publisher = new Redis(redisConnectionOptions().url, {
      connectTimeout: 1_000,
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    publisher.on("error", () => {
      // Callers report a redacted structured failure and authorization fails closed.
    })
  }

  return publisher
}

function isChatSecurityEventPublishingEnabled(
  environment: Readonly<Record<string, string | undefined>>
) {
  return environment.ARCTIC_IRC_ENABLED?.trim().toLowerCase() === "true"
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

function isSecurityEventReason(value: unknown): value is AccountSecurityEventReason {
  return typeof value === "string" && ACCOUNT_SECURITY_EVENT_REASONS.includes(
    value as AccountSecurityEventReason
  )
}
