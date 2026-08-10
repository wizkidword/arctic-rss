import type { IdempotentRequest } from "./api"

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

export type PendingMobileMutation = IdempotentRequest & {
  createdAt: number
}

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

export function assertPendingMobileMutation(mutation: PendingMobileMutation) {
  if (!Number.isFinite(mutation.createdAt) || mutation.createdAt <= 0) {
    throw new Error("Queued mobile mutations require a creation timestamp.")
  }
  if (JSON.stringify(mutation).length > 10_000) {
    throw new Error("Queued mobile mutations must remain small and contain no article bodies.")
  }
}
