import type { PendingMobileMutation } from "@arctic-rss/mobile-client"

export function mobileMutationLabel(mutation: PendingMobileMutation) {
  switch (mutation.operation) {
    case "ARTICLE_STATE_UPDATE":
      return "Article change"
    case "COLLECTION_ITEM_ADD":
      return "Save to collection"
    case "COLLECTION_ITEM_REMOVE":
      return "Remove from collection"
    case "PODCAST_PROGRESS_UPDATE":
      return "Playback progress"
    case "PODCAST_STATE_UPDATE":
      return "Episode change"
    case "NOTIFICATION_PREFERENCE_UPDATE":
      return "Notification preference"
  }
}

export function mobileMutationReason(mutation: PendingMobileMutation) {
  switch (mutation.lastErrorCode) {
    case "IDEMPOTENCY_KEY_REUSED":
      return "This saved change conflicts with a different change on the service."
    case "RESOURCE_NOT_FOUND":
      return "The item is no longer available."
    case "RETRY_LIMIT_REACHED":
      return "This change could not be sent after several attempts."
    default:
      return mutation.state === "CONFLICT"
        ? "This saved change needs review."
        : "This saved change cannot be sent as written."
  }
}

export function mobileMutationResourcePath(mutation: PendingMobileMutation) {
  switch (mutation.operation) {
    case "ARTICLE_STATE_UPDATE":
      return `/article/${mutation.resourceId}`
    case "COLLECTION_ITEM_ADD":
    case "COLLECTION_ITEM_REMOVE":
      return `/collection/${mutation.resourceId.split(":", 1)[0]}`
    case "PODCAST_PROGRESS_UPDATE":
    case "PODCAST_STATE_UPDATE":
      return `/podcast/${mutation.resourceId}`
    case "NOTIFICATION_PREFERENCE_UPDATE":
      return "/notifications"
  }
}
