import { randomUUID } from "node:crypto"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "../src/generated/prisma/client"
import { writeRefreshItems } from "../src/lib/refresh-write-batch"

type MeasuredWrite = {
  changedCount: number
  duplicateInputCount: number
  insertedCount: number
  unchangedCount: number
}

async function main() {
  const connectionString = disposableConnectionString()
  const database = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })
  const suffix = randomUUID()
  let feedId: string | undefined
  let podcastId: string | undefined

  try {
    const feed = await database.feed.create({
      data: {
        feedUrl: `https://measure.invalid/feed/${suffix}`,
        title: "Disposable ingestion measurement feed",
      },
    })
    feedId = feed.id
    const podcast = await database.podcast.create({
      data: {
        feedUrl: `https://measure.invalid/podcast/${suffix}`,
        title: "Disposable ingestion measurement podcast",
      },
    })
    podcastId = podcast.id

    const beforeFirst = await walLsn(database)
    const first = await writeArticle(database, feed.id, "v1:article-initial")
    const firstPodcast = await writeEpisode(database, podcast.id, "v1:episode-initial")
    const afterFirst = await walLsn(database)
    const identical = await writeArticle(database, feed.id, "v1:article-initial")
    const identicalPodcast = await writeEpisode(database, podcast.id, "v1:episode-initial")
    const afterIdentical = await walLsn(database)
    const corrected = await writeArticle(database, feed.id, "v1:article-corrected")
    const correctedPodcast = await writeEpisode(
      database,
      podcast.id,
      "v1:episode-corrected"
    )
    const afterCorrected = await walLsn(database)

    const identicalWalBytes = await walDifference(
      database,
      afterIdentical,
      afterFirst
    )
    const correctedWalBytes = await walDifference(
      database,
      afterCorrected,
      afterIdentical
    )
    const firstWalBytes = await walDifference(database, afterFirst, beforeFirst)

    assertWrite(first, { insertedCount: 1 })
    assertWrite(firstPodcast, { insertedCount: 1 })
    assertWrite(identical, { unchangedCount: 1 })
    assertWrite(identicalPodcast, { unchangedCount: 1 })
    assertWrite(corrected, { changedCount: 1 })
    assertWrite(correctedPodcast, { changedCount: 1 })

    if (
      firstWalBytes <= 0 ||
      identicalWalBytes !== 0 ||
      correctedWalBytes <= identicalWalBytes
    ) {
      throw new Error("Expected identical writes to add no WAL and corrections to add WAL.")
    }

    process.stdout.write(
      `${JSON.stringify({
        correctedWalBytes,
        first: combineWrites(first, firstPodcast),
        firstWalBytes,
        identical: combineWrites(identical, identicalPodcast),
        identicalWalBytes,
        corrected: combineWrites(corrected, correctedPodcast),
        status: "ok",
      })}\n`
    )
  } finally {
    if (feedId) {
      await database.feed.delete({ where: { id: feedId } }).catch(() => undefined)
    }
    if (podcastId) {
      await database.podcast.delete({ where: { id: podcastId } }).catch(() => undefined)
    }
    await database.$disconnect()
  }
}

function disposableConnectionString() {
  if (process.env.ARCTIC_RSS_DISPOSABLE_DB !== "1") {
    throw new Error("Set ARCTIC_RSS_DISPOSABLE_DB=1 to run this destructive disposable-database measurement.")
  }

  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the disposable-database measurement.")
  }

  const hostname = new URL(connectionString).hostname

  if (!["127.0.0.1", "::1", "localhost"].includes(hostname)) {
    throw new Error("The disposable-database measurement only allows a loopback DATABASE_URL.")
  }

  return connectionString
}

async function writeArticle(database: PrismaClient, feedId: string, ingestionFingerprint: string) {
  return writeRefreshItems({
    createMany: (items) =>
      database.article.createMany({
        data: items.map((item) => ({
          externalId: item.externalId,
          feedId,
          ingestionFingerprint: item.ingestionFingerprint,
          title: "Disposable article",
          url: "https://measure.invalid/article",
        })),
        skipDuplicates: true,
      }),
    findExistingItems: (externalIds) =>
      database.article.findMany({
        select: { externalId: true, ingestionFingerprint: true },
        where: { externalId: { in: externalIds }, feedId },
      }),
    items: [{ externalId: "article", ingestionFingerprint }],
    update: (item) =>
      database.article.update({
        data: { ingestionFingerprint: item.ingestionFingerprint },
        where: { feedId_externalId: { externalId: item.externalId, feedId } },
      }),
  })
}

async function writeEpisode(
  database: PrismaClient,
  podcastId: string,
  ingestionFingerprint: string
) {
  return writeRefreshItems({
    createMany: (items) =>
      database.podcastEpisode.createMany({
        data: items.map((item) => ({
          audioUrl: "https://measure.invalid/episode.mp3",
          externalId: item.externalId,
          ingestionFingerprint: item.ingestionFingerprint,
          podcastId,
          title: "Disposable episode",
        })),
        skipDuplicates: true,
      }),
    findExistingItems: (externalIds) =>
      database.podcastEpisode.findMany({
        select: { externalId: true, ingestionFingerprint: true },
        where: { externalId: { in: externalIds }, podcastId },
      }),
    items: [{ externalId: "episode", ingestionFingerprint }],
    update: (item) =>
      database.podcastEpisode.update({
        data: { ingestionFingerprint: item.ingestionFingerprint },
        where: {
          podcastId_externalId: { externalId: item.externalId, podcastId },
        },
      }),
  })
}

async function walLsn(database: PrismaClient) {
  const [result] = await database.$queryRaw<Array<{ lsn: string }>>`
    SELECT pg_current_wal_lsn()::text AS lsn
  `

  return result.lsn
}

async function walDifference(database: PrismaClient, after: string, before: string) {
  const [result] = await database.$queryRaw<Array<{ bytes: bigint }>>`
    SELECT pg_wal_lsn_diff(${after}::pg_lsn, ${before}::pg_lsn)::bigint AS bytes
  `

  return Number(result.bytes)
}

function assertWrite(
  result: MeasuredWrite,
  expected: Partial<MeasuredWrite>
) {
  for (const [key, expectedValue] of Object.entries(expected)) {
    if (result[key as keyof MeasuredWrite] !== expectedValue) {
      throw new Error(`Unexpected ${key} result while measuring ingestion persistence.`)
    }
  }
}

function combineWrites(first: MeasuredWrite, second: MeasuredWrite): MeasuredWrite {
  return {
    changedCount: first.changedCount + second.changedCount,
    duplicateInputCount: first.duplicateInputCount + second.duplicateInputCount,
    insertedCount: first.insertedCount + second.insertedCount,
    unchangedCount: first.unchangedCount + second.unchangedCount,
  }
}

void main()
