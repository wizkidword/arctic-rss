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
      "health",
      "--profile",
      "split-workers",
      "--profile",
      "chat-workers",
      "--profile",
      "chat",
      "--profile",
      "tunnel",
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8" }
  )
)

const expectedNetworks = {
  postgres: ["durable-data", "web-edge"],
  redis: ["durable-data"],
  "redis-ephemeral": ["ephemeral-realtime"],
  migrate: ["web-edge"],
  web: ["durable-data", "ephemeral-realtime", "web-edge"],
  worker: ["durable-data", "ephemeral-realtime"],
  "worker-ingestion": ["durable-data"],
  "worker-ai-mail": ["durable-data"],
  "worker-imports": ["durable-data"],
  "worker-maintenance": ["durable-data"],
  "worker-chat-events": ["durable-data", "ephemeral-realtime"],
  "worker-health": ["durable-data", "ephemeral-realtime", "web-edge"],
  "chat-gateway": ["ephemeral-realtime", "web-edge"],
  "edge-proxy": ["web-edge"],
  cloudflared: ["web-edge"],
}

assert.deepEqual(
  Object.keys(compose.networks ?? {}).sort(),
  ["durable-data", "ephemeral-realtime", "web-edge"],
  "Compose must declare only the reviewed Redis/data and edge networks."
)

for (const [serviceName, expected] of Object.entries(expectedNetworks)) {
  const service = compose.services[serviceName]
  assert.ok(service, `Missing Compose service: ${serviceName}`)
  assert.deepEqual(
    Object.keys(service.networks ?? {}).sort(),
    [...expected].sort(),
    `${serviceName} must attach only to its reviewed networks.`
  )
}

for (const serviceName of ["redis", "redis-ephemeral"]) {
  const command = compose.services[serviceName]?.command

  assert.ok(Array.isArray(command), `${serviceName} must use an explicit Redis command.`)
  for (const token of ["+@all", "-@admin", "-@dangerous", "+info"]) {
    assert.ok(command.includes(token), `${serviceName} ACL command must include ${token}.`)
  }

  const defaultUser = command.lastIndexOf("--user")
  assert.deepEqual(
    command.slice(defaultUser),
    ["--user", "default", "off"],
    `${serviceName} must disable the Redis default user.`
  )
}

console.log("Compose Redis network boundaries verified.")
