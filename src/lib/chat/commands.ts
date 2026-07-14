const MAX_COMMAND_TEXT_LENGTH = 2_000
const DURATION_PATTERN = /^(?:[1-9]\d{0,4})(?:m|h|d|w)$/
const CHAT_HANDLE_PATTERN = /^[a-z][a-z0-9_-]{2,23}$/
const CHAT_ROOM_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{1,47}$/
const RESERVED_HANDLES = new Set([
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
const RESERVED_ROOM_SLUGS = new Set([
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

export type ChatCommand =
  | { type: "join"; slug: string }
  | { type: "part"; reason?: string }
  | { type: "action"; body: string }
  | { type: "nick"; handle: string }
  | { type: "topic"; topic?: string }
  | { type: "whois"; handle: string }
  | { type: "invite"; handle: string; slug?: string }
  | { type: "kick"; handle: string; reason?: string }
  | { type: "ban"; duration?: string; handle: string; reason?: string }
  | { type: "unban"; handle: string }
  | { type: "mute"; duration?: string; handle: string }
  | { type: "ignore"; handle: string }
  | { type: "unignore"; handle: string }
  | { type: "clear" }
  | { type: "rooms"; search?: string }
  | { type: "help"; command?: string }

export const CHAT_COMMAND_NAMES = [
  "join",
  "part",
  "me",
  "nick",
  "topic",
  "whois",
  "invite",
  "kick",
  "ban",
  "unban",
  "mute",
  "ignore",
  "unignore",
  "clear",
  "rooms",
  "help",
] as const

export class ChatCommandParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ChatCommandParseError"
  }
}

/**
 * Parses only the small, typed native command vocabulary. It intentionally
 * has no escape hatch for relaying arbitrary command lines to a server.
 */
export function parseChatCommand(input: string): ChatCommand {
  const text = input.trim()

  if (!text.startsWith("/")) {
    throw new ChatCommandParseError("Commands must start with a slash.")
  }

  const match = /^\/([^\s/]+)(?:\s+([\s\S]*))?$/.exec(text)

  if (!match) {
    throw new ChatCommandParseError("Enter a command name after the slash.")
  }

  const command = match[1].toLowerCase()
  const rest = match[2]?.trim() ?? ""

  switch (command) {
    case "join":
      return { slug: parseRoom(rest, "/join #room"), type: "join" }
    case "part":
      return { reason: optionalText(rest), type: "part" }
    case "me":
      return { body: requiredText(rest, "/me action text"), type: "action" }
    case "nick":
      return { handle: parseHandle(rest, "/nick newhandle"), type: "nick" }
    case "topic":
      return { topic: optionalText(rest), type: "topic" }
    case "whois":
      return { handle: parseHandle(rest, "/whois handle"), type: "whois" }
    case "invite": {
      const [handle, room, ...extra] = words(rest)
      if (!handle || extra.length) {
        throw usage("/invite handle [#room]")
      }
      return {
        handle: parseHandle(handle, "/invite handle [#room]"),
        slug: room ? parseRoom(room, "/invite handle [#room]") : undefined,
        type: "invite",
      }
    }
    case "kick": {
      const [handle, ...reason] = words(rest)
      return {
        handle: parseHandle(handle, "/kick handle [reason]"),
        reason: optionalText(reason.join(" ")),
        type: "kick",
      }
    }
    case "ban":
      return parseTimedTarget("ban", rest, "/ban handle [duration] [reason]")
    case "unban":
      return { handle: parseHandle(rest, "/unban handle"), type: "unban" }
    case "mute": {
      const [handle, duration, ...extra] = words(rest)
      if (!handle || extra.length || (duration && !DURATION_PATTERN.test(duration))) {
        throw usage("/mute handle [duration]")
      }
      return {
        duration,
        handle: parseHandle(handle, "/mute handle [duration]"),
        type: "mute",
      }
    }
    case "ignore":
      return { handle: parseHandle(rest, "/ignore handle"), type: "ignore" }
    case "unignore":
      return { handle: parseHandle(rest, "/unignore handle"), type: "unignore" }
    case "clear":
      if (rest) {
        throw usage("/clear")
      }
      return { type: "clear" }
    case "rooms":
      return { search: optionalText(rest), type: "rooms" }
    case "help":
      if (rest && !CHAT_COMMAND_NAMES.includes(rest.toLowerCase() as (typeof CHAT_COMMAND_NAMES)[number])) {
        throw new ChatCommandParseError(`Unknown command: /${rest.toLowerCase()}.`)
      }
      return { command: rest.toLowerCase() || undefined, type: "help" }
    default:
      throw new ChatCommandParseError(`Unknown command: /${command}. Type /help for commands.`)
  }
}

export function listChatCommandSuggestions(input: string) {
  const match = /^\/([^\s/]*)$/.exec(input.trim())

  if (!match) {
    return []
  }

  const prefix = match[1].toLowerCase()
  return CHAT_COMMAND_NAMES.filter((command) => command.startsWith(prefix)).map(
    (command) => `/${command}`
  )
}

function parseTimedTarget(
  type: "ban",
  text: string,
  syntax: string
): Extract<ChatCommand, { type: "ban" }> {
  const [handle, possibleDuration, ...remaining] = words(text)

  if (!handle) {
    throw usage(syntax)
  }

  const hasDuration = Boolean(possibleDuration && DURATION_PATTERN.test(possibleDuration))
  const reason = optionalText((hasDuration ? remaining : [possibleDuration, ...remaining]).filter(Boolean).join(" "))

  return {
    duration: hasDuration ? possibleDuration : undefined,
    handle: parseHandle(handle, syntax),
    reason,
    type,
  }
}

function parseHandle(value: string | undefined, syntax: string) {
  if (!value || words(value).length !== 1) {
    throw usage(syntax)
  }

  try {
    return normalizeCommandHandle(value)
  } catch (error) {
    throw toCommandError(error)
  }
}

function parseRoom(value: string | undefined, syntax: string) {
  if (!value || words(value).length !== 1) {
    throw usage(syntax)
  }

  try {
    return normalizeCommandRoomSlug(value)
  } catch (error) {
    throw toCommandError(error)
  }
}

function requiredText(value: string, syntax: string) {
  return optionalText(value) ?? (() => { throw usage(syntax) })()
}

function optionalText(value: string) {
  const text = value.trim()

  if (!text) {
    return undefined
  }

  if (text.length > MAX_COMMAND_TEXT_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    throw new ChatCommandParseError("Command text is invalid.")
  }

  return text
}

function words(value: string) {
  return value.trim() ? value.trim().split(/\s+/) : []
}

function usage(syntax: string) {
  return new ChatCommandParseError(`Usage: ${syntax}`)
}

function toCommandError(error: unknown) {
  if (error instanceof Error) {
    return new ChatCommandParseError(error.message)
  }

  return new ChatCommandParseError("Command input is invalid.")
}

/**
 * The browser parser must not import the server normalization module because
 * that module also exposes discovery-backed validation. Keep these lexical
 * checks in sync with the persisted handle and room-slug rules.
 */
function normalizeCommandHandle(value: string) {
  const normalized = normalizeCommandAscii(value, "Chat handles")

  if (!CHAT_HANDLE_PATTERN.test(normalized)) {
    throw new Error(
      "Chat handles must be 3–24 lowercase letters, numbers, hyphens, or underscores and start with a letter."
    )
  }

  if (RESERVED_HANDLES.has(normalized)) {
    throw new Error("That chat handle is reserved.")
  }

  return normalized
}

function normalizeCommandRoomSlug(value: string) {
  const withoutPrefix = value.trim().startsWith("#") ? value.trim().slice(1) : value.trim()
  const normalized = normalizeCommandAscii(withoutPrefix, "Room slugs")

  if (!CHAT_ROOM_SLUG_PATTERN.test(normalized)) {
    throw new Error("Room slugs must be 2–48 lowercase letters, numbers, hyphens, or underscores.")
  }

  if (RESERVED_ROOM_SLUGS.has(normalized)) {
    throw new Error("That room slug is reserved.")
  }

  return normalized
}

function normalizeCommandAscii(value: string, label: string) {
  const trimmed = value.trim()

  if (!trimmed || /[^\x20-\x7e]/.test(trimmed)) {
    throw new Error(`${label} must use printable ASCII only.`)
  }

  return trimmed.toLowerCase()
}
