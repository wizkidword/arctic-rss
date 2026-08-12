import type { UserSyncEvent } from "@arctic-rss/api-contract"

export type MobileCacheInvalidation =
  | { kind: "all" }
  | { kind: "exact"; key: string }
  | { kind: "prefix"; prefix: string }

/**
 * Maps authoritative sync events to the mobile cache keys that can contain
 * their derived data. Keep this conservative: a new event type falls back to
 * clearing the cache rather than leaving a stale private view on a device.
 */
export function mobileCacheInvalidationsForSyncEvents(
  events: readonly UserSyncEvent[]
): readonly MobileCacheInvalidation[] {
  const invalidations: MobileCacheInvalidation[] = []
  for (const event of events) {
    switch (event.resourceType) {
      case "article-state":
        {
          const articleId = requiredPayloadId(event.payload, "articleId")
        invalidations.push(
          { kind: "exact", key: `article:${articleId}` },
          { kind: "prefix", prefix: "mobile-page:reader:" },
          { kind: "prefix", prefix: "mobile-page:search:" },
          { kind: "prefix", prefix: "saved-view:" }
        )
        break
        }
      case "collection":
        {
          const collectionId = requiredPayloadId(event.payload, "collectionId")
        invalidations.push(
          { kind: "exact", key: "collections" },
          { kind: "prefix", prefix: `mobile-page:reader:${collectionId}:` }
        )
        break
        }
      case "collection-item":
        {
          const collectionId = requiredPayloadId(event.payload, "collectionId")
        invalidations.push(
          { kind: "exact", key: "collections" },
          { kind: "prefix", prefix: `mobile-page:reader:${collectionId}:` },
          { kind: "prefix", prefix: "saved-view:" }
        )
        const articleId = optionalPayloadId(event.payload, "articleId")
        if (articleId) {
          invalidations.push({ kind: "exact", key: `article:${articleId}` })
        }
        break
        }
      case "saved-view":
        {
          const id = requiredPayloadId(event.payload, "id")
        invalidations.push(
          { kind: "exact", key: "saved-views" },
          { kind: "exact", key: `saved-view:${id}` }
        )
        break
        }
      case "feed-subscription":
      case "podcast-subscription":
        invalidations.push(
          { kind: "exact", key: "collections" },
          { kind: "exact", key: "podcasts" },
          { kind: "prefix", prefix: "mobile-page:reader:" }
        )
        break
      case "briefing":
        {
          const id = requiredPayloadId(event.payload, "id")
        invalidations.push(
          { kind: "exact", key: "briefings" },
          { kind: "exact", key: `briefing:${id}` }
        )
        break
        }
      case "podcast-episode-state":
        {
          const episodeId = requiredPayloadId(event.payload, "episodeId")
        invalidations.push(
          { kind: "exact", key: "podcasts" },
          { kind: "exact", key: `podcast:${episodeId}` }
        )
        break
        }
      case "notification-preference":
        invalidations.push({ kind: "exact", key: "notification-preferences" })
        break
      default:
        return [{ kind: "all" }]
    }
  }
  return deduplicateInvalidations(invalidations)
}

function requiredPayloadId(payload: object, key: string) {
  const value = optionalPayloadId(payload, key)
  if (!value) {
    throw new Error("Validated mobile sync event omitted a required invalidation identifier.")
  }
  return value
}

function optionalPayloadId(payload: object, key: string) {
  const value = (payload as Record<string, unknown>)[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

export function shouldInvalidateMobileCacheKey(
  cacheKey: string,
  invalidations: readonly MobileCacheInvalidation[]
) {
  return invalidations.some((invalidation) =>
    invalidation.kind === "all" ||
    (invalidation.kind === "exact" && invalidation.key === cacheKey) ||
    (invalidation.kind === "prefix" && cacheKey.startsWith(invalidation.prefix))
  )
}

function deduplicateInvalidations(invalidations: readonly MobileCacheInvalidation[]) {
  const seen = new Set<string>()
  return invalidations.filter((invalidation) => {
    const value = invalidation.kind === "all"
      ? "all"
      : `${invalidation.kind}:${invalidation.kind === "exact" ? invalidation.key : invalidation.prefix}`
    if (seen.has(value)) {
      return false
    }
    seen.add(value)
    return true
  })
}
