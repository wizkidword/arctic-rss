import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const environmentManifest = JSON.parse(
  readFileSync(new URL("../../config/service-role-environments.json", import.meta.url), "utf8")
)
const composeTemplate = readFileSync(
  new URL("../../docker-compose.yml", import.meta.url),
  "utf8"
)
const environmentExample = readFileSync(
  new URL("../../.env.example", import.meta.url),
  "utf8"
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

const runtimeCompatibilityAliases = environmentManifest.runtimeCompatibilityAliases
assert.deepEqual(
  Object.keys(runtimeCompatibilityAliases).sort(),
  Object.keys(environmentManifest.roles).sort(),
  "Every service role must declare its runtime compatibility aliases."
)

const managedVariableNames = new Set([
  ...Object.values(environmentManifest.roles).flatMap((entry) => entry.allowed),
  ...Object.values(environmentManifest.infrastructure).flat(),
  ...environmentManifest.managedAliases,
  ...Object.values(runtimeCompatibilityAliases).flat(),
])

for (const variable of composeVariableNames(composeTemplate)) {
  assert.ok(
    managedVariableNames.has(variable),
    `Compose variable ${variable} must be registered in config/service-role-environments.json.`
  )
}

for (const variable of environmentExampleVariableNames(environmentExample)) {
  assert.ok(
    managedVariableNames.has(variable),
    `.env.example variable ${variable} must be registered in config/service-role-environments.json.`
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

function composeVariableNames(compose) {
  return [...new Set(
    [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)].map((match) => match[1])
  )]
}

function environmentExampleVariableNames(example) {
  return [...new Set(
    example
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
      .filter(Boolean)
  )]
}
