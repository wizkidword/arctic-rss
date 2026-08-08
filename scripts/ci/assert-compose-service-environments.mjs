import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const environmentManifest = JSON.parse(
  readFileSync(new URL("../../config/service-role-environments.json", import.meta.url), "utf8")
)
const compose = JSON.parse(
  execFileSync(
    "docker",
    [
      "compose",
      "--env-file",
      ".env.example",
      "--profile",
      "chat",
      "--profile",
      "split-workers",
      "--profile",
      "chat-workers",
      "--profile",
      "all-in-one",
      "--profile",
      "tunnel",
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8" }
  )
)

function environmentNames(serviceName) {
  const service = compose.services[serviceName]

  assert.ok(service, `Missing Compose service: ${serviceName}`)
  assert.ok(!service.env_file, `${serviceName} must not use env_file.`)

  return Object.keys(service.environment ?? {}).sort()
}

function assertExactEnvironment(serviceName, allowed) {
  assert.deepEqual(
    environmentNames(serviceName),
    [...allowed].sort(),
    `${serviceName} environment must exactly match config/service-role-environments.json.`
  )
}

for (const [role, entry] of Object.entries(environmentManifest.roles)) {
  assertExactEnvironment(entry.composeService, entry.allowed)
  assert.ok(
    entry.required.every((variable) => entry.allowed.includes(variable)),
    `${role} has a required variable outside its allowed set.`
  )
}

for (const [serviceName, allowed] of Object.entries(environmentManifest.infrastructure)) {
  assertExactEnvironment(serviceName, allowed)
}

assert.deepEqual(
  Object.keys(compose.services).sort(),
  [
    ...Object.values(environmentManifest.roles).map((entry) => entry.composeService),
    ...Object.keys(environmentManifest.infrastructure),
  ].sort(),
  "Every rendered Compose service must have an exact environment manifest entry."
)

console.log("Compose service environment boundaries exactly match the manifest.")
