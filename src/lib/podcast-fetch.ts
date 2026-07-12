import { safeFetchText } from "./url-safety"

export const PODCAST_FEED_MAX_BYTES = 8 * 1024 * 1024

export function fetchPodcastFeedText(url: URL) {
  return safeFetchText(url, {
    maxBytes: PODCAST_FEED_MAX_BYTES,
  })
}
