import { describe, expect, it } from "vitest"

import {
  encodeIrcCommand,
  IrcProtocolError,
  parseIrcLine,
  redactIrcLine,
} from "./protocol"

describe("external IRC protocol boundary", () => {
  it("parses RFC-shaped lines and rejects line injection", () => {
    expect(parseIrcLine(":server 001 arctic :Welcome")).toEqual({
      command: "001",
      params: ["arctic"],
      prefix: "server",
      trailing: "Welcome",
    })
    expect(() => parseIrcLine("PRIVMSG #test :hello\r\nOPER root nope")).toThrow(IrcProtocolError)
    expect(() => encodeIrcCommand({ command: "PRIVMSG", params: ["#test\r\nJOIN #other"] })).toThrow(IrcProtocolError)
  })

  it("enforces the IRC line limit and redacts credential-bearing commands", () => {
    expect(() => encodeIrcCommand({ command: "PRIVMSG", params: ["#test"], trailing: "x".repeat(600) })).toThrow(IrcProtocolError)
    expect(redactIrcLine("AUTHENTICATE sensitive-value")).toBe("AUTHENTICATE [REDACTED]")
    expect(redactIrcLine("PRIVMSG NickServ :IDENTIFY sensitive-value")).toBe("PRIVMSG NickServ :[REDACTED]")
  })
})
