const MAX_IRC_LINE_BYTES = 512
const IRC_COMMAND_PATTERN = /^[A-Z][A-Z0-9]{0,15}$/
const IRC_MIDDLE_PARAMETER_PATTERN = /^[^\s:\r\n]+$/

export type ParsedIrcMessage = {
  command: string
  params: string[]
  prefix?: string
  trailing?: string
}

export class IrcProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IrcProtocolError"
  }
}

export function parseIrcLine(value: string): ParsedIrcMessage {
  if (
    !value ||
    value.includes("\r") ||
    value.includes("\n") ||
    Buffer.byteLength(value, "utf8") > MAX_IRC_LINE_BYTES - 2
  ) {
    throw new IrcProtocolError("IRC line is invalid.")
  }

  let remaining = value
  let prefix: string | undefined

  if (remaining.startsWith(":")) {
    const separator = remaining.indexOf(" ")
    if (separator <= 1) {
      throw new IrcProtocolError("IRC prefix is invalid.")
    }
    prefix = remaining.slice(1, separator)
    remaining = remaining.slice(separator + 1)
  }

  const [commandToken, ...rest] = remaining.split(" ")
  const command = commandToken.toUpperCase()

  if (!/^(?:[A-Z][A-Z0-9]{0,15}|\d{3})$/.test(command)) {
    throw new IrcProtocolError("IRC command is invalid.")
  }

  const params: string[] = []
  let trailing: string | undefined
  let cursor = rest.join(" ").trimStart()

  while (cursor) {
    if (cursor.startsWith(":")) {
      trailing = cursor.slice(1)
      break
    }

    const separator = cursor.indexOf(" ")
    const parameter = separator === -1 ? cursor : cursor.slice(0, separator)

    if (!IRC_MIDDLE_PARAMETER_PATTERN.test(parameter)) {
      throw new IrcProtocolError("IRC parameter is invalid.")
    }

    params.push(parameter)
    cursor = separator === -1 ? "" : cursor.slice(separator + 1).trimStart()
  }

  return { command, params, prefix, trailing }
}

export function encodeIrcCommand({
  command,
  params = [],
  trailing,
}: {
  command: string
  params?: readonly string[]
  trailing?: string
}) {
  const normalizedCommand = command.toUpperCase()

  if (!IRC_COMMAND_PATTERN.test(normalizedCommand)) {
    throw new IrcProtocolError("IRC command is invalid.")
  }

  if (params.some((parameter) => !IRC_MIDDLE_PARAMETER_PATTERN.test(parameter))) {
    throw new IrcProtocolError("IRC parameter is invalid.")
  }

  if (trailing?.includes("\r") || trailing?.includes("\n")) {
    throw new IrcProtocolError("IRC trailing text is invalid.")
  }

  const line = [
    normalizedCommand,
    ...params,
    ...(trailing === undefined ? [] : [`:${trailing}`]),
  ].join(" ")

  if (Buffer.byteLength(`${line}\r\n`, "utf8") > MAX_IRC_LINE_BYTES) {
    throw new IrcProtocolError("IRC line exceeds the protocol limit.")
  }

  return `${line}\r\n`
}

export function redactIrcLine(value: string) {
  const parsed = parseIrcLine(value.replace(/[\r\n]+$/, ""))

  if (parsed.command === "PASS" || parsed.command === "AUTHENTICATE") {
    return `${parsed.command} [REDACTED]`
  }

  if (
    parsed.command === "PRIVMSG" &&
    parsed.params[0]?.toLowerCase() === "nickserv" &&
    /^(?:identify|register)\b/i.test(parsed.trailing ?? "")
  ) {
    return "PRIVMSG NickServ :[REDACTED]"
  }

  return value.replace(/[\r\n]+$/, "")
}
