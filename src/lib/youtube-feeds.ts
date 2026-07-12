const YOUTUBE_CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_USER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

export function youtubeFeedUrlForInput(input: URL) {
  if (!isYouTubeHost(input.hostname)) {
    return null
  }

  if (isYouTubeFeedUrl(input)) {
    const channelId = normalizedYouTubeChannelId(
      input.searchParams.get("channel_id")
    )
    const user = normalizedYouTubeUser(input.searchParams.get("user"))

    if (channelId) {
      return youtubeFeedUrlFromChannelId(channelId)
    }

    if (user) {
      return youtubeFeedUrlFromUser(user)
    }

    return null
  }

  const [, channelIdPath, channelId] =
    input.pathname.match(/^\/(channel)\/([^/?#]+)/i) ?? []

  if (channelIdPath && channelId) {
    const normalizedChannelId = normalizedYouTubeChannelId(channelId)

    return normalizedChannelId
      ? youtubeFeedUrlFromChannelId(normalizedChannelId)
      : null
  }

  const [, userPath, user] = input.pathname.match(/^\/(user)\/([^/?#]+)/i) ?? []

  if (userPath && user) {
    const normalizedUser = normalizedYouTubeUser(user)

    return normalizedUser ? youtubeFeedUrlFromUser(normalizedUser) : null
  }

  return null
}

export function youtubeFeedUrlFromChannelId(channelId: string) {
  const normalizedChannelId = normalizedYouTubeChannelId(channelId)

  if (!normalizedChannelId) {
    return null
  }

  return `https://www.youtube.com/feeds/videos.xml?channel_id=${normalizedChannelId}`
}

export function extractYouTubeChannelIdFromHtml(html: string) {
  const patterns = [
    /<meta[^>]+itemprop=["']channelId["'][^>]+content=["'](UC[A-Za-z0-9_-]{22})["'][^>]*>/i,
    /<meta[^>]+content=["'](UC[A-Za-z0-9_-]{22})["'][^>]+itemprop=["']channelId["'][^>]*>/i,
    /"(?:externalId|channelId|browseId)"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/,
    /youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    const channelId = normalizedYouTubeChannelId(match?.[1])

    if (channelId) {
      return channelId
    }
  }

  return null
}

export function extractYouTubeVideoId(input: string) {
  let url: URL

  try {
    url = new URL(input)
  } catch {
    return null
  }

  const hostname = normalizeHostname(url.hostname)

  if (hostname === "youtu.be") {
    return normalizedYouTubeVideoId(url.pathname.split("/").filter(Boolean)[0])
  }

  if (!isYouTubeHost(hostname) && !isYouTubeNoCookieHost(hostname)) {
    return null
  }

  const watchVideoId = normalizedYouTubeVideoId(url.searchParams.get("v"))

  if (watchVideoId) {
    return watchVideoId
  }

  const segments = url.pathname.split("/").filter(Boolean)
  const videoPathIndex = segments.findIndex((segment) =>
    ["embed", "shorts", "v", "live"].includes(segment.toLowerCase())
  )

  if (videoPathIndex >= 0) {
    return normalizedYouTubeVideoId(segments[videoPathIndex + 1])
  }

  return null
}

export function isYouTubeHost(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname)

  return (
    normalizedHostname === "youtube.com" ||
    normalizedHostname.endsWith(".youtube.com") ||
    normalizedHostname === "youtu.be"
  )
}

function isYouTubeFeedUrl(url: URL) {
  return (
    normalizeHostname(url.hostname).endsWith("youtube.com") &&
    url.pathname === "/feeds/videos.xml"
  )
}

function isYouTubeNoCookieHost(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname)

  return (
    normalizedHostname === "youtube-nocookie.com" ||
    normalizedHostname.endsWith(".youtube-nocookie.com")
  )
}

function youtubeFeedUrlFromUser(user: string) {
  return `https://www.youtube.com/feeds/videos.xml?user=${encodeURIComponent(
    user
  )}`
}

function normalizedYouTubeChannelId(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && YOUTUBE_CHANNEL_ID_PATTERN.test(normalizedValue)
    ? normalizedValue
    : null
}

function normalizedYouTubeUser(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && YOUTUBE_USER_PATTERN.test(normalizedValue)
    ? normalizedValue
    : null
}

function normalizedYouTubeVideoId(value: string | null | undefined) {
  const normalizedValue = value?.trim()

  return normalizedValue && YOUTUBE_VIDEO_ID_PATTERN.test(normalizedValue)
    ? normalizedValue
    : null
}

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "")
}
