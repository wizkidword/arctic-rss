import { describe, expect, it, vi } from "vitest"

import type { ChatProfileStore } from "./profiles"
import {
  ChatProfileError,
  changeChatProfileHandle,
  createChatProfileForUser,
  parseChatProfileHandle,
} from "./profiles"

describe("chat profiles", () => {
  it("creates one normalized stable handle per account", async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const create = vi.fn().mockResolvedValue({
      handle: "northern_lights",
      handleNormalized: "northern_lights",
      id: "profile-1",
      userId: "user-1",
    })
    const store = { chatProfile: { create, findUnique } } as unknown as ChatProfileStore

    await expect(
      createChatProfileForUser({
        handle: " Northern_Lights ",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({
      created: true,
      profile: {
        handle: "northern_lights",
        handleNormalized: "northern_lights",
        id: "profile-1",
        userId: "user-1",
      },
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          handle: "northern_lights",
          handleNormalized: "northern_lights",
          userId: "user-1",
        },
      })
    )
  })

  it("treats a concurrent profile for the same account as idempotent", async () => {
    const profile = {
      handle: "northernlights",
      handleNormalized: "northernlights",
      id: "profile-1",
      userId: "user-1",
    }
    const findUnique = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(profile)
    const store = {
      chatProfile: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique,
      },
    } as unknown as ChatProfileStore

    await expect(
      createChatProfileForUser({
        handle: "northernlights",
        store,
        userId: "user-1",
      })
    ).resolves.toEqual({ created: false, profile })
  })

  it("does not accept an already claimed handle or malformed request object", async () => {
    const store = {
      chatProfile: {
        create: vi.fn().mockRejectedValue({ code: "P2002" }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as ChatProfileStore

    await expect(
      createChatProfileForUser({
        handle: "northernlights",
        store,
        userId: "user-1",
      })
    ).rejects.toMatchObject({ code: "handle-unavailable" } satisfies Partial<ChatProfileError>)

    expect(() => parseChatProfileHandle({ handle: "northernlights", extra: true })).toThrow(
      "Provide a chat handle."
    )
  })

  it("only changes a handle after its 30-day cooldown", async () => {
    const update = vi.fn().mockResolvedValue({
      handle: "southernlights",
      handleNormalized: "southernlights",
      id: "profile-1",
      userId: "user-1",
    })
    const store = {
      chatProfile: {
        findUnique: vi.fn().mockResolvedValue({
          handle: "northernlights",
          handleChangedAt: new Date("2026-07-01T00:00:00.000Z"),
          handleNormalized: "northernlights",
          id: "profile-1",
          userId: "user-1",
        }),
        update,
      },
    } as unknown as ChatProfileStore

    await expect(
      changeChatProfileHandle({
        handle: "southernlights",
        now: new Date("2026-07-15T00:00:00.000Z"),
        store,
        userId: "user-1",
      })
    ).rejects.toMatchObject({ code: "handle-change-cooldown" } satisfies Partial<ChatProfileError>)
    expect(update).not.toHaveBeenCalled()

    await expect(
      changeChatProfileHandle({
        handle: "southernlights",
        now: new Date("2026-08-01T00:00:00.000Z"),
        store,
        userId: "user-1",
      })
    ).resolves.toMatchObject({ handle: "southernlights" })
  })
})
