import { describe, expect, it, vi } from "vitest"

import type { ChatBlockStore } from "./blocks"
import {
  ChatBlockError,
  ignoreChatHandle,
  listChatBlockedUserIds,
  unignoreChatHandle,
} from "./blocks"

describe("chat blocks", () => {
  it("persists an idempotent ignore by handle", async () => {
    const upsert = vi.fn().mockResolvedValue({})
    const store = {
      chatBlock: { upsert },
      chatProfile: { findUnique: vi.fn().mockResolvedValue({ handle: "northernlights", userId: "user-2" }) },
    } as unknown as ChatBlockStore

    await expect(ignoreChatHandle({ handle: "NorthernLights", store, userId: "user-1" })).resolves.toEqual({ blockedUserId: "user-2", handle: "northernlights" })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { blockerUserId_blockedUserId: { blockedUserId: "user-2", blockerUserId: "user-1" } },
    }))
  })

  it("does not permit self-ignore and removes an ignore idempotently", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 })
    const store = {
      chatBlock: { deleteMany, upsert: vi.fn() },
      chatProfile: { findUnique: vi.fn().mockResolvedValue({ handle: "northernlights", userId: "user-1" }) },
    } as unknown as ChatBlockStore

    await expect(ignoreChatHandle({ handle: "northernlights", store, userId: "user-1" })).rejects.toMatchObject({ code: "invalid-request" } satisfies Partial<ChatBlockError>)
    await expect(unignoreChatHandle({ handle: "northernlights", store, userId: "user-1" })).resolves.toEqual({ blockedUserId: "user-1", handle: "northernlights" })
    expect(deleteMany).toHaveBeenCalled()
  })

  it("lists immutable blocked user IDs for shell and gateway initialization", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { blockedUserId: "user-2" },
      { blockedUserId: "user-3" },
    ])

    await expect(
      listChatBlockedUserIds({ store: { chatBlock: { findMany } } as never, userId: "user-1" })
    ).resolves.toEqual(["user-2", "user-3"])
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { blockerUserId: "user-1" },
    }))
  })
})
