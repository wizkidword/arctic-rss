import { safeFetchText, type SafeFetchTextOptions } from "./url-safety"

export const PODCAST_FEED_MAX_BYTES = 8 * 1024 * 1024

export function fetchPodcastFeedText(
  url: URL,
  options: SafeFetchTextOptions = {}
) {
  return safeFetchText(url, {
    ...options,
    maxBytes: PODCAST_FEED_MAX_BYTES,
  })
}
