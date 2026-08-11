import { assertQueuedMutation, type IdempotentRequest } from "./api"

export const MOBILE_OFFLINE_LIMITS = {
  maximumCacheBytes: 20 * 1024 * 1024,
  maximumCachedEntries: 300,
  maximumEntryAgeMs: 30 * 24 * 60 * 60 * 1_000,
  maximumPendingMutations: 100,
} as const

export type MobileOfflineLimits = {
  maximumCacheBytes: number
  maximumCachedEntries: number
  maximumEntryAgeMs: number
  maximumPendingMutations: number
}

export type CachedMobileEntry = {
  accessedAt: number
  byteCount: number
  key: string
  updatedAt: number
}

export const MOBILE_MUTATION_STATES = [
  "PENDING",
  "SENDING",
  "RETRYABLE_FAILURE",
  "CONFLICT",
  "PERMANENT_FAILURE",
  "COMPLETED",
] as const

export type MobileMutationState = (typeof MOBILE_MUTATION_STATES)[number]

export type QueuedMobileMutation = IdempotentRequest & {
  createdAt: number
  expectedVersion?: string
}

export type MobileMutationOwner = {
  mobileDeviceId: string
  userId: string
}

export type PendingMobileMutation = QueuedMobileMutation & {
  attemptCount: number
  id: string
  lastAttemptAt: number | null
  lastErrorCode: string | null
  mobileDeviceId: string
  nextAttemptAt: number | null
  operation: MobileMutationOperation
  ownerUserId: string
  resourceId: string
  state: MobileMutationState
  updatedAt: number
}

export type MobileMutationOperation =
  | "ARTICLE_STATE_UPDATE"
  | "COLLECTION_ITEM_ADD"
  | "COLLECTION_ITEM_REMOVE"
  | "NOTIFICATION_PREFERENCE_UPDATE"
  | "PODCAST_PROGRESS_UPDATE"
  | "PODCAST_STATE_UPDATE"

const MAX_MOBILE_MUTATION_ATTEMPTS = 10
const MAX_MOBILE_MUTATION_ERROR_CODE_LENGTH = 80
const MAX_MOBILE_MUTATION_VERSION_LENGTH = 256
const RETRY_BACKOFF_BASE_MS = 5_000
const RETRY_BACKOFF_MAX_MS = 60 * 60_000

export function selectMobileCacheEvictions(
  entries: readonly CachedMobileEntry[],
  now: number,
  limits: MobileOfflineLimits = MOBILE_OFFLINE_LIMITS
) {
  const expired = entries.filter((entry) => now - entry.updatedAt > limits.maximumEntryAgeMs)
  const retained = entries
    .filter((entry) => !expired.includes(entry))
    .sort((left, right) => left.accessedAt - right.accessedAt)
  const evictions = new Set(expired.map((entry) => entry.key))
  let totalBytes = retained.reduce((total, entry) => total + entry.byteCount, 0)

  while (
    retained.length - [...evictions].filter((key) => retained.some((entry) => entry.key === key)).length >
      limits.maximumCachedEntries ||
    totalBytes > limits.maximumCacheBytes
  ) {
    const oldest = retained.find((entry) => !evictions.has(entry.key))
    if (!oldest) {
      break
    }
    evictions.add(oldest.key)
    totalBytes -= oldest.byteCount
  }

  return [...evictions]
}

export function createPendingMobileMutation(
  input: QueuedMobileMutation,
  owner: MobileMutationOwner
): PendingMobileMutation {
  assertQueuedMutation(input)
  const descriptor = describeMobileMutation(input)
  const mutation: PendingMobileMutation = {
    ...input,
    attemptCount: 0,
    id: `mutation:${input.idempotencyKey}`,
    lastAttemptAt: null,
    lastErrorCode: null,
    mobileDeviceId: owner.mobileDeviceId,
    nextAttemptAt: null,
    operation: descriptor.operation,
    ownerUserId: owner.userId,
    resourceId: descriptor.resourceId,
    state: "PENDING",
    updatedAt: input.createdAt,
  }
  assertPendingMobileMutation(mutation)
  return mutation
}

export function startPendingMobileMutation(
  mutation: PendingMobileMutation,
  now: number
): PendingMobileMutation {
  assertPendingMobileMutation(mutation)
  if (!isReplayableMobileMutation(mutation, now)) {
    throw new Error("This mobile mutation is not ready to replay.")
  }
  if (mutation.attemptCount >= MAX_MOBILE_MUTATION_ATTEMPTS) {
    return failPendingMobileMutation(mutation, {
      code: "RETRY_LIMIT_REACHED",
      state: "PERMANENT_FAILURE",
      updatedAt: now,
    })
  }
  return {
    ...mutation,
    attemptCount: mutation.attemptCount + 1,
    lastAttemptAt: now,
    nextAttemptAt: null,
    state: "SENDING",
    updatedAt: now,
  }
}

export function completePendingMobileMutation(
  mutation: PendingMobileMutation,
  now: number
): PendingMobileMutation {
  assertPendingMobileMutation(mutation)
  return {
    ...mutation,
    nextAttemptAt: null,
    state: "COMPLETED",
    updatedAt: now,
  }
}

export function failPendingMobileMutation(
  mutation: PendingMobileMutation,
  {
    code,
    state,
    updatedAt,
  }: {
    code: string
    state: Extract<MobileMutationState, "CONFLICT" | "PERMANENT_FAILURE" | "RETRYABLE_FAILURE">
    updatedAt: number
  }
): PendingMobileMutation {
  assertPendingMobileMutation(mutation)
  if (!code || code.length > MAX_MOBILE_MUTATION_ERROR_CODE_LENGTH) {
    throw new Error("Mobile mutation failures require a bounded error code.")
  }
  return {
    ...mutation,
    lastErrorCode: code,
    nextAttemptAt:
      state === "RETRYABLE_FAILURE"
        ? updatedAt + mobileMutationRetryDelayMs(mutation.attemptCount)
        : null,
    state,
    updatedAt,
  }
}

export function retryPendingMobileMutation(
  mutation: PendingMobileMutation,
  now: number
): PendingMobileMutation {
  assertPendingMobileMutation(mutation)
  if (mutation.state !== "CONFLICT" && mutation.state !== "PERMANENT_FAILURE") {
    throw new Error("Only terminal mobile mutations can be retried manually.")
  }
  return {
    ...mutation,
    nextAttemptAt: null,
    state: "PENDING",
    updatedAt: now,
  }
}

export function isReplayableMobileMutation(
  mutation: PendingMobileMutation,
  now: number
) {
  return (
    (mutation.state === "PENDING" || mutation.state === "RETRYABLE_FAILURE") &&
    (mutation.nextAttemptAt === null || mutation.nextAttemptAt <= now)
  )
}

export function mobileMutationRetryDelayMs(attemptCount: number) {
  const exponent = Math.max(0, Math.min(10, Math.trunc(attemptCount) - 1))
  return Math.min(RETRY_BACKOFF_MAX_MS, RETRY_BACKOFF_BASE_MS * 2 ** exponent)
}

export function describeMobileMutation(
  request: IdempotentRequest
): { operation: MobileMutationOperation; resourceId: string } {
  const article = request.path.match(/^\/api\/v1\/articles\/([A-Za-z0-9_-]+)\/state$/)
  if (article) {
    return { operation: "ARTICLE_STATE_UPDATE", resourceId: article[1] }
  }
  const collection = request.path.match(
    /^\/api\/v1\/collections\/([A-Za-z0-9_-]+)\/items(?:\/([A-Za-z0-9_-]+))?$/
  )
  if (collection) {
    const articleId = collection[2] ?? readArticleId(request.body)
    if (!articleId) {
      throw new Error("Queued collection mutations require an article identifier.")
    }
    return {
      operation: request.method === "DELETE" ? "COLLECTION_ITEM_REMOVE" : "COLLECTION_ITEM_ADD",
      resourceId: `${collection[1]}:${articleId}`,
    }
  }
  const podcast = request.path.match(
    /^\/api\/v1\/podcast-episodes\/([A-Za-z0-9_-]+)\/(progress|state)$/
  )
  if (podcast) {
    return {
      operation: podcast[2] === "progress" ? "PODCAST_PROGRESS_UPDATE" : "PODCAST_STATE_UPDATE",
      resourceId: podcast[1],
    }
  }
  const notification = request.path.match(
    /^\/api\/v1\/notification-preferences\/([A-Z_]+)$/
  )
  if (notification) {
    return { operation: "NOTIFICATION_PREFERENCE_UPDATE", resourceId: notification[1] }
  }
  throw new Error("Queued mobile mutation is outside the bounded v1 offline scope.")
}

export function assertPendingMobileMutation(mutation: PendingMobileMutation) {
  assertQueuedMutation(mutation)
  if (!Number.isFinite(mutation.createdAt) || mutation.createdAt <= 0) {
    throw new Error("Queued mobile mutations require a creation timestamp.")
  }
  if (!Number.isFinite(mutation.updatedAt) || mutation.updatedAt < mutation.createdAt) {
    throw new Error("Queued mobile mutations require a valid update timestamp.")
  }
  if (!Number.isInteger(mutation.attemptCount) || mutation.attemptCount < 0 || mutation.attemptCount > MAX_MOBILE_MUTATION_ATTEMPTS) {
    throw new Error("Queued mobile mutations require a bounded attempt count.")
  }
  if (!MOBILE_MUTATION_STATES.includes(mutation.state)) {
    throw new Error("Queued mobile mutations require a recognized state.")
  }
  if (
    !mutation.id ||
    !mutation.ownerUserId ||
    !mutation.mobileDeviceId ||
    mutation.resourceId.length > 256 ||
    mutation.id !== `mutation:${mutation.idempotencyKey}`
  ) {
    throw new Error("Queued mobile mutation ownership metadata is invalid.")
  }
  if (
    (mutation.lastAttemptAt !== null && !Number.isFinite(mutation.lastAttemptAt)) ||
    (mutation.nextAttemptAt !== null && !Number.isFinite(mutation.nextAttemptAt)) ||
    (mutation.lastErrorCode !== null &&
      (!mutation.lastErrorCode || mutation.lastErrorCode.length > MAX_MOBILE_MUTATION_ERROR_CODE_LENGTH)) ||
    (mutation.expectedVersion !== undefined && mutation.expectedVersion.length > MAX_MOBILE_MUTATION_VERSION_LENGTH)
  ) {
    throw new Error("Queued mobile mutation retry metadata is invalid.")
  }
  const descriptor = describeMobileMutation(mutation)
  if (descriptor.operation !== mutation.operation || descriptor.resourceId !== mutation.resourceId) {
    throw new Error("Queued mobile mutation operation metadata is invalid.")
  }
  if (JSON.stringify(mutation).length > 10_000) {
    throw new Error("Queued mobile mutations must remain small and contain no article bodies.")
  }
}

function readArticleId(body: Record<string, unknown> | undefined) {
  const articleId = body?.articleId
  return typeof articleId === "string" && /^[A-Za-z0-9_-]+$/.test(articleId)
    ? articleId
    : null
}
