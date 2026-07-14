import "dotenv/config"

import { performance } from "node:perf_hooks"
import { pathToFileURL } from "node:url"

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"])

export type ChatGatewayLoadTestConfig = {
  concurrency: number
  durationMs: number
  maxFailures: number
  maxP95Ms: number
  target: URL
  timeoutMs: number
}

export type ChatGatewayLoadTestSummary = {
  failed: number
  p50Ms: number
  p95Ms: number
  requests: number
  statusCounts: Record<string, number>
  succeeded: number
}

export function getChatGatewayLoadTestConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): ChatGatewayLoadTestConfig {
  if (environment.ARCTIC_IRC_LOAD_TEST_CONFIRM !== "loopback-only") {
    throw new Error(
      "Set ARCTIC_IRC_LOAD_TEST_CONFIRM=loopback-only to run the loopback load test."
    )
  }

  const target = new URL(
    environment.ARCTIC_IRC_LOAD_TEST_URL?.trim() || "http://127.0.0.1:3001/ready"
  )

  if (!LOOPBACK_HOSTS.has(target.hostname.toLowerCase())) {
    throw new Error("The chat load test accepts loopback targets only.")
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("The chat load-test URL must use HTTP or HTTPS.")
  }

  return {
    concurrency: parsePositiveInteger(environment.ARCTIC_IRC_LOAD_TEST_CONCURRENCY, 10, 1, 100),
    durationMs:
      parsePositiveInteger(environment.ARCTIC_IRC_LOAD_TEST_DURATION_SECONDS, 30, 1, 300) *
      1_000,
    maxFailures: parsePositiveInteger(environment.ARCTIC_IRC_LOAD_TEST_MAX_FAILURES, 0, 0, 10_000),
    maxP95Ms: parsePositiveInteger(environment.ARCTIC_IRC_LOAD_TEST_MAX_P95_MS, 1_000, 1, 60_000),
    target,
    timeoutMs: parsePositiveInteger(environment.ARCTIC_IRC_LOAD_TEST_TIMEOUT_MS, 5_000, 100, 60_000),
  }
}

export async function runChatGatewayLoadTest(
  config: ChatGatewayLoadTestConfig
): Promise<ChatGatewayLoadTestSummary> {
  const deadline = performance.now() + config.durationMs
  const latencySamples: number[] = []
  const statusCounts = new Map<string, number>()
  let failed = 0
  let succeeded = 0

  await Promise.all(
    Array.from({ length: config.concurrency }, async () => {
      while (performance.now() < deadline) {
        const startedAt = performance.now()

        try {
          const response = await fetch(config.target, {
            cache: "no-store",
            signal: AbortSignal.timeout(config.timeoutMs),
          })
          latencySamples.push(performance.now() - startedAt)
          statusCounts.set(
            String(response.status),
            (statusCounts.get(String(response.status)) ?? 0) + 1
          )

          if (response.ok) {
            succeeded += 1
          } else {
            failed += 1
          }
        } catch {
          latencySamples.push(performance.now() - startedAt)
          statusCounts.set("network-error", (statusCounts.get("network-error") ?? 0) + 1)
          failed += 1
        }
      }
    })
  )

  return summarizeChatGatewayLoadTest({ failed, latencySamples, statusCounts, succeeded })
}

export function summarizeChatGatewayLoadTest({
  failed,
  latencySamples,
  statusCounts,
  succeeded,
}: {
  failed: number
  latencySamples: number[]
  statusCounts: Map<string, number>
  succeeded: number
}): ChatGatewayLoadTestSummary {
  const samples = [...latencySamples].sort((left, right) => left - right)

  return {
    failed,
    p50Ms: percentile(samples, 0.5),
    p95Ms: percentile(samples, 0.95),
    requests: succeeded + failed,
    statusCounts: Object.fromEntries([...statusCounts.entries()].sort()),
    succeeded,
  }
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  if (!value?.trim()) {
    return fallback
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Load-test configuration must be an integer from ${minimum} to ${maximum}.`)
  }

  return parsed
}

function percentile(samples: number[], percentileValue: number) {
  if (!samples.length) {
    return 0
  }

  return Math.round(samples[Math.min(samples.length - 1, Math.ceil(samples.length * percentileValue) - 1)] * 100) / 100
}

async function main() {
  const config = getChatGatewayLoadTestConfig()
  const summary = await runChatGatewayLoadTest(config)
  const passed = summary.failed <= config.maxFailures && summary.p95Ms <= config.maxP95Ms

  console.log(JSON.stringify({ event: "chat_gateway_load_test_complete", passed, summary }))

  if (!passed) {
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Chat gateway load test failed.")
    process.exitCode = 1
  })
}
