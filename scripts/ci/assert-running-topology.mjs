import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

import {
  composeProfileArguments,
  readTopologyManifest,
  resolveTopology,
} from "../../ops/topology-manifest.mjs"

const topologyName = process.argv[2]
if (!topologyName) {
  throw new Error("Usage: node scripts/ci/assert-running-topology.mjs <topology> [--tunnel]")
}

const tunnel = process.argv.slice(3).includes("--tunnel")
const manifest = readTopologyManifest()
const topology = resolveTopology(manifest, topologyName, { tunnel })
const profileArguments = composeProfileArguments(topology)
const runningServices = new Set(
  execFileSync(
    "docker",
    ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.ci.yml", ...profileArguments, "ps", "--services", "--status", "running"],
    { encoding: "utf8" }
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
)

for (const serviceName of topology.requiredHealthServices) {
  assert.ok(runningServices.has(serviceName), `${topology.name} did not start required healthy service ${serviceName}.`)
}

for (const serviceName of manifest.workerServices) {
  const shouldRun = topology.requiredServices.includes(serviceName)
  assert.equal(
    runningServices.has(serviceName),
    shouldRun,
    `${topology.name} has unexpected worker ownership for ${serviceName}.`
  )
}

console.log(`Running Compose services match the ${topology.name}${topology.tunnel ? " tunnel" : ""} topology.`)
