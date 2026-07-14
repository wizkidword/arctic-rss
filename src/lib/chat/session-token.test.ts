import { describe, expect, it } from "vitest"

import {
  ChatConnectionTokenError,
  getChatConnectionTokenSettings,
  issueChatConnectionToken,
  verifyChatConnectionToken,
} from "./session-token"

const secret = "unit-test-signing-secret-0123456789"
const identity = {
  authVersion: 4,
  handle: "member",
  plan: "PRO" as const,
  profileId: "profile-id",
  role: "USER" as const,
  userId: "user-id",
}

describe("chat connection tokens", () => {
  it("issues a short-lived token that verifies to its payload", () => {
    const now = new Date("2026-07-14T12:00:00.000Z")
    const identifier = "unit-fixture-one-id"
    const issued = issueChatConnectionToken(identity, {
      now,
      secret,
      tokenId: identifier,
    })

    expect(verifyChatConnectionToken(issued.token, { now, secret })).toEqual(
      issued.payload
    )
    expect(issued.payload.exp - issued.payload.iat).toBe(60)
  })

  it("rejects expired and modified tokens", () => {
    const identifier = "unit-fixture-two-id"
    const issued = issueChatConnectionToken(identity, {
      now: new Date("2026-07-14T12:00:00.000Z"),
      secret,
      tokenId: identifier,
    })

    expect(
      capturedError(() =>
        verifyChatConnectionToken(issued.token, {
          now: new Date("2026-07-14T12:01:00.000Z"),
          secret,
        })
      )
    ).toMatchObject({
      code: "expired",
    } satisfies Partial<ChatConnectionTokenError>)

    const forged = `${issued.token.slice(0, -1)}x`

    expect(capturedError(() => verifyChatConnectionToken(forged, { secret }))).toMatchObject({
      code: "invalid",
    } satisfies Partial<ChatConnectionTokenError>)
  })

  it("rejects insecure token settings", () => {
    expect(
      capturedError(() =>
        getChatConnectionTokenSettings({
          ARCTIC_IRC_TOKEN_SECRET: "too-short",
        })
      )
    ).toMatchObject({
      code: "misconfigured",
    } satisfies Partial<ChatConnectionTokenError>)

    expect(
      capturedError(() =>
        getChatConnectionTokenSettings({
          ARCTIC_IRC_TOKEN_SECRET: secret,
          ARCTIC_IRC_TOKEN_TTL_SECONDS: "301",
        })
      )
    ).toMatchObject({
      code: "misconfigured",
    } satisfies Partial<ChatConnectionTokenError>)
  })
})

function capturedError(task: () => unknown) {
  try {
    task()
  } catch (error) {
    return error
  }

  throw new Error("Expected the task to throw.")
}
