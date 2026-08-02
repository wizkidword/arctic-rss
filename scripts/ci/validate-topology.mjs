import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"

import {
  assertTopologyManifest,
  composeProfileArguments,
  readTopologyManifest,
  resolveTopology,
} from "../../ops/topology-manifest.mjs"

const options = parseArguments(process.argv.slice(2))
const manifest = readTopologyManifest()
assertTopologyManifest(manifest)

const topologyNames = options.topology ? [options.topology] : Object.keys(manifest.topologies)
const allProfiles = new Set([
  ...Object.values(manifest.topologies).flatMap((topology) => topology.profiles),
  ...manifest.tunnelVariant.profiles,
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
const composeServices = new Set(Object.keys(compose.services ?? {}))

for (const serviceName of manifest.services) {
  assert.ok(composeServices.has(serviceName), `Topology manifest references service absent from Compose: ${serviceName}.`)
}

for (const topologyName of topologyNames) {
  const topology = resolveTopology(manifest, topologyName, { tunnel: options.tunnel })
  for (const serviceName of topology.requiredServices) {
    assert.ok(composeServices.has(serviceName), `${topologyName} requires missing Compose service ${serviceName}.`)
  }

  const rendered = JSON.parse(
    execFileSync(
      "docker",
      ["compose", "--env-file", ".env.example", ...composeProfileArguments(topology), "config", "--format", "json"],
      { encoding: "utf8" }
    )
  )

  for (const [responsibility, owner] of Object.entries(topology.workerOwnership)) {
    assert.equal(
      rendered.services[owner]?.environment?.WORKER_MODE,
      owner === "worker" ? "all" : responsibility,
      `${topologyName} does not configure ${owner} as the ${responsibility} owner.`
    )
  }
}

console.log(
  `Topology validation passed for ${topologyNames.join(", ")}${options.tunnel ? " with tunnel" : ""}.`
)

function parseArguments(arguments_) {
  const options = { topology: undefined, tunnel: false }

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]

    if (argument === "--topology") {
      options.topology = arguments_[index + 1]
      index += 1
      continue
    }

    if (argument === "--tunnel") {
      options.tunnel = true
      continue
    }

    throw new Error(`Unknown topology validation argument: ${argument}`)
  }

  if (!options.topology) {
    return options
  }

  assert.ok(manifestNameIsSafe(options.topology), "Topology name must contain lowercase letters, digits, and hyphens only.")
  return options
}

function manifestNameIsSafe(value) {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value)
}
