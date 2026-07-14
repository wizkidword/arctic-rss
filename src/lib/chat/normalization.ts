import {
  createDiscoverInterestGroups,
} from "../discover-interests"
import {
  getDiscoverDirectory,
  type DiscoverDirectory,
} from "../discover-directory"

const CHAT_HANDLE_PATTERN = /^[a-z][a-z0-9_-]{2,23}$/
const CHAT_INTEREST_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/
const CHAT_ROOM_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,47}$/
const MAX_ROOM_INTERESTS = 3

export const RESERVED_CHAT_HANDLES = new Set([
  "admin",
  "administrator",
  "arctic",
  "arctic-rss",
  "arcticbot",
  "arcticirc",
  "bot",
  "moderator",
  "mod",
  "owner",
  "root",
  "staff",
  "support",
  "system",
])

export const RESERVED_CHAT_ROOM_SLUGS = new Set([
  "admin",
  "api",
  "discover",
  "help",
  "irc",
  "login",
  "moderation",
  "profile",
  "settings",
  "status",
  "system",
])

export class ChatNormalizationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChatNormalizationError"
  }
}

export type ChatInterestOption = {
  id: string
  label: string
}

export type DiscoverDirectoryLoader = () => Promise<DiscoverDirectory>

export function normalizeChatHandle(value: string) {
  const normalized = normalizeAsciiInput(value, "Chat handles")

  if (!CHAT_HANDLE_PATTERN.test(normalized)) {
    throw new ChatNormalizationError(
      "Chat handles must be 3–24 lowercase letters, numbers, hyphens, or underscores and start with a letter."
    )
  }

  if (RESERVED_CHAT_HANDLES.has(normalized)) {
    throw new ChatNormalizationError("That chat handle is reserved.")
  }

  return normalized
}

export function normalizeChatRoomSlug(value: string) {
  const trimmed = value.trim()
  const withoutPrefix = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed
  const normalized = normalizeAsciiInput(withoutPrefix, "Room slugs")

  if (!CHAT_ROOM_SLUG_PATTERN.test(normalized)) {
    throw new ChatNormalizationError(
      "Room slugs must be 2–48 lowercase letters, numbers, hyphens, or underscores."
    )
  }

  if (RESERVED_CHAT_ROOM_SLUGS.has(normalized)) {
    throw new ChatNormalizationError("That room slug is reserved.")
  }

  return normalized
}

export function normalizeChatInterestId(value: string) {
  const normalized = normalizeAsciiInput(value, "Interest IDs")

  if (!CHAT_INTEREST_PATTERN.test(normalized)) {
    throw new ChatNormalizationError("That interest ID is not valid.")
  }

  return normalized
}

export async function listCanonicalChatInterestOptions(
  loadDirectory: DiscoverDirectoryLoader = getDiscoverDirectory
): Promise<ChatInterestOption[]> {
  const directory = await loadDirectory()

  return createDiscoverInterestGroups(directory).map((interest) => ({
    id: interest.id,
    label: interest.label,
  }))
}

export async function validateChatInterestIds(
  values: readonly string[],
  loadDirectory: DiscoverDirectoryLoader = getDiscoverDirectory
) {
  const interestIds = [...new Set(values.map(normalizeChatInterestId))]

  if (!interestIds.length) {
    throw new ChatNormalizationError("Choose at least one room interest.")
  }

  if (interestIds.length > MAX_ROOM_INTERESTS) {
    throw new ChatNormalizationError(
      `Choose at most ${MAX_ROOM_INTERESTS} room interests.`
    )
  }

  const options = await listCanonicalChatInterestOptions(loadDirectory)
  const knownInterestIds = new Set(options.map((option) => option.id))
  const unknownInterestIds = interestIds.filter(
    (interestId) => !knownInterestIds.has(interestId)
  )

  if (unknownInterestIds.length) {
    throw new ChatNormalizationError("Choose valid Arctic RSS interests.")
  }

  return interestIds
}

function normalizeAsciiInput(value: string, label: string) {
  const trimmed = value.trim()

  if (!trimmed || /[^\x20-\x7e]/.test(trimmed)) {
    throw new ChatNormalizationError(`${label} must use printable ASCII only.`)
  }

  return trimmed.toLowerCase()
}
