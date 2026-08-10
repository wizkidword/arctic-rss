import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { spawnSync } from "node:child_process"
import { createAdapter } from "@socket.io/redis-adapter"
import { Queue, Worker } from "bullmq"
import Redis from "ioredis"
import { Server } from "socket.io"

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
      "-p",
      "127.0.0.1::6379",
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
      "-@admin",
      "-@dangerous",
      "+info",
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
      "-p",
      "127.0.0.1::6379",
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
      "-@admin",
      "-@dangerous",
      "+info",
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
  await verifyDurableQueueFlow(durableContainer, durableUsername, durablePassword)
  await verifyDurableOperationalFlow(durableContainer, durableUsername, durablePassword)
  await verifyEphemeralPubSubAndLuaFlow(
    ephemeralContainer,
    ephemeralUsername,
    ephemeralPassword
  )
  assertDefaultUserDisabled(durableContainer)
  assertDefaultUserDisabled(ephemeralContainer)
  assertAdministrativeCommandsFail(durableContainer, durableUsername, durablePassword)
  assertAdministrativeCommandsFail(ephemeralContainer, ephemeralUsername, ephemeralPassword)
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

function assertDefaultUserDisabled(container) {
  const result = tryRun(["exec", container, "redis-cli", "--no-auth-warning", "PING"])
  const output = `${result.stdout}\n${result.stderr}`

  assert.match(output, /NOAUTH/, "The default Redis user must remain disabled.")
}

function assertAdministrativeCommandsFail(container, username, password) {
  for (const command of [
    ["ACL", "LIST"],
    ["CONFIG", "GET", "*"],
    ["FLUSHALL"],
    ["FLUSHDB"],
    ["MODULE", "LIST"],
    ["REPLICAOF", "NO", "ONE"],
    ["SHUTDOWN"],
  ]) {
    const result = tryRun([
      "exec",
      container,
      "redis-cli",
      "--no-auth-warning",
      "--user",
      username,
      "-a",
      password,
      ...command,
    ])
    const output = `${result.stdout}\n${result.stderr}`

    assert.match(output, /NOPERM/, `${command.join(" ")} must be denied to application users.`)
  }
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

async function verifyDurableQueueFlow(container, username, password) {
  const connection = { url: redisUrl(container, username, password) }
  const queueName = `acl-flow-${suffix}`
  const queue = new Queue(queueName, { connection })
  let worker

  try {
    const completed = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("BullMQ ACL flow timed out.")), 10_000)
      worker = new Worker(
        queueName,
        async (job) => job.data.value,
        { connection }
      )
      worker.once("completed", (_job, value) => {
        clearTimeout(timeout)
        resolve(value)
      })
      worker.once("failed", (_job, error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })

    await queue.add("acl-flow-job", { value: "ok" })
    assert.equal(await completed, "ok", "Restricted durable Redis must run BullMQ jobs.")
  } finally {
    await worker?.close()
    await queue.close()
  }
}

async function verifyEphemeralPubSubAndLuaFlow(container, username, password) {
  const url = redisUrl(container, username, password)
  const publisher = new Redis(url)
  const subscriber = new Redis(url)
  const adapterPublisher = new Redis(url)
  const adapterSubscriber = new Redis(url)
  const channel = "arctic-rss:chat:room-events:v1"
  const presenceKey = `arctic-rss:chat:presence:v1:room-${suffix}:user-${suffix}:connection-${suffix}`
  const rateLimitKey = `arctic-rss:rate-limit:v1:login:ip:${suffix}`
  const io = new Server()

  try {
    const received = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Redis pub/sub ACL flow timed out.")), 10_000)
      subscriber.once("message", (receivedChannel, payload) => {
        clearTimeout(timeout)
        resolve({ payload, receivedChannel })
      })
    })
    await subscriber.subscribe(channel)
    await publisher.publish(channel, "ok")
    assert.deepEqual(await received, { payload: "ok", receivedChannel: channel })
    await publisher.set(presenceKey, "1", "EX", 75)
    assert.equal(
      await publisher.get(presenceKey),
      "1",
      "Restricted ephemeral Redis must persist chat-presence heartbeats."
    )
    assert.equal(await publisher.del(presenceKey), 1)
    const rateLimitResult = await publisher.eval(
      `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("PEXPIRE", KEYS[1], ARGV[1])
        end
        return { current, redis.call("PTTL", KEYS[1]) }
      `,
      1,
      rateLimitKey,
      60_000
    )
    assert.ok(Array.isArray(rateLimitResult), "Rate-limit Lua must return a counter and TTL.")
    assert.equal(Number(rateLimitResult[0]), 1)
    assert.ok(
      Number(rateLimitResult[1]) > 0,
      "Restricted ephemeral Redis must permit the rate-limit Lua path."
    )
    io.adapter(createAdapter(adapterPublisher, adapterSubscriber))
    await waitForCondition(
      async () => Number(await io.of("/").adapter.serverCount()) >= 1,
      "Socket.IO Redis adapter subscriptions"
    )
  } finally {
    io.of("/").adapter.close()
    await Promise.all([
      publisher.quit(),
      subscriber.quit(),
      adapterPublisher.quit(),
      adapterSubscriber.quit(),
    ])
  }
}

async function verifyDurableOperationalFlow(container, username, password) {
  const redis = new Redis(redisUrl(container, username, password))
  const healthSnapshotKey = "arctic-rss:health-snapshot:v1"
  const sourceEvidenceKey = "arctic-rss:source-refresh-failures:v1"
  const heartbeatKey = `arctic-rss:worker-heartbeat:v1:acl-flow-${suffix}`
  const maintenanceLockKey = `arctic-rss:worker:maintenance-lock:v1:${suffix}`
  const maintenanceToken = `owner-${suffix}`
  const healthSnapshot = JSON.stringify({
    checkedAt: new Date().toISOString(),
    checks: {
      chatGateway: "disabled",
      database: "ok",
      durableRedis: "ok",
      ephemeralRedis: "ok",
      maintenance: "ok",
      queues: "ok",
      workers: "ok",
    },
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    status: "ok",
    topology: "acl-fixture",
    version: 1,
  })
  const sourceEvidence = JSON.stringify({
    errorCategory: "timeout",
    host: "fixture.invalid",
    kind: "feed",
    outcome: "failed",
    timestamp: Date.now(),
  })

  try {
    await redis.set(healthSnapshotKey, healthSnapshot, "PX", 60_000)
    assert.equal(
      await redis.get(healthSnapshotKey),
      healthSnapshot,
      "Restricted durable Redis must publish and read the health snapshot."
    )
    await redis.set(
      heartbeatKey,
      JSON.stringify({ instanceId: `instance-${suffix}`, mode: "acl-flow", timestamp: Date.now(), version: "test" }),
      "PX",
      90_000
    )
    assert.equal(
      (await redis.mget(heartbeatKey))[0]?.includes(`instance-${suffix}`),
      true,
      "Restricted durable Redis must publish and read worker heartbeats."
    )
    assert.equal(
      await redis.set(maintenanceLockKey, maintenanceToken, "PX", 60_000, "NX"),
      "OK",
      "Restricted durable Redis must acquire the maintenance lease."
    )
    assert.equal(
      await redis.eval(
        `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("pexpire", KEYS[1], ARGV[2])
          end
          return 0
        `,
        1,
        maintenanceLockKey,
        maintenanceToken,
        60_000
      ),
      1,
      "Restricted durable Redis must renew an owned maintenance lease."
    )
    assert.equal(
      await redis.eval(
        `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          end
          return 0
        `,
        1,
        maintenanceLockKey,
        maintenanceToken
      ),
      1,
      "Restricted durable Redis must release an owned maintenance lease."
    )
    await redis.lpush(sourceEvidenceKey, sourceEvidence)
    await redis.ltrim(sourceEvidenceKey, 0, 99)
    assert.deepEqual(
      await redis.lrange(sourceEvidenceKey, 0, 0),
      [sourceEvidence],
      "Restricted durable Redis must retain source refresh evidence."
    )
  } finally {
    await redis.quit()
  }
}

async function waitForCondition(condition, description) {
  const deadline = Date.now() + 10_000

  while (Date.now() < deadline) {
    if (await condition()) {
      return
    }

    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  throw new Error(`Timed out waiting for ${description}.`)
}

function redisUrl(container, username, password) {
  const port = run(["port", container, "6379/tcp"], "reading the Redis fixture port")
    .match(/:(\d+)$/)?.[1]

  if (!port) {
    throw new Error("Could not resolve the Redis fixture port.")
  }

  return `redis://${username}:${password}@127.0.0.1:${port}/0`
}
