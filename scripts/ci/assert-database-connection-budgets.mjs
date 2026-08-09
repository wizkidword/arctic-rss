import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

import { readTopologyManifest } from "../../ops/topology-manifest.mjs"

const budget = JSON.parse(
  readFileSync(new URL("../../config/database-connection-budget.json", import.meta.url), "utf8")
)
const serviceEnvironment = JSON.parse(
  readFileSync(new URL("../../config/service-role-environments.json", import.meta.url), "utf8")
)
const topologyManifest = readTopologyManifest()
const allProfiles = new Set([
  ...Object.values(topologyManifest.topologies).flatMap((topology) => topology.profiles),
  ...topologyManifest.tunnelVariant.profiles,
])
const compose = JSON.parse(
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.example",
      ...[...allProfiles].flatMap((profile) => ["--profile", profile]),
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8" }
  )
)

const runtimeRoles = Object.keys(budget.roles).filter((role) => role !== "migrate")
const serviceRoleByComposeService = Object.fromEntries(
  Object.entries(serviceEnvironment.roles).map(([role, entry]) => [entry.composeService, role])
)
const reserves = Object.values(budget.postgres.reserves)
const applicationBudget = budget.postgres.maxConnections - reserves.reduce((total, value) => total + value, 0)
const applicationAndMigrationBudget =
  applicationBudget + budget.postgres.reserves.migrationRecovery

assert.equal(budget.schemaVersion, 1, "Unsupported database connection budget schema version.")
assert.deepEqual(
  compose.services.postgres.command,
  ["postgres", "-c", `max_connections=${budget.postgres.maxConnections}`],
  "PostgreSQL must start with the reviewed max_connections ceiling."
)
assert.equal(applicationBudget, 85, "The documented application connection budget must remain 85.")

for (const role of runtimeRoles) {
  const serviceName = serviceEnvironment.roles[role]?.composeService
  const service = compose.services[serviceName]
  const roleBudget = budget.roles[role]

  assert.ok(service, `${role} must map to a rendered Compose service.`)
  assert.equal(
    String(service.environment.DB_POOL_MAX),
    String(roleBudget.poolMax),
    `${serviceName} must receive its reviewed DB_POOL_MAX.`
  )
  assert.equal(
    service.environment.DB_APPLICATION_NAME,
    roleBudget.applicationName,
    `${serviceName} must receive its reviewed DB_APPLICATION_NAME.`
  )

  for (const [variable, minimum, maximum] of [
    ["DB_CONNECTION_TIMEOUT_MS", 250, 10_000],
    ["DB_IDLE_TIMEOUT_MS", 1_000, 60_000],
    ["DB_STATEMENT_TIMEOUT_MS", 1_000, 60_000],
  ]) {
    const value = Number(service.environment[variable])
    assert.ok(
      Number.isSafeInteger(value) && value >= minimum && value <= maximum,
      `${serviceName} ${variable} must be between ${minimum} and ${maximum}.`
    )
  }
}

assert.ok(
  budget.roles.migrate.poolMax <= budget.postgres.reserves.migrationRecovery,
  "The migration service allocation must fit inside the migration/recovery reserve."
)

for (const [topologyName, topology] of Object.entries(topologyManifest.topologies)) {
  const enabledRoles = topology.requiredServices
    .map((serviceName) => serviceRoleByComposeService[serviceName])
    .filter((role) => runtimeRoles.includes(role))
  const normal = enabledRoles.reduce((total, role) => total + budget.roles[role].poolMax, 0)
  const largestWorker = Math.max(
    ...enabledRoles
      .filter((role) => role.startsWith("worker-"))
      .map((role) => budget.roles[role].poolMax)
  )
  const scenarios = {
    normal,
    normalWithMigrationService: normal + budget.roles.migrate.poolMax,
    oldAndNewReleaseOverlap: normal * 2,
    overlapPlusOneWorkerRestart: normal * 2 + largestWorker,
    overlapRestartAndMigration: normal * 2 + largestWorker + budget.roles.migrate.poolMax,
  }

  for (const [scenario, connectionCount] of Object.entries(scenarios)) {
    const scenarioBudget = scenario.includes("Migration")
      ? applicationAndMigrationBudget
      : applicationBudget

    assert.ok(
      connectionCount <= scenarioBudget,
      `${topologyName} ${scenario} uses ${connectionCount}, exceeding budget ${scenarioBudget}.`
    )
  }

  console.log(
    `${topologyName}: normal=${scenarios.normal}, migration=${scenarios.normalWithMigrationService}, overlap=${scenarios.oldAndNewReleaseOverlap}, restart-storm=${scenarios.overlapPlusOneWorkerRestart}, restart-plus-migration=${scenarios.overlapRestartAndMigration}, application-budget=${applicationBudget}`
  )
}

console.log("Database connection budgets match every rendered Compose topology.")
