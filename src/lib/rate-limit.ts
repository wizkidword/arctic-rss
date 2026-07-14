import { createHash } from "node:crypto"
import { isIP } from "node:net"

import Redis from "ioredis"
import { headers } from "next/headers"

import { redisConnectionOptions } from "./feed-refresh-queue"

const RATE_LIMIT_NAMESPACE = "arctic-rss:rate-limit:v1"

const incrementWithExpiryScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return { current, redis.call("PTTL", KEYS[1]) }
`

type RateLimitRule = {
  limit: number
  scope: string
  subject: (input: RateLimitInput) => string | null
  windowMs: number
}

export type RateLimitAction =
  | "account_deletion_reauthentication"
  | "admin_opml_import"
  | "ai_digest"
  | "ai_summary"
  | "chat_message"
  | "chat_moderation"
  | "chat_report"
  | "feed_discovery"
  | "feedback"
  | "image_proxy"
  | "login"
  | "opml_import"
  | "password_reset_complete"
  | "password_reset_request"
  | "signup"
  | "verification_resend"

export type RateLimitInput = {
  account?: string | null
  action: RateLimitAction
  ip?: string | null
  token?: string | null
  userId?: string | null
}

export type RateLimitResult =
  | { allowed: true }
  | {
      allowed: false
      reason: "identifier-unavailable" | "limited" | "unavailable"
      retryAfterSeconds?: number
      scope?: string
    }

export type RateLimitStore = {
  eval: (
    script: string,
    numberOfKeys: number,
    ...args: Array<number | string>
  ) => Promise<unknown>
}

export type RateLimitDependencies = {
  store?: RateLimitStore
}

const inputSubject = (name: "account" | "ip" | "token" | "userId") =>
  (input: RateLimitInput) => normalizeIdentifier(input[name])

const combinedSubject = (
  ...names: Array<"account" | "ip" | "token" | "userId">
) =>
  (input: RateLimitInput) => {
    const values = names.map((name) => normalizeIdentifier(input[name]))

    return values.every(Boolean) ? values.join(":") : null
  }

const rateLimitRules: Record<RateLimitAction, RateLimitRule[]> = {
  account_deletion_reauthentication: [
    { limit: 5, scope: "user", subject: inputSubject("userId"), windowMs: 15 * 60_000 },
    {
      limit: 5,
      scope: "user-ip",
      subject: combinedSubject("userId", "ip"),
      windowMs: 15 * 60_000,
    },
  ],
  admin_opml_import: [
    { limit: 3, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  ai_digest: [
    { limit: 6, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  ai_summary: [
    { limit: 30, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  chat_message: [
    { limit: 30, scope: "user", subject: inputSubject("userId"), windowMs: 60_000 },
  ],
  chat_moderation: [
    { limit: 30, scope: "user", subject: inputSubject("userId"), windowMs: 60_000 },
  ],
  chat_report: [
    { limit: 6, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  feed_discovery: [
    { limit: 20, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  feedback: [
    { limit: 8, scope: "user", subject: inputSubject("userId"), windowMs: 24 * 60 * 60_000 },
  ],
  image_proxy: [
    { limit: 120, scope: "ip", subject: inputSubject("ip"), windowMs: 5 * 60_000 },
  ],
  login: [
    { limit: 25, scope: "ip", subject: inputSubject("ip"), windowMs: 15 * 60_000 },
    { limit: 12, scope: "account", subject: inputSubject("account"), windowMs: 15 * 60_000 },
    {
      limit: 6,
      scope: "account-ip",
      subject: combinedSubject("account", "ip"),
      windowMs: 15 * 60_000,
    },
  ],
  opml_import: [
    { limit: 6, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
  password_reset_complete: [
    { limit: 12, scope: "ip", subject: inputSubject("ip"), windowMs: 60 * 60_000 },
    { limit: 4, scope: "token", subject: inputSubject("token"), windowMs: 60 * 60_000 },
  ],
  password_reset_request: [
    { limit: 10, scope: "ip", subject: inputSubject("ip"), windowMs: 60 * 60_000 },
    { limit: 4, scope: "account", subject: inputSubject("account"), windowMs: 60 * 60_000 },
    {
      limit: 3,
      scope: "account-ip",
      subject: combinedSubject("account", "ip"),
      windowMs: 60 * 60_000,
    },
  ],
  signup: [
    { limit: 6, scope: "ip", subject: inputSubject("ip"), windowMs: 60 * 60_000 },
    { limit: 3, scope: "account", subject: inputSubject("account"), windowMs: 60 * 60_000 },
    {
      limit: 3,
      scope: "account-ip",
      subject: combinedSubject("account", "ip"),
      windowMs: 60 * 60_000,
    },
  ],
  verification_resend: [
    { limit: 3, scope: "user", subject: inputSubject("userId"), windowMs: 60 * 60_000 },
  ],
}

let redis: Redis | undefined

function normalizeIdentifier(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()

  return normalized || null
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function makeRateLimitKey(
  action: RateLimitAction,
  scope: string,
  subject: string
) {
  return `${RATE_LIMIT_NAMESPACE}:${action}:${scope}:${hashIdentifier(subject)}`
}

function getRateLimitStore() {
  if (!redis || redis.status === "end") {
    redis = new Redis(redisConnectionOptions().url, {
      connectTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    redis.on("error", () => {
      // Limiter failures are handled by enforceRateLimit without exposing Redis details.
    })
  }

  return redis
}

function parseCounterResult(value: unknown) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Invalid Redis rate-limit response.")
  }

  const count = Number(value[0])
  const ttlMs = Number(value[1])

  if (!Number.isFinite(count) || !Number.isFinite(ttlMs)) {
    throw new Error("Invalid Redis rate-limit counter.")
  }

  return { count, ttlMs }
}

function logRateLimitRejection(
  input: RateLimitInput,
  result: Extract<RateLimitResult, { allowed: false }>
) {
  console.warn(
    JSON.stringify({
      action: input.action,
      event: "rate_limit_rejected",
      reason: result.reason,
      retryAfterSeconds: result.retryAfterSeconds,
      scope: result.scope,
    })
  )
}

export function getTrustedClientIp(requestHeaders: Headers) {
  const value = requestHeaders.get("cf-connecting-ip")?.trim()

  if (!value || isIP(value) === 0) {
    return null
  }

  return value.toLowerCase()
}

export async function getCurrentRequestIp() {
  return getTrustedClientIp(await headers())
}

export function getRateLimitErrorMessage() {
  return "Too many requests. Please wait a few minutes and try again."
}

export async function enforceRateLimit(
  input: RateLimitInput,
  dependencies: RateLimitDependencies = {}
): Promise<RateLimitResult> {
  const rules = rateLimitRules[input.action]
  const applicableRules = rules
    .map((rule) => ({ rule, subject: rule.subject(input) }))
    .filter(
      (
        value
      ): value is {
        rule: RateLimitRule
        subject: string
      } => Boolean(value.subject)
    )

  if (!applicableRules.length) {
    const result: RateLimitResult = {
      allowed: false,
      reason: "identifier-unavailable",
    }
    logRateLimitRejection(input, result)
    return result
  }

  const store = dependencies.store ?? getRateLimitStore()

  try {
    for (const { rule, subject } of applicableRules) {
      const counter = parseCounterResult(
        await store.eval(
          incrementWithExpiryScript,
          1,
          makeRateLimitKey(input.action, rule.scope, subject),
          rule.windowMs
        )
      )

      if (counter.count > rule.limit) {
        const result: RateLimitResult = {
          allowed: false,
          reason: "limited",
          retryAfterSeconds: Math.max(1, Math.ceil(counter.ttlMs / 1_000)),
          scope: rule.scope,
        }
        logRateLimitRejection(input, result)
        return result
      }
    }
  } catch {
    const result: RateLimitResult = {
      allowed: false,
      reason: "unavailable",
    }
    logRateLimitRejection(input, result)
    return result
  }

  return { allowed: true }
}
