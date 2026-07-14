import {
  encodeIrcCommand,
  parseIrcLine,
  type ParsedIrcMessage,
} from "./protocol"

const MAX_RECONNECT_DELAY_MS = 60_000

export type ExternalIrcTransport = {
  close: () => void
  write: (line: string) => void
}

export type ExternalIrcSessionEvent =
  | { type: "connected" }
  | { message: ParsedIrcMessage; type: "message" }
  | { reason: string; type: "protocol-error" }
  | { type: "closed" }

export type ExternalIrcSession = {
  close: () => void
  receive: (chunk: string) => void
  sendChannelMessage: (channel: string, body: string) => void
  start: () => void
  join: (channel: string) => void
}

/**
 * This protocol adapter is transport-injected for controlled-server tests.
 * It deliberately does not contain a public-network dialer or raw-command API.
 */
export function createExternalIrcSession({
  nickname,
  onEvent,
  transport,
  username = "arctic",
}: {
  nickname: string
  onEvent: (event: ExternalIrcSessionEvent) => void
  transport: ExternalIrcTransport
  username?: string
}): ExternalIrcSession {
  let buffer = ""
  let closed = false

  function send(command: Parameters<typeof encodeIrcCommand>[0]) {
    if (closed) {
      throw new Error("External IRC session is closed.")
    }
    transport.write(encodeIrcCommand(command))
  }

  return {
    close() {
      if (closed) {
        return
      }
      closed = true
      transport.close()
      onEvent({ type: "closed" })
    },
    join(channel) {
      send({ command: "JOIN", params: [normalizeChannel(channel)] })
    },
    receive(chunk) {
      if (closed) {
        return
      }
      buffer += chunk

      if (Buffer.byteLength(buffer, "utf8") > 8_192) {
        buffer = ""
        onEvent({ reason: "Inbound IRC buffer exceeded the limit.", type: "protocol-error" })
        return
      }

      let lineEnd = buffer.indexOf("\r\n")
      while (lineEnd !== -1) {
        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)
        try {
          const message = parseIrcLine(line)
          if (message.command === "PING") {
            send({ command: "PONG", trailing: message.trailing ?? message.params[0] })
          }
          onEvent({ message, type: "message" })
        } catch (error) {
          onEvent({
            reason: error instanceof Error ? error.message : "Invalid IRC line.",
            type: "protocol-error",
          })
        }
        lineEnd = buffer.indexOf("\r\n")
      }
    },
    sendChannelMessage(channel, body) {
      const normalizedChannel = normalizeChannel(channel)
      const normalizedBody = normalizeMessageBody(body)
      send({ command: "PRIVMSG", params: [normalizedChannel], trailing: normalizedBody })
    },
    start() {
      send({ command: "CAP", params: ["LS", "302"] })
      send({ command: "NICK", params: [normalizeNickname(nickname)] })
      send({ command: "USER", params: [normalizeUsername(username), "0", "*"], trailing: "ArcticIRC" })
      onEvent({ type: "connected" })
    },
  }
}

export function calculateReconnectDelay({
  attempt,
  random = Math.random,
}: {
  attempt: number
  random?: () => number
}) {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new Error("Reconnect attempt is invalid.")
  }

  const unclamped = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** (attempt - 1))
  return Math.round(unclamped * (0.8 + random() * 0.4))
}

export function shouldOpenReconnectCircuit({
  failures,
  now,
  windowStartedAt,
}: {
  failures: number
  now: Date
  windowStartedAt: Date
}) {
  return now.getTime() - windowStartedAt.getTime() <= 5 * 60_000 && failures >= 8
}

function normalizeChannel(value: string) {
  const channel = value.trim()
  if (!/^#[A-Za-z0-9][A-Za-z0-9_\-]{0,63}$/.test(channel)) {
    throw new Error("IRC channel is invalid.")
  }
  return channel
}

function normalizeNickname(value: string) {
  const nickname = value.trim()
  if (!/^[A-Za-z][A-Za-z0-9_\-]{2,23}$/.test(nickname)) {
    throw new Error("IRC nickname is invalid.")
  }
  return nickname
}

function normalizeUsername(value: string) {
  const username = value.trim()
  if (!/^[A-Za-z][A-Za-z0-9_\-]{0,15}$/.test(username)) {
    throw new Error("IRC username is invalid.")
  }
  return username
}

function normalizeMessageBody(value: string) {
  const body = value.trim()
  if (!body || body.length > 400 || /[\r\n\u0000-\u001f\u007f]/.test(body)) {
    throw new Error("IRC message is invalid.")
  }
  return body
}
