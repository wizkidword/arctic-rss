import { createHash } from "node:crypto"

import { Prisma } from "@/generated/prisma/client"
import type {
  ArticleStateMutationRequest,
  PodcastProgressMutationRequest,
  PodcastStateMutationRequest,
} from "@arctic-rss/api-contract"

import { articleAccessWhere } from "./articles"
import { getPrisma } from "./db"
import { toMobileSyncEvent } from "./mobile-sync-event"

export const MOBILE_SYNC_RETENTION_DAYS = 180
export const MOBILE_MUTATION_RECEIPT_RETENTION_DAYS = 30
export const MOBILE_NOTIFICATION_TOPICS = [
  "SECURITY_ALERTS",
  "SAVED_MONITOR_MATCHES",
  "SMART_DIGEST_COMPLETION",
  "CHAT_MENTIONS",
] as const
export const MOBILE_NOTIFICATION_CHANNELS = [
  "IN_APP",
  "EMAIL",
  "MOBILE_PUSH",
  "DISABLED",
] as const

export type MobileNotificationTopic = (typeof MOBILE_NOTIFICATION_TOPICS)[number]
export type MobileNotificationChannel = (typeof MOBILE_NOTIFICATION_CHANNELS)[number]

export class MobileSyncError extends Error {
  constructor(
    readonly code:
      | "collection-not-found"
      | "full-resync-required"
      | "idempotency-conflict"
      | "installation-conflict"
      | "resource-not-found",
    message: string
  ) {
    super(message)
    this.name = "MobileSyncError"
  }
}

type MutationResult = Record<string, boolean | number | string | null>
type Transaction = Prisma.TransactionClient

export async function listMobileSync({
  cursor,
  limit,
  userId,
}: {
  cursor?: string
  limit: number
  userId: string
}) {
  const prisma = getPrisma()
  const requestedCursor = cursor ? BigInt(cursor) : null
  const floor = await prisma.userSyncCursorFloor.findUnique({
    select: { minimumSequence: true },
    where: { userId },
  })

  if (
    requestedCursor !== null &&
    requestedCursor < (floor?.minimumSequence ?? BigInt(0)) - BigInt(1)
  ) {
    throw new MobileSyncError(
      "full-resync-required",
      "This device's sync cursor is outside the retained history. Perform a full resync."
    )
  }

  const events = await prisma.userSyncEvent.findMany({
    orderBy: { sequence: "asc" },
    take: limit + 1,
    where: {
      userId,
      ...(requestedCursor !== null ? { sequence: { gt: requestedCursor } } : {}),
    },
  })
  const hasMore = events.length > limit
  const page = hasMore ? events.slice(0, limit) : events
  const nextCursor = page.at(-1)?.sequence.toString() ?? cursor ?? null

  return {
    events: page.map(toMobileSyncEvent),
    hasMore,
    nextCursor,
  }
}

export async function updateMobileArticleState({
  articleId,
  deviceSessionId,
  idempotencyKey,
  input,
  userId,
}: {
  articleId: string
  deviceSessionId: string
  idempotencyKey: string
  input: ArticleStateMutationRequest
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { articleId, ...input },
    operation: "ARTICLE_STATE_UPDATE",
    resultReference: input.isArchived === undefined ? undefined : "article-state",
    run: async (tx) => {
      const article = await tx.article.findFirst({
        select: { id: true },
        where: { ...articleAccessWhere(userId), id: articleId },
      })
      if (!article) {
        throw resourceNotFound()
      }

      const now = new Date()
      const previous = await tx.articleState.findUnique({
        where: { userId_articleId: { articleId: article.id, userId } },
      })
      let isRead = previous?.isRead ?? false
      let isStarred = previous?.isStarred ?? false
      let readAt = previous?.readAt ?? null
      let starredAt = previous?.starredAt ?? null
      let archivedAt = previous?.archivedAt ?? null

      if (input.isRead !== undefined) {
        isRead = input.isRead
        readAt = input.isRead ? now : null
      }
      if (input.isStarred !== undefined) {
        isStarred = input.isStarred
        starredAt = input.isStarred ? now : null
      }
      if (input.isArchived !== undefined) {
        archivedAt = input.isArchived ? now : null
        if (input.isArchived) {
          isRead = true
          readAt = now
        }
      }

      const state = await tx.articleState.upsert({
        create: { archivedAt, articleId: article.id, isRead, isStarred, readAt, starredAt, userId },
        update: { archivedAt, isRead, isStarred, readAt, starredAt },
        where: { userId_articleId: { articleId: article.id, userId } },
      })

      return articleStateResult(state)
    },
  })
}

export async function addMobileCollectionItem({
  articleId,
  collectionId,
  deviceSessionId,
  idempotencyKey,
  userId,
}: {
  articleId: string
  collectionId: string
  deviceSessionId: string
  idempotencyKey: string
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { articleId, collectionId },
    operation: "COLLECTION_ITEM_ADD",
    resultReference: collectionId,
    run: async (tx) => {
      const [article, collection] = await Promise.all([
        tx.article.findFirst({
          select: { id: true },
          where: { ...articleAccessWhere(userId), id: articleId },
        }),
        tx.articleCollection.findFirst({
          select: { id: true },
          where: { id: collectionId, userId },
        }),
      ])
      if (!article) {
        throw resourceNotFound()
      }
      if (!collection) {
        throw new MobileSyncError("collection-not-found", "That collection is unavailable.")
      }

      await tx.articleCollectionItem.upsert({
        create: { articleId: article.id, collectionId: collection.id },
        update: {},
        where: { collectionId_articleId: { articleId: article.id, collectionId: collection.id } },
      })
      return { articleId: article.id, collectionId: collection.id, removed: false }
    },
  })
}

export async function removeMobileCollectionItem({
  articleId,
  collectionId,
  deviceSessionId,
  idempotencyKey,
  userId,
}: {
  articleId: string
  collectionId: string
  deviceSessionId: string
  idempotencyKey: string
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { articleId, collectionId },
    operation: "COLLECTION_ITEM_REMOVE",
    resultReference: collectionId,
    run: async (tx) => {
      const collection = await tx.articleCollection.findFirst({
        select: { id: true },
        where: { id: collectionId, userId },
      })
      if (!collection) {
        throw new MobileSyncError("collection-not-found", "That collection is unavailable.")
      }
      const deleted = await tx.articleCollectionItem.deleteMany({
        where: { articleId, collectionId: collection.id },
      })
      return { articleId, collectionId: collection.id, removed: deleted.count > 0 }
    },
  })
}

export async function updateMobilePodcastProgress({
  deviceSessionId,
  episodeId,
  idempotencyKey,
  input,
  userId,
}: {
  deviceSessionId: string
  episodeId: string
  idempotencyKey: string
  input: PodcastProgressMutationRequest
  userId: string
}) {
  return updateMobilePodcastState({
    deviceSessionId,
    episodeId,
    idempotencyKey,
    input,
    operation: "PODCAST_EPISODE_PROGRESS_UPDATE",
    userId,
  })
}

export async function updateMobilePodcastEpisodeState({
  deviceSessionId,
  episodeId,
  idempotencyKey,
  input,
  userId,
}: {
  deviceSessionId: string
  episodeId: string
  idempotencyKey: string
  input: PodcastStateMutationRequest
  userId: string
}) {
  return updateMobilePodcastState({
    deviceSessionId,
    episodeId,
    idempotencyKey,
    input,
    operation: "PODCAST_EPISODE_STATE_UPDATE",
    userId,
  })
}

export async function listMobileNotificationPreferences(userId: string) {
  const prisma = getPrisma()
  await prisma.userNotificationPreference.createMany({
    data: MOBILE_NOTIFICATION_TOPICS.map((topic) => ({ topic, userId })),
    skipDuplicates: true,
  })
  const preferences = await prisma.userNotificationPreference.findMany({
    orderBy: { topic: "asc" },
    where: { userId },
  })
  return preferences.map(notificationPreferenceResult)
}

export async function updateMobileNotificationPreference({
  channel,
  deviceSessionId,
  idempotencyKey,
  topic,
  userId,
}: {
  channel: MobileNotificationChannel
  deviceSessionId: string
  idempotencyKey: string
  topic: MobileNotificationTopic
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { channel, topic },
    operation: "NOTIFICATION_PREFERENCE_UPDATE",
    resultReference: topic,
    run: async (tx) =>
      notificationPreferenceResult(
        await tx.userNotificationPreference.upsert({
          create: { channel, topic, userId },
          update: { channel },
          where: { userId_topic: { topic, userId } },
        })
      ),
  })
}

export async function updateNotificationPreferenceForUser({
  channel,
  topic,
  userId,
}: {
  channel: MobileNotificationChannel
  topic: MobileNotificationTopic
  userId: string
}) {
  return notificationPreferenceResult(
    await getPrisma().userNotificationPreference.upsert({
      create: { channel, topic, userId },
      update: { channel },
      where: { userId_topic: { topic, userId } },
    })
  )
}

export async function registerMobileDeviceInstallation({
  deviceSessionId,
  environment,
  idempotencyKey,
  pushToken,
  userId,
}: {
  deviceSessionId: string
  environment: "development" | "preview" | "production"
  idempotencyKey: string
  pushToken: string
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { environment, pushToken },
    operation: "DEVICE_INSTALLATION_REGISTER",
    run: async (tx) => {
      const session = await tx.deviceSession.findUnique({
        select: { mobileDeviceId: true },
        where: { id: deviceSessionId },
      })
      const tokenHash = hashMobileValue("installation-token", pushToken)
      const existing = await tx.deviceInstallation.findUnique({
        include: { deviceSession: { select: { userId: true } } },
        where: { tokenHash },
      })
      if (existing && existing.deviceSession.userId !== userId) {
        throw new MobileSyncError(
          "installation-conflict",
          "This push installation cannot be registered to this account."
        )
      }
      const installation = await tx.deviceInstallation.upsert({
        create: {
          deviceSessionId,
          mobileDeviceId: session?.mobileDeviceId ?? null,
          environment,
          lastSeenAt: new Date(),
          platform: "android",
          tokenHash,
        },
        update: {
          deviceSessionId,
          mobileDeviceId: session?.mobileDeviceId ?? null,
          disabledAt: null,
          environment,
          lastSeenAt: new Date(),
          platform: "android",
          unregisteredAt: null,
        },
        where: { tokenHash },
      })
      return {
        installationId: installation.id,
        lastSeenAt: installation.lastSeenAt.toISOString(),
        status: "ACTIVE",
      }
    },
  })
}

export async function disableMobileDeviceInstallations({ deviceSessionId }: { deviceSessionId: string }) {
  await getPrisma().deviceInstallation.updateMany({
    data: { disabledAt: new Date(), unregisteredAt: new Date() },
    where: { deviceSessionId, disabledAt: null },
  })
}

export async function unregisterMobileDeviceInstallation({
  deviceSessionId,
  idempotencyKey,
  pushToken,
}: {
  deviceSessionId: string
  idempotencyKey: string
  pushToken: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { pushToken },
    operation: "DEVICE_INSTALLATION_UNREGISTER",
    run: async (tx) => {
      const tokenHash = hashMobileValue("installation-token", pushToken)
      const installation = await tx.deviceInstallation.findFirst({
        select: { id: true, lastSeenAt: true },
        where: { deviceSessionId, tokenHash },
      })
      if (!installation) {
        throw resourceNotFound()
      }
      await tx.deviceInstallation.update({
        data: { disabledAt: new Date(), unregisteredAt: new Date() },
        where: { id: installation.id },
      })
      return {
        installationId: installation.id,
        lastSeenAt: installation.lastSeenAt.toISOString(),
        status: "DISABLED",
      }
    },
  })
}

async function updateMobilePodcastState({
  deviceSessionId,
  episodeId,
  idempotencyKey,
  input,
  operation,
  userId,
}: {
  deviceSessionId: string
  episodeId: string
  idempotencyKey: string
  input: PodcastProgressMutationRequest | PodcastStateMutationRequest
  operation: string
  userId: string
}) {
  return runIdempotentMobileMutation({
    deviceSessionId,
    idempotencyKey,
    input: { ...input, episodeId },
    operation,
    resultReference: episodeId,
    run: async (tx) => {
      const episode = await tx.podcastEpisode.findFirst({
        select: { id: true },
        where: { id: episodeId, podcast: { subscriptions: { some: { userId } } } },
      })
      if (!episode) {
        throw resourceNotFound()
      }
      const now = new Date()
      const previous = await tx.podcastEpisodeState.findUnique({
        where: { userId_episodeId: { episodeId: episode.id, userId } },
      })
      const hasProgress = "playbackPositionSeconds" in input
      const isPlayed = hasProgress ? previous?.isPlayed ?? false : input.isPlayed ?? previous?.isPlayed ?? false
      const isStarred = hasProgress ? previous?.isStarred ?? false : input.isStarred ?? previous?.isStarred ?? false
      const playbackPositionSeconds = hasProgress
        ? input.playbackPositionSeconds
        : previous?.playbackPositionSeconds ?? 0
      const playedAt = hasProgress
        ? previous?.playedAt ?? null
        : input.isPlayed === undefined
          ? previous?.playedAt ?? null
          : input.isPlayed
            ? now
            : null
      const starredAt = hasProgress
        ? previous?.starredAt ?? null
        : input.isStarred === undefined
          ? previous?.starredAt ?? null
          : input.isStarred
            ? now
            : null
      const state = await tx.podcastEpisodeState.upsert({
        create: {
          episodeId: episode.id,
          isPlayed,
          isStarred,
          playedAt,
          playbackPositionSeconds,
          starredAt,
          userId,
        },
        update: { isPlayed, isStarred, playedAt, playbackPositionSeconds, starredAt },
        where: { userId_episodeId: { episodeId: episode.id, userId } },
      })
      return podcastStateResult(state)
    },
  })
}

async function runIdempotentMobileMutation<T extends MutationResult>({
  deviceSessionId,
  idempotencyKey,
  input,
  operation,
  resultReference,
  run,
}: {
  deviceSessionId: string
  idempotencyKey: string
  input: Record<string, unknown>
  operation: string
  resultReference?: string
  run: (tx: Transaction) => Promise<T>
}): Promise<T & { replayed: boolean }> {
  const prisma = getPrisma()
  const idempotencyKeyHash = hashMobileValue("idempotency-key", idempotencyKey)
  const requestHash = hashMobileValue("mutation-request", stableJson({ input, operation }))

  try {
    return await prisma.$transaction(async (tx) => {
      const session = await tx.deviceSession.findUnique({
        select: { mobileDeviceId: true },
        where: { id: deviceSessionId },
      })
      const receiptScope = session?.mobileDeviceId
        ? { mobileDeviceId: session.mobileDeviceId }
        : { deviceSessionId }
      await tx.deviceMutationReceipt.deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - MOBILE_MUTATION_RECEIPT_RETENTION_DAYS * 86_400_000) },
          ...receiptScope,
        },
      })
      const existing = await tx.deviceMutationReceipt.findFirst({
        where: { ...receiptScope, idempotencyKeyHash },
      })
      if (existing) {
        return replayReceipt<T>({ existing, operation, requestHash })
      }
      const result = await run(tx)
      assertBoundedMutationResult(result)
      await tx.deviceMutationReceipt.create({
        data: {
          deviceSessionId,
          mobileDeviceId: session?.mobileDeviceId ?? null,
          idempotencyKeyHash,
          operation,
          requestHash,
          result: result as Prisma.InputJsonValue,
          resultReference,
        },
      })
      return { ...result, replayed: false }
    })
  } catch (error) {
    if (!isUniqueReceiptError(error)) {
      throw error
    }
    const session = await prisma.deviceSession.findUnique({
      select: { mobileDeviceId: true },
      where: { id: deviceSessionId },
    })
    const existing = await prisma.deviceMutationReceipt.findFirst({
      where: {
        ...(session?.mobileDeviceId ? { mobileDeviceId: session.mobileDeviceId } : { deviceSessionId }),
        idempotencyKeyHash,
      },
    })
    if (!existing) {
      throw error
    }
    return replayReceipt<T>({ existing, operation, requestHash })
  }
}

function replayReceipt<T extends MutationResult>({
  existing,
  operation,
  requestHash,
}: {
  existing: {
    operation: string
    requestHash: string
    result: Prisma.JsonValue
  }
  operation: string
  requestHash: string
}): T & { replayed: boolean } {
  if (existing.operation !== operation || existing.requestHash !== requestHash) {
    throw new MobileSyncError(
      "idempotency-conflict",
      "This idempotency key was already used with a different request."
    )
  }
  return { ...(existing.result as T), replayed: true }
}

function articleStateResult(state: {
  archivedAt: Date | null
  articleId: string
  isRead: boolean
  isStarred: boolean
  readAt: Date | null
  starredAt: Date | null
}) {
  return {
    archivedAt: iso(state.archivedAt),
    articleId: state.articleId,
    isRead: state.isRead,
    isStarred: state.isStarred,
    readAt: iso(state.readAt),
    starredAt: iso(state.starredAt),
  }
}

function podcastStateResult(state: {
  episodeId: string
  isPlayed: boolean
  isStarred: boolean
  playedAt: Date | null
  playbackPositionSeconds: number
  starredAt: Date | null
}) {
  return {
    episodeId: state.episodeId,
    isPlayed: state.isPlayed,
    isStarred: state.isStarred,
    playedAt: iso(state.playedAt),
    playbackPositionSeconds: state.playbackPositionSeconds,
    starredAt: iso(state.starredAt),
  }
}

function notificationPreferenceResult(preference: {
  channel: string
  topic: string
  updatedAt: Date
}) {
  return {
    channel: preference.channel as MobileNotificationChannel,
    topic: preference.topic as MobileNotificationTopic,
    updatedAt: preference.updatedAt.toISOString(),
  }
}

function resourceNotFound() {
  return new MobileSyncError("resource-not-found", "That resource is unavailable.")
}

function hashMobileValue(context: string, value: string) {
  return createHash("sha256").update(`arctic-rss-mobile:${context}:${value}`).digest("hex")
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

function assertBoundedMutationResult(result: MutationResult) {
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 4_096) {
    throw new Error("Mobile mutation result exceeded its receipt bound.")
  }
}

function isUniqueReceiptError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}
