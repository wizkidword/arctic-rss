import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"

const redisImage =
  "redis:7.4.9-alpine3.21@sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99"
const suffix = `${process.pid}-${randomBytes(6).toString("hex")}`
const durableNetwork = `arctic-rss-durable-${suffix}`
const ephemeralNetwork = `arctic-rss-ephemeral-${suffix}`
const durableContainer = `arctic-rss-durable-redis-${suffix}`
const ephemeralContainer = `arctic-rss-ephemeral-redis-${suffix}`
const durableUsername = "durable_test"
const ephemeralUsername = "ephemeral_test"
const durablePassword = randomBytes(24).toString("base64url")
const ephemeralPassword = randomBytes(24).toString("base64url")

try {
  run(["network", "create", durableNetwork], "creating the durable test network")
  run(["network", "create", ephemeralNetwork], "creating the ephemeral test network")

  run(
    [
      "run",
      "-d",
      "--rm",
      "--name",
      durableContainer,
      "--network",
      durableNetwork,
      "--network-alias",
      "durable-redis",
      redisImage,
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
      "--user",
      durableUsername,
      "on",
      `>${durablePassword}`,
      "~*",
      "&*",
      "+@all",
      "--user",
      "default",
      "off",
    ],
    "starting the durable ACL Redis fixture"
  )
  run(
    [
      "run",
      "-d",
      "--rm",
      "--name",
      ephemeralContainer,
      "--network",
      ephemeralNetwork,
      "--network-alias",
      "ephemeral-redis",
      redisImage,
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
      "--user",
      ephemeralUsername,
      "on",
      `>${ephemeralPassword}`,
      "~*",
      "&*",
      "+@all",
      "--user",
      "default",
      "off",
    ],
    "starting the ephemeral ACL Redis fixture"
  )

  await waitForRedis(durableContainer, durableUsername, durablePassword, "durable")
  await waitForRedis(
    ephemeralContainer,
    ephemeralUsername,
    ephemeralPassword,
    "ephemeral"
  )

  assertAuthenticationFails(
    ephemeralContainer,
    durableUsername,
    durablePassword,
    "Durable Redis credentials must fail against ephemeral Redis."
  )
  assertAuthenticationFails(
    durableContainer,
    ephemeralUsername,
    ephemeralPassword,
    "Ephemeral Redis credentials must fail against durable Redis."
  )

  assertCannotConnect(
    ephemeralNetwork,
    "durable-redis",
    "The chat-gateway network must not resolve durable Redis."
  )
  assertCannotConnect(
    durableNetwork,
    "ephemeral-redis",
    "The ingestion-worker network must not resolve ephemeral Redis."
  )

  console.log("Redis credential and network boundary integration verified.")
} finally {
  tryRun(["rm", "-f", durableContainer])
  tryRun(["rm", "-f", ephemeralContainer])
  tryRun(["network", "rm", durableNetwork])
  tryRun(["network", "rm", ephemeralNetwork])
}

function run(arguments_, action) {
  const result = tryRun(arguments_)

  if (result.status !== 0) {
    throw new Error(`Docker failed while ${action}.`)
  }

  return result.stdout.trim()
}

function tryRun(arguments_) {
  return spawnSync("docker", arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
}

async function waitForRedis(container, username, password, workload) {
  const deadline = Date.now() + 30_000

  while (Date.now() < deadline) {
    const result = tryRun([
      "exec",
      container,
      "redis-cli",
      "--no-auth-warning",
      "--user",
      username,
      "-a",
      password,
      "PING",
    ])

    if (result.status === 0 && result.stdout.trim() === "PONG") {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for ${workload} Redis test fixture.`)
}

function assertAuthenticationFails(container, username, password, message) {
  const result = tryRun([
    "exec",
    container,
    "redis-cli",
    "--no-auth-warning",
    "--user",
    username,
    "-a",
    password,
    "PING",
  ])
  const output = `${result.stdout}\n${result.stderr}`

  assert.match(output, /(?:WRONGPASS|NOAUTH)/, message)
}

function assertCannotConnect(network, hostname, message) {
  const result = tryRun([
    "run",
    "--rm",
    "--network",
    network,
    redisImage,
    "redis-cli",
    "--connect-timeout",
    "1",
    "-h",
    hostname,
    "PING",
  ])

  assert.notEqual(result.status, 0, message)
}
