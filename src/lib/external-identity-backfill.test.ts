import { describe, expect, it } from "vitest"

import {
  assertExternalIdentityBackfillIsDisposable,
  backfillExternalIdentityHashes,
} from "./external-identity-backfill"
import { externalIdentityHash } from "./external-identity"

type RecordRow = {
  externalId: string
  externalIdHash: string | null
  feedId?: string
  id: string
  podcastId?: string
}

function createStore() {
  const articles: RecordRow[] = [
    { externalId: "article-1", externalIdHash: null, feedId: "feed-1", id: "article-1" },
    { externalId: "article-2", externalIdHash: null, feedId: "feed-1", id: "article-2" },
  ]
  const episodes: RecordRow[] = [
    { externalId: "episode-1", externalIdHash: null, id: "episode-1", podcastId: "podcast-1" },
  ]
  const progress = new Map<string, {
    collisionCandidateCount: number
    completedAt?: Date
    cursorId: string | null
    processedCount: number
  }>()

  const model = (rows: RecordRow[]) => ({
    findMany: async (args: { orderBy?: { id: "asc" }; take?: number; where?: Record<string, unknown> }) => {
      const where = args.where ?? {}
      const idAfter = (where.id as { gt?: string } | undefined)?.gt
      const sourceField = "feedId" in where ? "feedId" : "podcastId"
      const sourceIds = (where[sourceField] as { in?: string[] } | undefined)?.in
      const hashes = (where.externalIdHash as { in?: string[] } | null | undefined)?.in
      const nullOnly = where.externalIdHash === null

      return rows
        .filter((row) => !nullOnly || row.externalIdHash === null)
        .filter((row) => !idAfter || row.id > idAfter)
        .filter((row) => !sourceIds || sourceIds.includes(row[sourceField] ?? ""))
        .filter((row) => !hashes || (row.externalIdHash ? hashes.includes(row.externalIdHash) : false))
        .sort((left, right) => left.id.localeCompare(right.id))
        .slice(0, args.take)
        .map((row) => ({ ...row }))
    },
    updateMany: async ({ data, where }: { data: { externalIdHash: string }; where: { externalIdHash: null; id: string } }) => {
      const row = rows.find((candidate) => candidate.id === where.id && candidate.externalIdHash === null)

      if (!row) {
        return { count: 0 }
      }

      row.externalIdHash = data.externalIdHash
      return { count: 1 }
    },
  })

  const store: Record<string, unknown> = {
    $transaction: async (callback: (transaction: Record<string, unknown>) => Promise<unknown>) =>
      callback(store),
    article: model(articles),
    externalIdentityHashBackfillProgress: {
      findUnique: async ({ where }: { where: { scope: string } }) => progress.get(where.scope) ?? null,
      upsert: async ({ create, update, where }: {
        create: { collisionCandidateCount: number; completedAt?: Date; cursorId: string | null; processedCount: number; scope: string }
        update: { collisionCandidateCount: number; completedAt?: Date; cursorId: string | null; processedCount: number }
        where: { scope: string }
      }) => {
        const next = progress.has(where.scope) ? update : create
        progress.set(where.scope, { ...next })
      },
    },
    podcastEpisode: model(episodes),
  }

  return { articles, episodes, progress, store }
}

describe("external identity hash backfill", () => {
  it("advances durable per-scope checkpoints in bounded resumable batches", async () => {
    const fixture = createStore()
    const now = new Date("2026-08-09T15:00:00.000Z")

    await expect(
      backfillExternalIdentityHashes({
        batchSize: 1,
        maxBatches: 1,
        now: () => now,
        store: fixture.store as never,
      })
    ).resolves.toEqual({
      article: { collisionCandidateCount: 0, completed: false, processedCount: 1 },
      podcastEpisode: { collisionCandidateCount: 0, completed: false, processedCount: 1 },
    })
    expect(fixture.progress.get("article")).toMatchObject({
      cursorId: "article-1",
      processedCount: 1,
    })

    await expect(
      backfillExternalIdentityHashes({
        batchSize: 1,
        maxBatches: 3,
        now: () => now,
        store: fixture.store as never,
      })
    ).resolves.toEqual({
      article: { collisionCandidateCount: 0, completed: true, processedCount: 1 },
      podcastEpisode: { collisionCandidateCount: 0, completed: true, processedCount: 0 },
    })
    expect(fixture.articles.map((article) => article.externalIdHash)).toEqual([
      externalIdentityHash("article-1"),
      externalIdentityHash("article-2"),
    ])
    expect(fixture.episodes[0]?.externalIdHash).toBe(externalIdentityHash("episode-1"))
    expect(fixture.progress.get("article")).toMatchObject({
      completedAt: now,
      processedCount: 2,
    })
  })

  it("refuses to run without disposable confirmation and a loopback database", () => {
    expect(() =>
      assertExternalIdentityBackfillIsDisposable({
        confirmation: "disposable",
        databaseUrl: "postgresql://postgres@127.0.0.1:55432/arctic_rss",
      })
    ).not.toThrow()
    expect(() =>
      assertExternalIdentityBackfillIsDisposable({
        confirmation: "disposable",
        databaseUrl: "postgresql://postgres@db.example.com/arctic_rss",
      })
    ).toThrow("loopback")
    expect(() =>
      assertExternalIdentityBackfillIsDisposable({
        confirmation: "production",
        databaseUrl: "postgresql://postgres@127.0.0.1:55432/arctic_rss",
      })
    ).toThrow("confirmation")
  })
})
