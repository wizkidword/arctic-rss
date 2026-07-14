import { describe, expect, it, vi } from "vitest"

import {
  ChatTokenReplayError,
  consumeChatConnectionToken,
} from "./token-replay"

describe("chat connection token replay protection", () => {
  it("records the token ID for the remaining token lifetime", async () => {
    const store = { set: vi.fn().mockResolvedValue("OK") }
    const now = new Date("2026-07-14T12:00:00.000Z")

    await expect(
      consumeChatConnectionToken(
        { exp: 1_784_030_460, jti: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890" },
        store,
        now
      )
    ).resolves.toBeUndefined()

    expect(store.set).toHaveBeenCalledWith(
      "arctic-rss:chat:connection-token:v1:a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
      "1",
      "PX",
      60_000,
      "NX"
    )
  })

  it("fails closed for replayed tokens and Redis failures", async () => {
    const payload = {
      exp: Math.floor(Date.now() / 1_000) + 60,
      jti: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
    }

    await expect(
      consumeChatConnectionToken(payload, { set: vi.fn().mockResolvedValue(null) })
    ).rejects.toMatchObject({ code: "replayed" } satisfies Partial<ChatTokenReplayError>)

    await expect(
      consumeChatConnectionToken(payload, { set: vi.fn().mockRejectedValue(new Error()) })
    ).rejects.toMatchObject({ code: "unavailable" } satisfies Partial<ChatTokenReplayError>)
  })
})
