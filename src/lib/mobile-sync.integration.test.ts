import { randomUUID } from "node:crypto"

import { afterAll, describe, expect, test } from "vitest"

import { getPrisma } from "@/lib/db"

import {
  addMobileCollectionItem,
  getMobileSyncBootstrap,
  listMobileNotificationPreferences,
  listMobileSync,
  MobileSyncError,
  registerMobileDeviceInstallation,
  removeMobileCollectionItem,
  unregisterMobileDeviceInstallation,
  updateMobileArticleState,
  updateMobileNotificationPreference,
  updateMobilePodcastEpisodeState,
  updateMobilePodcastProgress,
} from "./mobile-sync"
import { pruneMobileSyncEvents } from "./mobile-sync-retention"

const databaseTest = process.env.CI ? test : test.skip

describe("mobile sync foundations in PostgreSQL", () => {
  const userIds: string[] = []
  let prisma: ReturnType<typeof getPrisma> | null = null

  afterAll(async () => {
    if (prisma && userIds.length) {
      await prisma.userSyncCursorFloor.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.userNotificationPreference.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.userPlanQuota.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.userSyncEvent.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    }
  })

  databaseTest("commits one idempotent article mutation and one matching sync event", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)
    const input = { isRead: true }
    const key = "phase12-idempotency-key-article-0001"

    const results = await Promise.all([
      updateMobileArticleState({
        articleId: fixture.article.id,
        deviceSessionId: fixture.session.id,
        mobileDeviceId: fixture.session.mobileDeviceId!,
        idempotencyKey: key,
        input,
        userId: fixture.user.id,
      }),
      updateMobileArticleState({
        articleId: fixture.article.id,
        deviceSessionId: fixture.session.id,
        mobileDeviceId: fixture.session.mobileDeviceId!,
        idempotencyKey: key,
        input,
        userId: fixture.user.id,
      }),
    ])

    expect(results.map((result) => result.replayed).sort()).toEqual([false, true])
    const receipts = await prisma.deviceMutationReceipt.findMany({
      where: { deviceSessionId: fixture.session.id },
    })
    expect(receipts).toHaveLength(1)
    const events = await prisma.userSyncEvent.findMany({
      where: { resourceId: fixture.article.id, resourceType: "article-state", userId: fixture.user.id },
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ action: "UPSERT" })

    await expect(
      updateMobileArticleState({
        articleId: fixture.article.id,
        deviceSessionId: fixture.session.id,
        mobileDeviceId: fixture.session.mobileDeviceId!,
        idempotencyKey: key,
        input: { isRead: false },
        userId: fixture.user.id,
      })
    ).rejects.toMatchObject({ code: "idempotency-conflict" } satisfies Partial<MobileSyncError>)
  })

  databaseTest("emits collection tombstones and shares state across device sessions", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)
    const secondSession = await createDeviceSession(prisma, fixture.user.id, "secondary")

    await addMobileCollectionItem({
      articleId: fixture.article.id,
      collectionId: fixture.collection.id,
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      idempotencyKey: "phase12-idempotency-key-collection-add",
      userId: fixture.user.id,
    })
    await removeMobileCollectionItem({
      articleId: fixture.article.id,
      collectionId: fixture.collection.id,
      deviceSessionId: secondSession.id,
      mobileDeviceId: secondSession.mobileDeviceId!,
      idempotencyKey: "phase12-idempotency-key-collection-remove",
      userId: fixture.user.id,
    })

    const sync = await listMobileSync({ limit: 100, userId: fixture.user.id })
    const collectionEvents = sync.events.filter((event) => event.resourceType === "collection-item")
    expect(collectionEvents.map((event) => event.action)).toEqual(["UPSERT", "TOMBSTONE"])
    expect(collectionEvents.at(-1)?.payload).toMatchObject({
      articleId: fixture.article.id,
      collectionId: fixture.collection.id,
    })
  })

  databaseTest("syncs podcast state, preferences, and protected installation cleanup", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)

    await updateMobilePodcastProgress({
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      episodeId: fixture.episode.id,
      idempotencyKey: "phase12-idempotency-key-podcast-progress",
      input: { playbackPositionSeconds: 321 },
      userId: fixture.user.id,
    })
    await updateMobilePodcastEpisodeState({
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      episodeId: fixture.episode.id,
      idempotencyKey: "phase12-idempotency-key-podcast-state",
      input: { isPlayed: true, isStarred: true },
      userId: fixture.user.id,
    })
    const defaults = await listMobileNotificationPreferences(fixture.user.id)
    expect(defaults).toHaveLength(4)
    await updateMobileNotificationPreference({
      channel: "MOBILE_PUSH",
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      idempotencyKey: "phase12-idempotency-key-preference",
      topic: "SMART_DIGEST_COMPLETION",
      userId: fixture.user.id,
    })
    const pushToken = `ExponentPushToken[${randomUUID().replaceAll("-", "")}0000000000000000]`
    const installation = await registerMobileDeviceInstallation({
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      environment: "preview",
      idempotencyKey: "phase12-idempotency-key-installation",
      pushToken,
      userId: fixture.user.id,
    })
    const disabled = await unregisterMobileDeviceInstallation({
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      idempotencyKey: "phase12-idempotency-key-unregister",
      pushToken,
    })

    expect(installation.status).toBe("ACTIVE")
    expect(disabled).toMatchObject({ installationId: installation.installationId, status: "DISABLED" })
    const events = await prisma.userSyncEvent.findMany({
      where: { userId: fixture.user.id },
    })
    expect(events.some((event) => event.resourceType === "podcast-episode-state")).toBe(true)
    expect(events.some((event) => event.resourceType === "notification-preference")).toBe(true)
    const storedInstallation = await prisma.deviceInstallation.findUniqueOrThrow({
      where: { id: installation.installationId },
    })
    expect(storedInstallation.tokenHash).not.toContain(pushToken)
    expect(storedInstallation.disabledAt).not.toBeNull()
  })

  databaseTest("requires a full resync for a cursor below the retained floor", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)
    await prisma.userSyncCursorFloor.create({
      data: { minimumSequence: BigInt(100), userId: fixture.user.id },
    })

    await expect(listMobileSync({ cursor: "1", limit: 20, userId: fixture.user.id })).rejects.toMatchObject({
      code: "full-resync-required",
    } satisfies Partial<MobileSyncError>)
  })

  databaseTest("prunes expired events in a bounded pass and advances the floor transactionally", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)
    const occurredAt = new Date("2025-12-01T12:00:00.000Z")
    await prisma.userSyncEvent.createMany({
      data: [
        {
          action: "UPSERT",
          occurredAt,
          payload: {
            archivedAt: null,
            articleId: fixture.article.id,
            isRead: false,
            isStarred: false,
            readAt: null,
            starredAt: null,
          },
          resourceId: fixture.article.id,
          resourceType: "article-state",
          resourceVersion: occurredAt.toISOString(),
          userId: fixture.user.id,
        },
        {
          action: "TOMBSTONE",
          occurredAt,
          payload: { articleId: fixture.article.id },
          resourceId: fixture.article.id,
          resourceType: "article-state",
          resourceVersion: occurredAt.toISOString(),
          userId: fixture.user.id,
        },
      ],
    })
    const expired = await prisma.userSyncEvent.findMany({
      orderBy: { sequence: "asc" },
      select: { sequence: true },
      where: { occurredAt, userId: fixture.user.id },
    })

    const result = await pruneMobileSyncEvents({
      batchSize: 2,
      now: new Date("2026-08-11T12:00:00.000Z"),
      store: prisma,
    })

    expect(result.rowsPruned).toBe(2)
    const floor = await prisma.userSyncCursorFloor.findUniqueOrThrow({
      where: { userId: fixture.user.id },
    })
    expect(floor.minimumSequence).toBe(expired.at(-1)!.sequence + BigInt(1))
    await expect(
      listMobileSync({
        cursor: expired[0]!.sequence.toString(),
        limit: 20,
        userId: fixture.user.id,
      })
    ).rejects.toMatchObject({
      code: "full-resync-required",
    } satisfies Partial<MobileSyncError>)
  })

  databaseTest("returns a high-water cursor without rebuilding pending mobile state", async () => {
    prisma = getPrisma()
    const fixture = await createFixture(prisma, userIds)
    await updateMobileArticleState({
      articleId: fixture.article.id,
      deviceSessionId: fixture.session.id,
      mobileDeviceId: fixture.session.mobileDeviceId!,
      idempotencyKey: "phase12-bootstrap-high-water",
      input: { isRead: true },
      userId: fixture.user.id,
    })

    const bootstrap = await getMobileSyncBootstrap(fixture.user.id)
    expect(bootstrap.highWaterCursor).toMatch(/^\d+$/)
  })
})

async function createFixture(prisma: ReturnType<typeof getPrisma>, userIds: string[]) {
  const marker = randomUUID().replaceAll("-", "")
  const user = await prisma.user.create({ data: { email: `mobile-sync-${marker}@example.test` } })
  userIds.push(user.id)
  const feed = await prisma.feed.create({
    data: { feedUrl: `https://feed-${marker}.example.test/rss.xml`, title: "Mobile Sync Feed" },
  })
  await prisma.feedSubscription.create({ data: { feedId: feed.id, userId: user.id } })
  const article = await prisma.article.create({
    data: {
      externalId: `article-${marker}`,
      feedId: feed.id,
      title: "Mobile Sync Article",
      url: `https://feed-${marker}.example.test/articles/1`,
    },
  })
  const collection = await prisma.articleCollection.create({
    data: { name: `Mobile Sync ${marker}`, userId: user.id },
  })
  const podcast = await prisma.podcast.create({
    data: { feedUrl: `https://podcast-${marker}.example.test/rss.xml`, title: "Mobile Sync Podcast" },
  })
  await prisma.podcastSubscription.create({ data: { podcastId: podcast.id, userId: user.id } })
  const episode = await prisma.podcastEpisode.create({
    data: {
      audioUrl: `https://podcast-${marker}.example.test/episodes/1.mp3`,
      externalId: `episode-${marker}`,
      podcastId: podcast.id,
      title: "Mobile Sync Episode",
    },
  })
  const session = await createDeviceSession(prisma, user.id, "primary")
  return { article, collection, episode, session, user }
}

function createDeviceSession(
  prisma: ReturnType<typeof getPrisma>,
  userId: string,
  suffix: string
) {
  const now = new Date()
  const tokenFamilyId = `sync-family-${randomUUID()}`
  return prisma.mobileDevice.create({
    data: {
      appVersion: "0.1.0-test",
      authVersion: 0,
      deviceName: `Test Android ${suffix}`,
      lastUsedAt: now,
      platform: "android",
      refreshExpiresAt: new Date(now.getTime() + 86_400_000),
      tokenFamilyId,
      userId,
    },
  }).then((device) => prisma.deviceSession.create({
    data: {
      accessIssuedAt: now,
      appVersion: "0.1.0-test",
      authVersion: 0,
      deviceName: `Test Android ${suffix}`,
      lastUsedAt: now,
      mobileDeviceId: device.id,
      platform: "android",
      refreshExpiresAt: new Date(now.getTime() + 86_400_000),
      refreshTokenHash: `sync-refresh-${randomUUID()}`,
      tokenFamilyId,
      userId,
    },
  }))
}
