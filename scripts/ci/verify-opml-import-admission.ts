import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import path from "node:path"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../../src/generated/prisma/client"

const postgresImage =
  "postgres:17.10-alpine3.23@sha256:8189a1f6e40904781fc9e2612687877791d21679866db58b1de996b31fc312e4"
const suffix = `${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 12)}`
const containerName = `arctic-rss-opml-admission-${suffix}`
const databaseName = "arctic_rss"
const databasePassword = randomBytes(24).toString("base64url")

async function main() {
  let database: PrismaClient | undefined

  try {
    docker(
      [
        "run",
        "-d",
        "--rm",
        "--name",
        containerName,
        "-e",
        `POSTGRES_DB=${databaseName}`,
        "-e",
        "POSTGRES_USER=postgres",
        "-e",
        `POSTGRES_PASSWORD=${databasePassword}`,
        "-p",
        "127.0.0.1::5432",
        postgresImage,
      ],
      "starting the disposable PostgreSQL fixture"
    )
    await waitForDatabase()

    const connectionString = databaseUrl()
    runPrismaMigrations(connectionString)
    database = createDatabaseClient(connectionString)

    await assertPartialUniqueIndex(database)
    await assertOneProcessContention(database)
    await assertSeparateProcessContention(database)
    await assertStatusTransitions(database)
    await assertCancelAndRetryTransition(database)
    await assertUsersDoNotBlockEachOther(database)

    process.stdout.write(
      "OPML import admission is enforced by PostgreSQL across processes and terminal transitions.\n"
    )
  } finally {
    await database?.$disconnect()
    tryDocker(["rm", "-f", containerName])
  }
}

function createDatabaseClient(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
}

function databaseUrl() {
  const port = docker(["port", containerName, "5432/tcp"], "reading the disposable PostgreSQL port")
    .trim()
    .match(/:(\d+)$/)?.[1]

  if (!port) {
    throw new Error("Could not resolve the disposable PostgreSQL port.")
  }

  return `postgresql://postgres:${databasePassword}@127.0.0.1:${port}/${databaseName}?schema=public`
}

function runPrismaMigrations(connectionString: string) {
  const cli = path.join(process.cwd(), "node_modules", "prisma", "build", "index.js")
  execute(
    process.execPath,
    [cli, "migrate", "deploy"],
    { DATABASE_URL: connectionString },
    "applying migrations to the disposable PostgreSQL fixture"
  )
}

async function assertPartialUniqueIndex(database: PrismaClient) {
  const indexes = await database.$queryRawUnsafe<Array<{ indexdef: string }>>(
    "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ImportJob_one_active_per_user'"
  )

  assert.equal(indexes.length, 1, "The active-import partial unique index must exist.")
  assert.match(indexes[0].indexdef, /UNIQUE INDEX/)
  assert.match(indexes[0].indexdef, /WHERE .*status.*PENDING.*PROCESSING/i)
}

async function assertOneProcessContention(database: PrismaClient) {
  const userId = await createUser(database, "one-process")
  const results = await Promise.allSettled([
    createPendingImport(database, userId, "one-process-a"),
    createPendingImport(database, userId, "one-process-b"),
  ])

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    "Exactly one of two same-process import starts may succeed."
  )
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
    "The competing same-process import start must be rejected."
  )
  const rejection = results.find((result) => result.status === "rejected")
  if (rejection?.status === "rejected") {
    assert.equal(
      (rejection.reason as { code?: unknown }).code,
      "P2002",
      "The database must report a unique-constraint conflict."
    )
  }
}

async function assertSeparateProcessContention(database: PrismaClient) {
  const userId = await createUser(database, "separate-process")
  const results = await Promise.allSettled([
    insertFromSeparateProcess(userId, "separate-process-a"),
    insertFromSeparateProcess(userId, "separate-process-b"),
  ])

  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
    "Exactly one of two separate PostgreSQL client processes may start an import."
  )
  assert.equal(
    results.filter((result) => result.status === "rejected").length,
    1,
    "The competing separate PostgreSQL client process must be rejected."
  )
}

async function assertStatusTransitions(database: PrismaClient) {
  const userId = await createUser(database, "status-transitions")
  const pending = await createPendingImport(database, userId, "status-pending")

  await expectUniqueConflict(
    () => createPendingImport(database, userId, "status-conflict-pending"),
    "A pending import must block another import."
  )
  await database.importJob.update({
    data: { status: "PROCESSING" },
    where: { id: pending.id },
  })
  await expectUniqueConflict(
    () => createPendingImport(database, userId, "status-conflict-processing"),
    "A processing import must block another import."
  )
  await database.importJob.update({
    data: { completedAt: new Date(), status: "COMPLETED" },
    where: { id: pending.id },
  })
  const afterComplete = await createPendingImport(database, userId, "status-after-complete")
  await database.importJob.update({
    data: { completedAt: new Date(), status: "FAILED" },
    where: { id: afterComplete.id },
  })
  await createPendingImport(database, userId, "status-after-failure")
}

async function assertCancelAndRetryTransition(database: PrismaClient) {
  const userId = await createUser(database, "cancel-retry")
  const retryable = await database.importJob.create({
    data: importJobData(userId, "retryable", "CANCELED"),
  })
  const active = await createPendingImport(database, userId, "retry-blocker")

  await expectUniqueConflict(
    () =>
      database.importJob.update({
        data: { cancelRequestedAt: null, completedAt: null, status: "PENDING" },
        where: { id: retryable.id },
      }),
    "Retrying a canceled import must not bypass an active import."
  )
  await database.importJob.update({
    data: { completedAt: new Date(), status: "CANCELED" },
    where: { id: active.id },
  })
  await database.importJob.update({
    data: { cancelRequestedAt: null, completedAt: null, status: "PENDING" },
    where: { id: retryable.id },
  })
}

async function assertUsersDoNotBlockEachOther(database: PrismaClient) {
  const [userA, userB] = await Promise.all([
    createUser(database, "user-a"),
    createUser(database, "user-b"),
  ])
  const results = await Promise.all([
    createPendingImport(database, userA, "user-a-import"),
    createPendingImport(database, userB, "user-b-import"),
  ])

  assert.equal(results.length, 2, "An active import for User A must not block User B.")
}

async function createUser(database: PrismaClient, label: string) {
  const id = `opml-admission-${label}-${suffix}`
  await database.user.create({
    data: {
      email: `${id}@example.test`,
      id,
    },
  })
  return id
}

function createPendingImport(database: PrismaClient, userId: string, label: string) {
  return database.importJob.create({
    data: importJobData(userId, label, "PENDING"),
  })
}

function importJobData(
  userId: string,
  label: string,
  status: "CANCELED" | "PENDING"
) {
  return {
    id: `opml-import-${label}-${suffix}`,
    status,
    userId,
  }
}

function insertFromSeparateProcess(userId: string, label: string) {
  const id = `opml-import-${label}-${suffix}`
  const sql = [
    'INSERT INTO public."ImportJob" ("id", "userId", "status", "updatedAt")',
    `VALUES (${sqlLiteral(id)}, ${sqlLiteral(userId)}, 'PENDING', CURRENT_TIMESTAMP);`,
  ].join(" ")

  return dockerAsync([
    "exec",
    containerName,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    databaseName,
    "-c",
    sql,
  ])
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

async function expectUniqueConflict(action: () => Promise<unknown>, message: string) {
  let error: unknown

  try {
    await action()
  } catch (caught) {
    error = caught
  }

  assert.equal((error as { code?: unknown } | undefined)?.code, "P2002", message)
}

async function waitForDatabase() {
  const deadline = Date.now() + 45_000

  while (Date.now() < deadline) {
    const result = tryDocker([
      "exec",
      containerName,
      "pg_isready",
      "-U",
      "postgres",
      "-d",
      databaseName,
    ])
    if (result.status === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error("Timed out waiting for the disposable PostgreSQL fixture.")
}

function docker(arguments_: string[], action: string) {
  const result = tryDocker(arguments_)

  if (result.status !== 0) {
    throw new Error(`Docker failed while ${action}.`)
  }

  return result.stdout
}

function tryDocker(arguments_: string[]) {
  return spawnSync("docker", arguments_, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
}

function dockerAsync(arguments_: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn("docker", arguments_, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    })
    const output: Buffer[] = []

    child.stdout.on("data", (chunk: Buffer) => output.push(chunk))
    child.on("error", reject)
    child.on("close", (status) => {
      if (status === 0) {
        resolve(Buffer.concat(output).toString("utf8"))
        return
      }
      reject(new Error("Separate PostgreSQL client process was rejected."))
    })
  })
}

function execute(
  command: string,
  arguments_: string[],
  environment: Record<string, string>,
  action: string
) {
  const result = spawnSync(command, arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })

  if (result.status !== 0) {
    throw new Error(`Command failed while ${action}.`)
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "OPML import admission verification failed."}\n`)
  process.exitCode = 1
})
