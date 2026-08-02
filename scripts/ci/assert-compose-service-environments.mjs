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
      "chat",
      "--profile",
      "split-workers",
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

  return new Set(Object.keys(service.environment ?? {}))
}

function assertAbsent(serviceName, variableNames) {
  const names = environmentNames(serviceName)

  for (const variableName of variableNames) {
    assert.ok(
      !names.has(variableName),
      `${serviceName} must not receive ${variableName}.`
    )
  }
}

function assertPresent(serviceName, variableNames) {
  const names = environmentNames(serviceName)

  for (const variableName of variableNames) {
    assert.ok(names.has(variableName), `${serviceName} must receive ${variableName}.`)
  }
}

const infrastructureSecrets = [
  "CLOUDFLARE_TUNNEL_TOKEN",
  "MIGRATE_DATABASE_URL",
  "POSTGRES_PASSWORD",
  "REDIS_PASSWORD",
]

assertPresent("web", ["ARCTIC_RSS_SERVICE_ROLE", "DATABASE_URL"])
assertAbsent("web", infrastructureSecrets)

assertPresent("worker-ingestion", ["ARCTIC_RSS_SERVICE_ROLE", "DATABASE_URL", "DURABLE_REDIS_URL"])
assertAbsent("worker-ingestion", [
  ...infrastructureSecrets,
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "TURNSTILE_SECRET_KEY",
])

assertPresent("chat-gateway", [
  "ARCTIC_RSS_SERVICE_ROLE",
  "ARCTIC_IRC_TOKEN_SECRET",
  "DATABASE_URL",
  "EPHEMERAL_REDIS_URL",
])
assertAbsent("chat-gateway", [
  ...infrastructureSecrets,
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "TURNSTILE_SECRET_KEY",
])

assertPresent("migrate", ["DATABASE_URL"])
assertAbsent("migrate", [
  "ARCTIC_IRC_TOKEN_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "AUTH_SECRET",
  "CLOUDFLARE_TUNNEL_TOKEN",
  "OPENAI_API_KEY",
  "SMTP_PASSWORD",
  "SMTP_USER",
])

assert.deepEqual([...environmentNames("cloudflared")].sort(), ["TUNNEL_TOKEN"])

console.log("Compose service environment boundaries verified.")
