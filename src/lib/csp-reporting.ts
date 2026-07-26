import { createHash } from "node:crypto"

import Redis from "ioredis"

import type { CspViolationReport } from "./content-security-policy"
import { ephemeralRedisConnectionOptions } from "./redis-config"

const CSP_REPORT_NAMESPACE = "arctic-rss:csp-report:v1"
const CSP_REPORT_SIGNATURE_TTL_MS = 24 * 60 * 60_000

const incrementWithExpiryScript = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`

export type CspReportCounterStore = {
  eval: (
    script: string,
    numberOfKeys: number,
    ...args: Array<number | string>
  ) => Promise<unknown>
}

export type CspReportAggregationDependencies = {
  store?: CspReportCounterStore
}

export type CspViolationAggregate = {
  count: number
  directive: string
  source: string
}

let redis: Redis | undefined

export async function aggregateCspViolationReports(
  reports: readonly CspViolationReport[],
  dependencies: CspReportAggregationDependencies = {}
) {
  const store = dependencies.store ?? getCspReportCounterStore()
  const aggregates: CspViolationAggregate[] = []

  for (const report of reports) {
    const directive = report.effectiveDirective ?? report.violatedDirective ?? "unknown"
    const source = report.blockedUri ?? "unknown"
    const count = parseCounterResult(
      await store.eval(
        incrementWithExpiryScript,
        1,
        cspReportSignatureKey(directive, source),
        CSP_REPORT_SIGNATURE_TTL_MS
      )
    )

    if (isCspViolationSample(count)) {
      aggregates.push({ count, directive, source })
    }
  }

  return aggregates
}

export function isCspViolationSample(count: number) {
  return count === 1 || /^10*$/.test(String(count))
}

function cspReportSignatureKey(directive: string, source: string) {
  const signature = createHash("sha256")
    .update(`${directive}\u0000${source}`)
    .digest("hex")

  return `${CSP_REPORT_NAMESPACE}:signature:${signature}`
}

function getCspReportCounterStore() {
  if (!redis || redis.status === "end") {
    redis = new Redis(ephemeralRedisConnectionOptions().url, {
      connectTimeout: 1_000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    })
    redis.on("error", () => {
      // Request handling fails safely without exposing Redis details to browsers.
    })
  }

  return redis
}

function parseCounterResult(value: unknown) {
  const count = Number(value)

  if (!Number.isInteger(count) || count < 1) {
    throw new Error("Invalid CSP report counter.")
  }

  return count
}
