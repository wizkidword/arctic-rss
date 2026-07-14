import { describe, expect, it } from "vitest"

import {
  ChatCommandParseError,
  listChatCommandSuggestions,
  parseChatCommand,
} from "./commands"

describe("chat commands", () => {
  it("parses the member commands into typed operations", () => {
    expect(parseChatCommand("/join #ai")).toEqual({ slug: "ai", type: "join" })
    expect(parseChatCommand("/part taking a break")).toEqual({ reason: "taking a break", type: "part" })
    expect(parseChatCommand("/me waves hello")).toEqual({ body: "waves hello", type: "action" })
    expect(parseChatCommand("/nick Northern_Lights")).toEqual({ handle: "northern_lights", type: "nick" })
    expect(parseChatCommand("/topic Models and practice")).toEqual({ topic: "Models and practice", type: "topic" })
    expect(parseChatCommand("/whois Northern_Lights")).toEqual({ handle: "northern_lights", type: "whois" })
  })

  it("parses only structured moderation operations", () => {
    expect(parseChatCommand("/invite northernlights #ai")).toEqual({ handle: "northernlights", slug: "ai", type: "invite" })
    expect(parseChatCommand("/kick northernlights too noisy")).toEqual({ handle: "northernlights", reason: "too noisy", type: "kick" })
    expect(parseChatCommand("/ban northernlights 7d repeated spam")).toEqual({ duration: "7d", handle: "northernlights", reason: "repeated spam", type: "ban" })
    expect(parseChatCommand("/unban northernlights")).toEqual({ handle: "northernlights", type: "unban" })
    expect(parseChatCommand("/mute northernlights 15m")).toEqual({ duration: "15m", handle: "northernlights", type: "mute" })
    expect(parseChatCommand("/ignore northernlights")).toEqual({ handle: "northernlights", type: "ignore" })
    expect(parseChatCommand("/unignore northernlights")).toEqual({ handle: "northernlights", type: "unignore" })
  })

  it("keeps local utility commands local", () => {
    expect(parseChatCommand("/clear")).toEqual({ type: "clear" })
    expect(parseChatCommand("/rooms science")).toEqual({ search: "science", type: "rooms" })
    expect(parseChatCommand("/help topic")).toEqual({ command: "topic", type: "help" })
    expect(listChatCommandSuggestions("/to")).toEqual(["/topic"])
  })

  it("rejects malformed and unknown command lines rather than treating them as raw server text", () => {
    for (const input of ["hello", "/", "/raw MODE #ai +o someone", "/join", "/me", "/mute northernlights forever"]) {
      expect(() => parseChatCommand(input)).toThrow(ChatCommandParseError)
    }
  })
})
