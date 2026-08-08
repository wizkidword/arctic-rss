import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

const compose = JSON.parse(
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.example",
      "--profile",
      "all-in-one",
      "--profile",
      "split-workers",
      "--profile",
      "chat-workers",
      "--profile",
      "chat",
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8" }
  )
)

const durableOnlyWorkers = [
  "worker-ai-mail",
  "worker-imports",
  "worker-ingestion",
  "worker-maintenance",
]

for (const serviceName of durableOnlyWorkers) {
  assertDependencies(serviceName, ["migrate", "redis"])
}

for (const serviceName of ["worker", "worker-chat-events"]) {
  assertDependencies(serviceName, ["migrate", "redis", "redis-ephemeral"])
}

assertDependencies("chat-gateway", ["migrate", "redis-ephemeral"])

console.log(
  "Compose dependency boundaries keep durable-only workers independent of ephemeral Redis."
)

function assertDependencies(serviceName, expectedDependencies) {
  const service = compose.services[serviceName]
  assert.ok(service, `Missing Compose service: ${serviceName}`)

  const dependencies = service.depends_on ?? {}
  assert.deepEqual(
    Object.keys(dependencies).sort(),
    [...expectedDependencies].sort(),
    `${serviceName} must declare exactly its required service dependencies.`
  )

  for (const dependency of expectedDependencies) {
    assert.equal(
      dependencies[dependency]?.condition,
      dependency === "migrate" ? "service_completed_successfully" : "service_healthy",
      `${serviceName} must wait for ${dependency}'s expected readiness condition.`
    )
  }
}
