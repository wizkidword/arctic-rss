import { describe, expect, it, vi } from "vitest"

import {
  describeRedisSeparation,
  DOCTOR_REQUIRED_VARIABLES,
  evaluateDoctorReport,
  inspectRedisServerIdentityWithClients,
  parseDoctorCommand,
  type DoctorReport,
} from "./doctor"

function healthyReport(
  overrides: Partial<DoctorReport> = {}
): DoctorReport {
  return {
    backupMetadata: { ageMs: 1_000, status: "available" },
    chatGateway: "disabled",
    databaseRoles: { migration: "migrate", runtime: "runtime" },
    maintenanceTick: { ageMs: 1_000, fresh: true },
    migrationStatus: "up-to-date",
    queueReadiness: {
      available: true,
      oldestActiveJobAgeMs: null,
      oldestWaitingJobAgeMs: null,
      recentFailureCount: 0,
      ready: true,
      suspectedStalledJobCount: 0,
      totalActive: 0,
      totalWaiting: 0,
    },
    redisIdentity: {
      durableDatabase: "0",
      durableRole: "master",
      ephemeralDatabase: "0",
      ephemeralRole: "master",
      status: "separate-servers",
    },
    redisSeparation: "distinct",
    requiredVariables: Object.fromEntries(
      DOCTOR_REQUIRED_VARIABLES.web.map((variable) => [variable, "configured"])
    ),
    scope: "runtime",
    securityBoundary: { errors: [], status: "ok" },
    serviceRole: "web",
    topology: { chatEnabled: false, name: "all-in-one", workerModes: ["all"] },
    workerHeartbeats: { all: { ageMs: 1_000, fresh: true } },
    ...overrides,
  }
}

const runtimeFailureCases: Array<[string, Partial<DoctorReport>]> = [
  ["missing required variable", {
    requiredVariables: { ...healthyReport().requiredVariables, DATABASE_URL: "missing" },
  }],
  ["unknown service role", { serviceRole: null, requiredVariables: {} }],
  ["unknown topology", { topology: null }],
  ["shared Redis endpoint", { redisSeparation: "shared" }],
  ["unavailable queue", { queueReadiness: { ...healthyReport().queueReadiness, ready: false } }],
  ["missing worker heartbeat", { workerHeartbeats: { all: { ageMs: null, fresh: false } } }],
  ["stale maintenance tick", { maintenanceTick: { ageMs: 90_001, fresh: false } }],
  ["unavailable enabled chat", {
    chatGateway: "unavailable",
    topology: { chatEnabled: true, name: "all-in-one-with-chat", workerModes: ["all"] },
  }],
]

const migrationFailureCases: Array<[string, Partial<DoctorReport>]> = [
  ["pending migration", { migrationStatus: "pending-or-unavailable" }],
  ["unavailable migration status", { migrationStatus: "not-configured" }],
]

describe("doctor report helpers", () => {
  it("reports configuration presence by name without returning secret values", () => {
    expect(DOCTOR_REQUIRED_VARIABLES.web).toContain("AUTH_SECRET")
    expect(DOCTOR_REQUIRED_VARIABLES["worker-ingestion"]).toEqual([
      "DATABASE_URL",
      "DURABLE_REDIS_URL",
    ])
  })

  it("compares Redis endpoints without exposing credentials", () => {
    expect(
      describeRedisSeparation({
        DURABLE_REDIS_URL: "redis://:durable-secret@redis:6379/0",
        EPHEMERAL_REDIS_URL: "redis://:ephemeral-secret@redis-ephemeral:6379/0",
      })
    ).toBe("distinct")
    expect(
      describeRedisSeparation({
        DURABLE_REDIS_URL: "redis://:durable-secret@REDIS:6379/0",
        EPHEMERAL_REDIS_URL: "redis://:ephemeral-secret@redis/",
      })
    ).toBe("shared")
  })

  it("classifies Redis aliases and logical databases by real server identity", async () => {
    const reader = {
      read: vi.fn(async (url: string) => ({
        database: new URL(url).pathname.slice(1) || "0",
        role: "master",
        runId: "same-server",
      })),
    }

    await expect(
      inspectRedisServerIdentityWithClients({
        durableUrl: "redis://durable-alias:6379/0",
        ephemeralUrl: "redis://ephemeral-alias:6379/0",
        reader,
      })
    ).resolves.toMatchObject({ status: "same-server", durableDatabase: "0", ephemeralDatabase: "0" })
    await expect(
      inspectRedisServerIdentityWithClients({
        durableUrl: "redis://redis:6379/0",
        ephemeralUrl: "redis://redis:6379/1",
        reader,
      })
    ).resolves.toMatchObject({ status: "same-server", durableDatabase: "0", ephemeralDatabase: "1" })
  })

  it("recognizes separate Redis servers and endpoint failures without URL disclosure", async () => {
    await expect(
      inspectRedisServerIdentityWithClients({
        durableUrl: "redis://durable:6379/0",
        ephemeralUrl: "redis://ephemeral:6379/0",
        reader: {
          read: vi.fn(async (url: string) => ({
            database: "0",
            role: "master",
            runId: url.includes("durable") ? "durable-server" : "ephemeral-server",
          })),
        },
      })
    ).resolves.toMatchObject({ status: "separate-servers" })

    await expect(
      inspectRedisServerIdentityWithClients({
        durableUrl: "redis://durable:6379/0",
        ephemeralUrl: "redis://ephemeral:6379/0",
        reader: { read: vi.fn().mockRejectedValue(new Error("connection refused")) },
      })
    ).resolves.toEqual({
      durableDatabase: null,
      durableRole: null,
      ephemeralDatabase: null,
      ephemeralRole: null,
      status: "unavailable",
    })
  })

  it("parses explicit doctor scopes and options", () => {
    expect(parseDoctorCommand(["runtime", "--role", "worker-ingestion"])).toEqual({
      role: "worker-ingestion",
      scope: "runtime",
      warnOnly: false,
    })
    expect(parseDoctorCommand(["release", "--topology", "split-with-chat", "--warn-only"])).toEqual({
      scope: "release",
      topology: "split-with-chat",
      warnOnly: true,
    })
    expect(() => parseDoctorCommand(["unknown"])).toThrow("Unknown doctor scope.")
  })

  it.each(runtimeFailureCases)("returns a nonzero runtime result for %s", (_name, overrides) => {
    expect(evaluateDoctorReport(healthyReport(overrides)).exitCode).toBe(1)
  })

  it.each(migrationFailureCases)("returns a nonzero migration result for %s", (_name, overrides) => {
    expect(
      evaluateDoctorReport(healthyReport({ ...overrides, scope: "migrations" })).exitCode
    ).toBe(1)
  })

  it("returns a nonzero host result when backup evidence is unavailable", () => {
    expect(
      evaluateDoctorReport(
        healthyReport({
          backupMetadata: { ageMs: null, status: "unavailable" },
          scope: "host",
        })
      ).exitCode
    ).toBe(1)
  })

  it("reports skipped checks as not applicable and allows explicit exploratory warn-only mode", () => {
    const report = healthyReport({
      requiredVariables: {
        ARCTIC_IRC_TOKEN_SECRET: "configured",
        DATABASE_URL: "configured",
        EPHEMERAL_REDIS_URL: "configured",
      },
      serviceRole: "chat-gateway",
    })
    const evaluation = evaluateDoctorReport(report)

    expect(evaluation.checks.find((check) => check.name === "runtime.queue-readiness")).toMatchObject({
      required: false,
      status: "NOT_APPLICABLE",
    })
    expect(evaluateDoctorReport(healthyReport({ topology: null }), { warnOnly: true })).toMatchObject({
      exitCode: 0,
      warnOnly: true,
    })
  })
})
