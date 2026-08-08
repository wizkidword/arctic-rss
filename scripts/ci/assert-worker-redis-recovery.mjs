import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

import {
  composeProfileArguments,
  readTopologyManifest,
  resolveTopology,
} from "../../ops/topology-manifest.mjs"

const { after, topologyName } = parseArguments(process.argv.slice(2))
const manifest = readTopologyManifest()
const topology = resolveTopology(manifest, topologyName)
const profileArguments = composeProfileArguments(topology)
const workerServices = manifest.workerServices.filter((service) =>
  topology.requiredServices.includes(service)
)

await waitFor(
  () =>
    workerServices.every((service) => composeServices().get(service)?.Health === "healthy"),
  "all required workers to become healthy"
)

for (const service of workerServices) {
  const logs = compose(["logs", "--no-color", service])
  const unavailableAt = logs.search('"state":"unavailable"')
  const recoveredAt = logs.indexOf('"state":"ready"', unavailableAt + 1)

  assert.ok(
    unavailableAt >= 0 && recoveredAt > unavailableAt,
    `${service} must log durable Redis degradation followed by recovery.`
  )
}

await waitFor(() => {
  const tick = readMaintenanceTick()
  return Boolean(tick && tick.timestamp >= after)
}, "a new durable maintenance tick after Redis recovery")

console.log(`Workers recovered after durable Redis restart for ${topology.name}.`)

function compose(arguments_) {
  return execFileSync(
    "docker",
    [
      "compose",
      "-f",
      "docker-compose.yml",
      "-f",
      "docker-compose.ci.yml",
      ...profileArguments,
      ...arguments_,
    ],
    { encoding: "utf8" }
  )
}

function composeServices() {
  const output = compose(["ps", "--format", "json"])
  const entries = output.trim().startsWith("[")
    ? JSON.parse(output)
    : output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line))

  return new Map(entries.map((entry) => [entry.Service, entry]))
}

function readMaintenanceTick() {
  try {
    const value = compose([
      "exec",
      "-T",
      "redis",
      "sh",
      "-c",
      'redis-cli --no-auth-warning --user "$DURABLE_REDIS_USERNAME" -a "$DURABLE_REDIS_PASSWORD" --raw GET arctic-rss:maintenance-tick:v1',
    ]).trim()
    const tick = JSON.parse(value)

    return typeof tick?.timestamp === "number" ? tick : undefined
  } catch {
    return undefined
  }
}

async function waitFor(predicate, description) {
  const deadline = Date.now() + 90_000

  while (Date.now() < deadline) {
    try {
      if (predicate()) {
        return
      }
    } catch {
      // Compose and Redis can briefly disagree while the restart converges.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`Timed out waiting for ${description}.`)
}

function parseArguments(arguments_) {
  const [topologyName, flag, value] = arguments_

  if (!topologyName || flag !== "--after" || !/^\d+$/.test(value ?? "")) {
    throw new Error(
      "Usage: node scripts/ci/assert-worker-redis-recovery.mjs <topology> --after <epoch-ms>"
    )
  }

  return { after: Number(value), topologyName }
}
