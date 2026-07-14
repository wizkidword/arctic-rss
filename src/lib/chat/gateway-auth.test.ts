import { describe, expect, it, vi } from "vitest"

import type { ChatGatewayUserStore } from "./gateway-auth"
import {
  ChatGatewayAuthenticationError,
  authenticateChatGatewayConnection,
} from "./gateway-auth"
import { issueChatConnectionToken } from "./session-token"

const secret = "test-chat-token-secret-that-is-at-least-32-bytes"
const expectedOrigin = "https://rss.example.test"

function issueToken() {
  return issueChatConnectionToken(
    {
      authVersion: 4,
      handle: "northernlights",
      plan: "PRO",
      profileId: "profile-1",
      role: "USER",
      userId: "user-1",
    },
    { secret }
  ).token
}

function userStore(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        authVersion: 4,
        chatProfile: {
          handle: "northernlights",
          handleNormalized: "northernlights",
          id: "profile-1",
        },
        disabledAt: null,
        emailVerified: new Date(),
        id: "user-1",
        plan: "PRO",
        role: "USER",
        ...overrides,
      }),
    },
  } as unknown as ChatGatewayUserStore
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    expectedOrigin,
    origin: expectedOrigin,
    replayStore: { set: vi.fn().mockResolvedValue("OK") },
    store: userStore(),
    token: issueToken(),
    tokenSecret: secret,
    ...overrides,
  }
}

describe("chat gateway authentication", () => {
  it("authenticates a verified, current profile from the canonical origin", async () => {
    await expect(authenticateChatGatewayConnection(input())).resolves.toEqual({
      handle: "northernlights",
      profileId: "profile-1",
      role: "USER",
      userId: "user-1",
    })
  })

  it("rejects forged tokens and wrong origins", async () => {
    await expect(
      authenticateChatGatewayConnection(input({ token: "forged" }))
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)

    await expect(
      authenticateChatGatewayConnection(input({ origin: "https://evil.example" }))
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)
  })

  it("rejects a token after session revocation or account suspension", async () => {
    await expect(
      authenticateChatGatewayConnection(input({ store: userStore({ authVersion: 5 }) }))
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)

    await expect(
      authenticateChatGatewayConnection(
        input({ store: userStore({ disabledAt: new Date() }) })
      )
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)
  })

  it("rejects a replayed token", async () => {
    await expect(
      authenticateChatGatewayConnection(
        input({ replayStore: { set: vi.fn().mockResolvedValue(null) } })
      )
    ).rejects.toMatchObject({ code: "replayed" } satisfies Partial<ChatGatewayAuthenticationError>)
  })
})
