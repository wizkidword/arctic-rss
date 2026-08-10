import { randomUUID } from "node:crypto"
import { performance } from "node:perf_hooks"
import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

import { PrismaPg } from "@prisma/adapter-pg"
import { encode } from "@auth/core/jwt"
import { chromium } from "playwright"

import { PrismaClient } from "../src/generated/prisma/client"
import { listArticleCollectionsForUser } from "../src/lib/article-collections"
import { getReaderCounts } from "../src/lib/articles"
import { getCurrentBulkReadJobForUser } from "../src/lib/bulk-read-jobs"
import { getPrisma } from "../src/lib/db"
import { listDiscoverInterestNavigation } from "../src/lib/discover-interests"
import { listUserFeedNavigation } from "../src/lib/feed-subscriptions"
import { listUserFolders } from "../src/lib/folders"
import { getOrCreateUserSettings } from "../src/lib/user-settings"

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"])
const SCALE_COUNTS = [10, 100, 200] as const
const SESSION_COOKIE_NAME = "authjs.session-token"

export type ReaderShellBenchmarkConfig = {
  databaseUrl: string
  port: number
}

type QueryEvent = {
  duration: number
}

type QueryEventEmitter = {
  $on(event: "query", listener: (event: QueryEvent) => void): void
}

export function getReaderShellBenchmarkConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): ReaderShellBenchmarkConfig {
  if (environment.ARCTIC_RSS_SHELL_BENCHMARK_CONFIRM !== "disposable") {
    throw new Error(
      "Set ARCTIC_RSS_SHELL_BENCHMARK_CONFIRM=disposable to run the disposable reader-shell benchmark."
    )
  }

  const databaseUrl = environment.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the disposable reader-shell benchmark.")
  }

  let database: URL
  try {
    database = new URL(databaseUrl)
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.")
  }

  if (!new Set(["postgres:", "postgresql:"]).has(database.protocol)) {
    throw new Error("DATABASE_URL must use a PostgreSQL URL.")
  }
  if (!LOOPBACK_HOSTS.has(database.hostname.toLowerCase())) {
    throw new Error("The reader-shell benchmark accepts loopback PostgreSQL hosts only.")
  }

  return {
    databaseUrl,
    port: parsePort(environment.ARCTIC_RSS_SHELL_BENCHMARK_PORT),
  }
}

async function main() {
  const config = getReaderShellBenchmarkConfig()
  const sessionSecret = randomUUID()
  const baseUrl = `http://localhost:${config.port}`
  process.env.ARCTIC_RSS_QUERY_LOGGING = "1"
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ORIGIN: baseUrl,
    ARCTIC_RSS_QUERY_LOGGING: "1",
    AUTH_SECRET: sessionSecret,
    AUTH_URL: baseUrl,
    DATABASE_URL: config.databaseUrl,
    NODE_ENV: "development",
  }
  const seedDatabase = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  })
  const application = await startApplication({ baseUrl, environment, port: config.port })
  let queryPrisma: ReturnType<typeof getPrisma> | undefined

  try {
    const queryEvents: QueryEvent[] = []
    queryPrisma = getPrisma()
    ;(queryPrisma as unknown as QueryEventEmitter).$on("query", (event) => {
      queryEvents.push({ duration: event.duration })
    })
    const results = []

    for (const subscriptionCount of SCALE_COUNTS) {
      const fixture = await seedShellFixture({ database: seedDatabase, subscriptionCount })

      try {
        const databaseMetrics = await measureShellLoaders({ queryEvents, userId: fixture.userId })
        const sessionToken = await encode({
          salt: SESSION_COOKIE_NAME,
          secret: sessionSecret,
          token: {
            authVersion: 0,
            email: fixture.email,
            id: fixture.userId,
            plan: "PRO",
            role: "USER",
            sub: fixture.userId,
          },
        })
        const browserMetrics = await measureBrowserShell({
          baseUrl,
          sessionToken,
          userEmail: fixture.email,
        })

        results.push({
          database: databaseMetrics,
          subscriptions: subscriptionCount,
          ...browserMetrics,
        })
      } finally {
        await removeShellFixture({ database: seedDatabase, fixture })
      }
    }

    const budgets = {
      clientJavaScriptBytes: 1_200_000,
      databaseQueryCount: 18,
      databaseQueryDurationMs: 600,
      hydrationDurationMs: 2_000,
      memoryAfterFirstInteractionBytes: 75_000_000,
      rscPayloadBytes: 650_000,
    }
    const passed = results.every((result) =>
      result.database.queryCount <= budgets.databaseQueryCount &&
      result.database.queryDurationMs <= budgets.databaseQueryDurationMs &&
      result.clientJavaScriptBytes <= budgets.clientJavaScriptBytes &&
      result.hydrationDurationMs <= budgets.hydrationDurationMs &&
      (result.memoryAfterFirstInteractionBytes ?? 0) <= budgets.memoryAfterFirstInteractionBytes &&
      result.rscPayloadBytes <= budgets.rscPayloadBytes
    )

    process.stdout.write(`${JSON.stringify({
      budgets,
      passed,
      results,
      runtime: "local-development",
      status: passed ? "ok" : "regression",
    }, null, 2)}\n`)
    if (!passed) {
      process.exitCode = 1
    }
  } finally {
    await stopApplication(application)
    await seedDatabase.$disconnect()
    await queryPrisma?.$disconnect()
  }
}

async function measureShellLoaders({
  queryEvents,
  userId,
}: {
  queryEvents: QueryEvent[]
  userId: string
}) {
  const firstQuery = queryEvents.length
  const startedAt = performance.now()

  await Promise.all([
    listArticleCollectionsForUser(userId),
    listUserFeedNavigation(userId),
    getReaderCounts(userId),
    listUserFolders(userId),
    getOrCreateUserSettings(userId),
    listDiscoverInterestNavigation(),
    getCurrentBulkReadJobForUser(userId),
  ])

  const events = queryEvents.slice(firstQuery)
  return {
    queryCount: events.length,
    queryDurationMs: round(events.reduce((total, event) => total + event.duration, 0)),
    wallDurationMs: round(performance.now() - startedAt),
  }
}

async function measureBrowserShell({
  baseUrl,
  sessionToken,
  userEmail,
}: {
  baseUrl: string
  sessionToken: string
  userEmail: string
}) {
  const browser = await chromium.launch({ headless: true })

  try {
    const context = await browser.newContext()
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        sameSite: "Lax",
        url: baseUrl,
        value: sessionToken,
      },
    ])
    const rscResponse = await context.request.get(`${baseUrl}/app`, {
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        RSC: "1",
      },
    })
    const rscPayloadBytes = (await rscResponse.body()).byteLength
    if (!rscResponse.headers()["content-type"]?.startsWith("text/x-component")) {
      throw new Error("The benchmark request did not receive an RSC payload.")
    }

    const page = await context.newPage()
    await page.goto(`${baseUrl}/app`, { waitUntil: "domcontentloaded" })
    const hydrationDurationMs = await page.evaluate(async (email) => {
      const startedAt = globalThis.performance.now()
      const deadline = startedAt + 10_000

      while (globalThis.performance.now() < deadline) {
        const trigger = [...document.querySelectorAll("button")].find((button) =>
          button.textContent?.includes(email)
        )
        trigger?.click()

        if (document.querySelector('[role="menu"]')) {
          return globalThis.performance.now()
        }

        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      throw new Error("The reader shell did not become interactive within 10 seconds.")
    }, userEmail)
    await page.waitForLoadState("networkidle")
    const browserMetrics = await page.evaluate(() => {
      const resources = globalThis.performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      const clientJavaScriptBytes = resources
        .filter((resource) => resource.initiatorType === "script")
        .reduce((total, resource) => total + resource.transferSize, 0)
      const memory = (globalThis.performance as unknown as Performance & {
        memory?: { usedJSHeapSize: number }
      }).memory

      return {
        clientJavaScriptBytes,
        memoryAfterFirstInteractionBytes: memory?.usedJSHeapSize ?? null,
      }
    })

    return {
      hydrationDurationMs: round(hydrationDurationMs),
      rscPayloadBytes,
      ...browserMetrics,
    }
  } finally {
    await browser.close()
  }
}

async function seedShellFixture({
  database,
  subscriptionCount,
}: {
  database: PrismaClient
  subscriptionCount: number
}) {
  const marker = randomUUID().replaceAll("-", "")
  const userId = `shell-benchmark-user-${marker}`
  const email = `shell-benchmark-${marker}@example.test`
  const feedIds = Array.from(
    { length: subscriptionCount },
    (_, index) => `shell-benchmark-feed-${marker}-${index}`
  )
  const folderIds = Array.from(
    { length: Math.min(10, subscriptionCount) },
    (_, index) => `shell-benchmark-folder-${marker}-${index}`
  )

  await database.user.create({
    data: { email, id: userId, name: `Shell benchmark ${subscriptionCount}`, plan: "PRO" },
  })
  await database.folder.createMany({
    data: folderIds.map((id, index) => ({
      id,
      name: `Benchmark folder ${index}`,
      userId,
    })),
  })
  await database.feed.createMany({
    data: feedIds.map((id, index) => ({
      feedUrl: `https://shell-benchmark.example.test/${marker}/${index}.xml`,
      id,
      title: `Benchmark source ${index}`,
    })),
  })
  await database.feedSubscription.createMany({
    data: feedIds.map((feedId, index) => ({
      feedId,
      folderId: folderIds[index % folderIds.length],
      userId,
    })),
  })
  await database.article.createMany({
    data: feedIds.map((feedId, index) => ({
      externalId: `shell-benchmark-article-${marker}-${index}`,
      feedId,
      title: `Benchmark article ${index}`,
      url: `https://shell-benchmark.example.test/article/${marker}/${index}`,
    })),
  })

  return { email, feedIds, userId }
}

async function removeShellFixture({
  database,
  fixture,
}: {
  database: PrismaClient
  fixture: Awaited<ReturnType<typeof seedShellFixture>>
}) {
  await database.feed.deleteMany({ where: { id: { in: fixture.feedIds } } })
  await database.user.delete({ where: { id: fixture.userId } })
}

async function startApplication({
  baseUrl,
  environment,
  port,
}: {
  baseUrl: string
  environment: NodeJS.ProcessEnv
  port: number
}) {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-p", String(port)],
    { env: environment, stdio: "pipe" }
  )
  let output = ""
  child.stderr.on("data", (chunk) => { output += chunk.toString() })
  child.stdout.on("data", (chunk) => { output += chunk.toString() })

  for (let attempt = 0; attempt < 300; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`The local benchmark server exited early: ${output.slice(-2_000)}`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/live`)
      if (response.ok) {
        return child
      }
    } catch {
      // The local server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  child.kill()
  throw new Error(`The local benchmark server did not become ready within 30 seconds: ${output.slice(-2_000)}`)
}

async function stopApplication(application: ReturnType<typeof spawn>) {
  if (application.exitCode !== null) {
    return
  }

  application.kill()
  await new Promise<void>((resolve) => application.once("exit", () => resolve()))
}

function parsePort(value: string | undefined) {
  if (!value) {
    return 3107
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 65_535) {
    throw new Error("ARCTIC_RSS_SHELL_BENCHMARK_PORT must be a port between 1024 and 65535.")
  }

  return parsed
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
