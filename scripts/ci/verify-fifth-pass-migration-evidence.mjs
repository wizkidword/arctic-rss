import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomBytes, randomUUID } from "node:crypto"
import path from "node:path"

import pg from "pg"

const { Client } = pg

const postgresImage =
  "postgres:17.10-alpine3.23@sha256:8189a1f6e40904781fc9e2612687877791d21679866db58b1de996b31fc312e4"
const baselineCommit = "686cd18b7e7f6196865af34c93496c3bddf16a69"
const databaseName = "arctic_rss"
const suffix = `${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 12)}`
const containerName = `arctic-rss-fifth-pass-migrations-${suffix}`
const password = randomBytes(24).toString("base64url")

const measuredTables = [
  "Article",
  "DigestRun",
  "ExternalIdentityHashBackfillProgress",
  "Feed",
  "FeedSubscription",
  "ImportJobEntry",
  "Podcast",
  "PodcastEpisode",
  "PodcastSubscription",
  "SmartDigest",
]

const measuredIndexes = [
  "DigestRun_status_leaseExpiresAt_idx",
  "FeedSubscription_feedId_idx",
  "ImportJobEntry_importJobId_status_leaseExpiresAt_sequence_idx",
  "PodcastSubscription_podcastId_idx",
  "SmartDigest_runId_key",
]

async function main() {
  let client

  try {
    docker([
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
      `POSTGRES_PASSWORD=${password}`,
      "-p",
      "127.0.0.1::5432",
      postgresImage,
    ], "starting the disposable PostgreSQL fixture")
    await waitForDatabase()

    const connectionString = databaseUrl()
    runPrismaMigrations(connectionString)

    client = new Client({ connectionString })
    await client.connect()

    const fifthPassMigrations = changedMigrationNames()
    const appliedMigrations = await readAppliedMigrations(client, fifthPassMigrations)
    assert.deepEqual(appliedMigrations, fifthPassMigrations, "Every fifth-pass migration must apply from a clean database.")

    const tables = await readTableMeasurements(client)
    assert.deepEqual(tables.map(({ name }) => name), [...measuredTables].sort(), "Every measured fifth-pass table must exist.")

    const indexes = await readIndexMeasurements(client)
    assert.deepEqual(indexes.map(({ name }) => name), [...measuredIndexes].sort(), "Every fifth-pass index must exist.")

    process.stdout.write(`${JSON.stringify({
      cleanBaseline: true,
      fifthPassMigrations,
      indexes,
      postgresImage,
      productionReady: false,
      tables,
      totalAppliedMigrationCount: await readTotalMigrationCount(client),
    }, null, 2)}\n`)
  } finally {
    await client?.end()
    tryDocker(["rm", "-f", containerName])
  }
}

function changedMigrationNames() {
  const changedFiles = execute(
    "git",
    ["diff", "--name-only", `${baselineCommit}...HEAD`, "--", "prisma/migrations"],
    {},
    "reading fifth-pass migrations"
  )

  return [...new Set(
    changedFiles
      .split(/\r?\n/)
      .map((file) => file.match(/^prisma\/migrations\/([^/]+)\/migration\.sql$/)?.[1])
      .filter(Boolean)
  )].sort()
}

async function readAppliedMigrations(client, migrationNames) {
  const result = await client.query(
    'SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ANY($1::text[]) ORDER BY migration_name',
    [migrationNames]
  )
  return result.rows.map(({ migration_name: migrationName }) => migrationName)
}

async function readTableMeasurements(client) {
  const result = await client.query(
    `SELECT relname AS name,
            n_live_tup::bigint::text AS estimated_rows,
            pg_relation_size(relid)::bigint::text AS table_bytes,
            pg_indexes_size(relid)::bigint::text AS index_bytes
       FROM pg_stat_user_tables
      WHERE relname = ANY($1::text[])
      ORDER BY relname`,
    [measuredTables]
  )
  return result.rows
}

async function readIndexMeasurements(client) {
  const result = await client.query(
    `SELECT indexrelname AS name,
            idx_scan::bigint::text AS scans,
            pg_relation_size(indexrelid)::bigint::text AS index_bytes
       FROM pg_stat_user_indexes
      WHERE indexrelname = ANY($1::text[])
      ORDER BY indexrelname`,
    [measuredIndexes]
  )
  return result.rows
}

async function readTotalMigrationCount(client) {
  const result = await client.query('SELECT count(*)::integer AS count FROM "_prisma_migrations"')
  return result.rows[0].count
}

function databaseUrl() {
  const port = docker(["port", containerName, "5432/tcp"], "reading the disposable PostgreSQL port")
    .trim()
    .match(/:(\d+)$/)?.[1]

  if (!port) {
    throw new Error("Could not resolve the disposable PostgreSQL port.")
  }

  return `postgresql://postgres:${password}@127.0.0.1:${port}/${databaseName}?schema=public`
}

function runPrismaMigrations(connectionString) {
  execute(
    process.execPath,
    [path.join(process.cwd(), "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"],
    { DATABASE_URL: connectionString },
    "applying migrations to the disposable PostgreSQL fixture"
  )
}

async function waitForDatabase() {
  const deadline = Date.now() + 45_000

  while (Date.now() < deadline) {
    if (tryDocker(["exec", containerName, "pg_isready", "-U", "postgres", "-d", databaseName]).status === 0) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error("Timed out waiting for the disposable PostgreSQL fixture.")
}

function docker(arguments_, action) {
  const result = tryDocker(arguments_)
  if (result.status !== 0) {
    throw new Error(`Docker failed while ${action}.`)
  }
  return result.stdout
}

function tryDocker(arguments_) {
  return spawnSync("docker", arguments_, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
}

function execute(command, arguments_, environment, action) {
  const result = spawnSync(command, arguments_, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  })

  if (result.status !== 0) {
    throw new Error(`Command failed while ${action}.`)
  }
  return result.stdout
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Fifth-pass migration verification failed."}\n`)
  process.exitCode = 1
})
