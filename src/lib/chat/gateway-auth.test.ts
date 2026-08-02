import { describe, expect, it, vi } from "vitest"

import type { ChatGatewayUserStore } from "./gateway-auth"
import {
  ChatGatewayAuthenticationError,
  authenticateChatGatewayConnection,
  revalidateChatGatewayAuthorization,
} from "./gateway-auth"
import { issueChatConnectionToken } from "./session-token"

const secret = "test-chat-token-secret-that-is-at-least-32-bytes"
const expectedOrigin = "https://rss.example.test"
const environment = {
  ARCTIC_IRC_BETA_ALLOWLIST_ENABLED: "true",
  ARCTIC_IRC_ENABLED: "true",
}

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
        chatBetaAccess: { revokedAt: null },
        chatProfile: {
          handle: "northernlights",
          handleNormalized: "northernlights",
          id: "profile-1",
        },
        chatPolicyAcceptance: { policyVersion: "launch-policy-v1" },
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
    environment,
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
  it("records a complete authorization context for a verified, current profile", async () => {
    await expect(authenticateChatGatewayConnection(input())).resolves.toEqual({
      authVersion: 4,
      authorizedAt: expect.any(String),
      chatEnabled: true,
      emailVerified: true,
      handle: "northernlights",
      plan: "PRO",
      policyVersion: "launch-policy-v1",
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

  it("rejects a token after session revocation, suspension, or policy loss", async () => {
    await expect(
      authenticateChatGatewayConnection(input({ store: userStore({ authVersion: 5 }) }))
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)

    await expect(
      authenticateChatGatewayConnection(
        input({ store: userStore({ disabledAt: new Date() }) })
      )
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)

    await expect(
      authenticateChatGatewayConnection(
        input({ store: userStore({ chatPolicyAcceptance: { policyVersion: "old" } }) })
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

  it("catches missed revocation events during fresh authorization revalidation", async () => {
    const identity = await authenticateChatGatewayConnection(input())

    await expect(
      revalidateChatGatewayAuthorization({
        environment,
        identity,
        store: userStore({ disabledAt: new Date() }),
      })
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)

    await expect(
      revalidateChatGatewayAuthorization({
        environment,
        identity,
        store: userStore({ chatBetaAccess: { revokedAt: new Date() } }),
      })
    ).rejects.toMatchObject({ code: "invalid" } satisfies Partial<ChatGatewayAuthenticationError>)
  })
})
