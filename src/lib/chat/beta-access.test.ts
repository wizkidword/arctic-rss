import { describe, expect, it, vi } from "vitest"

import {
  ChatBetaAccessError,
  grantChatBetaAccess,
  hasActiveChatBetaAccess,
  revokeChatBetaAccess,
} from "./beta-access"

function createStore({
  access,
  user = { id: "user-1" },
}: {
  access?: { revokedAt: Date | null } | null
  user?: { id: string } | null
} = {}) {
  return {
    chatAuditLog: { create: vi.fn().mockResolvedValue({}) },
    chatBetaAccess: {
      findFirst: vi.fn().mockResolvedValue(access ? { id: "access-1" } : null),
      findUnique: vi.fn().mockResolvedValue(access ?? null),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn().mockResolvedValue(user) },
  }
}

describe("chat beta access", () => {
  it("recognizes only a non-revoked access record", async () => {
    const activeStore = createStore({ access: { revokedAt: null } })
    const revokedStore = createStore({ access: { revokedAt: new Date() } })
    revokedStore.chatBetaAccess.findFirst.mockResolvedValue(null)

    await expect(hasActiveChatBetaAccess("user-1", activeStore as never)).resolves.toBe(true)
    await expect(hasActiveChatBetaAccess("user-1", revokedStore as never)).resolves.toBe(false)
    expect(revokedStore.chatBetaAccess.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { revokedAt: null, userId: "user-1" },
    })
  })

  it("grants and audits a new beta invitation", async () => {
    const store = createStore()

    await expect(
      grantChatBetaAccess({ email: " Reader@Example.test ", note: "Private beta", store: store as never })
    ).resolves.toEqual({ status: "granted" })
    expect(store.chatBetaAccess.upsert).toHaveBeenCalledWith({
      create: { note: "Private beta", userId: "user-1" },
      update: { note: "Private beta", revokedAt: null },
      where: { userId: "user-1" },
    })
    expect(store.chatAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: "chat_beta_access_granted",
        metadata: { source: "operator-cli" },
        targetUserId: "user-1",
      },
    })
  })

  it("revokes an active invitation and records the operator action", async () => {
    const store = createStore({ access: { revokedAt: null } })

    await expect(
      revokeChatBetaAccess({ email: "reader@example.test", store: store as never })
    ).resolves.toEqual({ status: "revoked" })
    expect(store.chatBetaAccess.update).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { userId: "user-1" },
    })
    expect(store.chatAuditLog.create).toHaveBeenCalledWith({
      data: {
        action: "chat_beta_access_revoked",
        metadata: { source: "operator-cli" },
        targetUserId: "user-1",
      },
    })
  })

  it("fails closed for malformed emails and missing accounts", async () => {
    await expect(
      grantChatBetaAccess({ email: "not-an-email", store: createStore() as never })
    ).rejects.toMatchObject({ code: "invalid-email" } satisfies Partial<ChatBetaAccessError>)
    await expect(
      grantChatBetaAccess({ email: "reader@example.test", store: createStore({ user: null }) as never })
    ).rejects.toMatchObject({ code: "user-not-found" } satisfies Partial<ChatBetaAccessError>)
  })
})
