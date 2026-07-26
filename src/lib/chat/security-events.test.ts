import { describe, expect, it, vi } from "vitest"

import {
  CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL,
  createAccountSecurityEvent,
  notifyAccountSecurityChange,
  parseAccountSecurityEvent,
} from "./security-events"

describe("chat account security events", () => {
  it("serializes a versioned, validated event without session material", () => {
    const event = createAccountSecurityEvent({
      authVersion: 3,
      eventId: "event-12345678",
      occurredAt: new Date("2026-07-25T12:00:00.000Z"),
      reason: "password_reset",
      userId: "user-12345678",
    })

    expect(parseAccountSecurityEvent(JSON.stringify(event))).toEqual(event)
    expect(parseAccountSecurityEvent(JSON.stringify({ ...event, version: 2 }))).toBeNull()
    expect(parseAccountSecurityEvent("not-json")).toBeNull()
  })

  it("publishes through an injected channel and fails without exposing the payload", async () => {
    const publish = vi.fn().mockResolvedValue(1)

    await expect(
      notifyAccountSecurityChange(
        { reason: "chat_access_revoked", userId: "user-12345678" },
        { publisher: { publish } }
      )
    ).resolves.toEqual({ delivered: true, skipped: false })

    expect(publish).toHaveBeenCalledWith(
      CHAT_ACCOUNT_SECURITY_EVENT_CHANNEL,
      expect.stringContaining('"version":1')
    )
  })

  it("does not initialize a publisher while chat is disabled", async () => {
    await expect(
      notifyAccountSecurityChange(
        { reason: "auth_version_changed", userId: "user-12345678" },
        { environment: { ARCTIC_IRC_ENABLED: "false" } }
      )
    ).resolves.toEqual({ delivered: false, skipped: true })
  })
})
