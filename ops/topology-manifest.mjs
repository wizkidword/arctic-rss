import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export const TOPOLOGY_MANIFEST_PATH = fileURLToPath(new URL("./topologies.json", import.meta.url))

const REQUIRED_RESPONSIBILITIES = ["ingestion", "ai-mail", "imports", "maintenance"]
const CHAT_RESPONSIBILITY = "chat-events"

function assertStringArray(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array.`)
  assert.ok(value.every((item) => typeof item === "string" && item.length > 0), `${label} must contain non-empty strings.`)
  assert.equal(new Set(value).size, value.length, `${label} must not contain duplicates.`)
}

function assertKnownServices(serviceNames, manifest, label) {
  for (const serviceName of serviceNames) {
    assert.ok(manifest.services.includes(serviceName), `${label} references unknown service ${serviceName}.`)
  }
}

function assertTopology(topologyName, topology, manifest) {
  for (const property of [
    "profiles",
    "requiredServices",
    "optionalServices",
    "requiredEnvironment",
    "requiredRedisWorkloads",
    "requiredHealthServices",
    "releaseServices",
    "rollbackServices",
  ]) {
    assertStringArray(topology[property], `${topologyName}.${property}`)
  }

  assert.equal(typeof topology.chatEnabled, "boolean", `${topologyName}.chatEnabled must be boolean.`)
  assert.ok(topology.workerOwnership && typeof topology.workerOwnership === "object", `${topologyName}.workerOwnership must be an object.`)
  assert.ok(topology.requiredServices.includes("migrate"), `${topologyName} must include migrate.`)
  assert.ok(topology.requiredServices.includes("web"), `${topologyName} must include web.`)
  assert.ok(!topology.requiredServices.includes("cloudflared"), `${topologyName} must use the tunnel variant for cloudflared.`)
  assertKnownServices(topology.requiredServices, manifest, `${topologyName}.requiredServices`)
  assertKnownServices(topology.optionalServices, manifest, `${topologyName}.optionalServices`)
  assertKnownServices(topology.requiredHealthServices, manifest, `${topologyName}.requiredHealthServices`)
  assertKnownServices(topology.releaseServices, manifest, `${topologyName}.releaseServices`)
  assertKnownServices(topology.rollbackServices, manifest, `${topologyName}.rollbackServices`)

  for (const serviceName of [...topology.requiredHealthServices, ...topology.releaseServices, ...topology.rollbackServices]) {
    assert.ok(topology.requiredServices.includes(serviceName), `${topologyName} must require ${serviceName} before using it.`)
  }

  const activeWorkers = manifest.workerServices.filter((serviceName) => topology.requiredServices.includes(serviceName))
  assert.ok(activeWorkers.length > 0, `${topologyName} must include at least one worker.`)
  assert.ok(!(activeWorkers.includes("worker") && activeWorkers.length > 1), `${topologyName} cannot enable worker mode all with split workers.`)

  const responsibilities = [...REQUIRED_RESPONSIBILITIES, ...(topology.chatEnabled ? [CHAT_RESPONSIBILITY] : [])]
  for (const responsibility of responsibilities) {
    const owner = topology.workerOwnership[responsibility]
    assert.equal(typeof owner, "string", `${topologyName} is missing a ${responsibility} owner.`)
    assert.ok(activeWorkers.includes(owner), `${topologyName} assigns ${responsibility} to an inactive worker ${owner}.`)
  }

  for (const owner of Object.values(topology.workerOwnership)) {
    assert.ok(activeWorkers.includes(owner), `${topologyName} assigns a responsibility to an inactive worker ${owner}.`)
  }

  if (topology.chatEnabled) {
    for (const serviceName of ["chat-gateway", "edge-proxy"]) {
      assert.ok(topology.requiredServices.includes(serviceName), `${topologyName} enables chat without ${serviceName}.`)
    }
    assert.ok(topology.requiredEnvironment.includes("ARCTIC_IRC_TOKEN_SECRET"), `${topologyName} enables chat without ARCTIC_IRC_TOKEN_SECRET.`)
  } else {
    for (const serviceName of ["chat-gateway", "edge-proxy", "worker-chat-events"]) {
      assert.ok(!topology.requiredServices.includes(serviceName), `${topologyName} enables ${serviceName} without chat.`)
    }
  }
}

export function assertTopologyManifest(manifest) {
  assert.equal(manifest.schemaVersion, 1, "Unsupported topology manifest schema version.")
  assertStringArray(manifest.services, "services")
  assertStringArray(manifest.workerServices, "workerServices")
  assert.ok(manifest.topologies && typeof manifest.topologies === "object", "topologies must be an object.")
  assert.ok(manifest.tunnelVariant && typeof manifest.tunnelVariant === "object", "tunnelVariant must be an object.")

  for (const serviceName of manifest.workerServices) {
    assert.ok(manifest.services.includes(serviceName), `workerServices references unknown service ${serviceName}.`)
  }

  const tunnelVariant = manifest.tunnelVariant
  for (const property of ["profiles", "requiredEnvironment", "requiredServices", "requiredHealthServices", "releaseServices", "rollbackServices"]) {
    assertStringArray(tunnelVariant[property], `tunnelVariant.${property}`)
  }
  assertKnownServices(tunnelVariant.requiredServices, manifest, "tunnelVariant.requiredServices")
  assertKnownServices(tunnelVariant.requiredHealthServices, manifest, "tunnelVariant.requiredHealthServices")
  assertKnownServices(tunnelVariant.releaseServices, manifest, "tunnelVariant.releaseServices")
  assertKnownServices(tunnelVariant.rollbackServices, manifest, "tunnelVariant.rollbackServices")
  assert.ok(tunnelVariant.requiredServices.includes("cloudflared"), "tunnelVariant must include cloudflared.")

  for (const [topologyName, topology] of Object.entries(manifest.topologies)) {
    assertTopology(topologyName, topology, manifest)
  }

  return manifest
}

export function readTopologyManifest(path = TOPOLOGY_MANIFEST_PATH) {
  return assertTopologyManifest(JSON.parse(readFileSync(path, "utf8")))
}

export function resolveTopology(manifest, topologyName, { tunnel = false } = {}) {
  const topology = manifest.topologies[topologyName]
  assert.ok(topology, `Unknown topology ${topologyName}.`)

  const variant = tunnel ? manifest.tunnelVariant : undefined
  const merge = (property) => [...topology[property], ...(variant?.[property] ?? [])]

  return {
    ...topology,
    name: topologyName,
    tunnel,
    profiles: merge("profiles"),
    requiredEnvironment: merge("requiredEnvironment"),
    requiredServices: merge("requiredServices"),
    requiredHealthServices: merge("requiredHealthServices"),
    releaseServices: merge("releaseServices"),
    rollbackServices: merge("rollbackServices"),
  }
}

export function composeProfileArguments(topology) {
  return topology.profiles.flatMap((profile) => ["--profile", profile])
}
