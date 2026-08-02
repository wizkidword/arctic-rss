import { spawnSync } from "node:child_process"

import {
  composeProfileArguments,
  readTopologyManifest,
  resolveTopology,
} from "../../ops/topology-manifest.mjs"

const { topologyName, tunnel, composeArguments } = parseArguments(process.argv.slice(2))
const topology = resolveTopology(readTopologyManifest(), topologyName, { tunnel })
const result = spawnSync(
  "docker",
  ["compose", "-f", "docker-compose.yml", "-f", "docker-compose.ci.yml", ...composeProfileArguments(topology), ...composeArguments],
  {
    env: { ...process.env, ARCTIC_RSS_TOPOLOGY: topology.name },
    stdio: "inherit",
  }
)

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)

function parseArguments(arguments_) {
  let topologyName
  let tunnel = false
  let index = 0

  while (index < arguments_.length) {
    const argument = arguments_[index]

    if (argument === "--topology") {
      topologyName = arguments_[index + 1]
      index += 2
      continue
    }

    if (argument === "--tunnel") {
      tunnel = true
      index += 1
      continue
    }

    if (argument === "--") {
      index += 1
    }

    break
  }

  if (!topologyName) {
    throw new Error("A topology is required. Pass --topology <name>.")
  }

  const composeArguments = arguments_.slice(index)
  if (composeArguments.length === 0) {
    throw new Error("A Docker Compose command is required after the topology options.")
  }

  return { topologyName, tunnel, composeArguments }
}
