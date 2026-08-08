import { describe, expect, it } from "vitest"

import {
  ACCOUNT_DELETION_HANDOFF_COOKIE,
  ACCOUNT_DELETION_HANDOFF_COOKIE_PATH,
  AccountDeletionHandoffError,
  clearAccountDeletionHandoffCookie,
  createAccountDeletionHandoff,
  getCookieValue,
  makeAccountDeletionHandoffCookie,
  verifyAccountDeletionHandoff,
} from "./account-deletion-handoff"

const secret = "account-deletion-handoff-secret-at-least-32-bytes"
const now = new Date("2026-08-08T12:00:00.000Z")
const expiresAt = new Date("2026-08-08T12:15:00.000Z")
const tokenHash = "a".repeat(64)

describe("account deletion handoff", () => {
  it("uses a signed, short-lived handoff without the raw email token", () => {
    const handoff = createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })

    expect(handoff).not.toContain("email-token")
    expect(verifyAccountDeletionHandoff(handoff, { now, secret })).toEqual({
      exp: Math.floor(expiresAt.getTime() / 1_000),
      tokenHash,
    })
  })

  it("rejects a tampered or expired handoff", () => {
    const handoff = createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })

    expect(() => verifyAccountDeletionHandoff(`${handoff}x`, { now, secret })).toThrow(
      AccountDeletionHandoffError
    )
    expect(() =>
      verifyAccountDeletionHandoff(handoff, { now: new Date("2026-08-08T12:15:00.000Z"), secret })
    ).toThrow(AccountDeletionHandoffError)
  })

  it("uses a narrow, HttpOnly cookie and can remove it", () => {
    const handoff = createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })
    const cookie = makeAccountDeletionHandoffCookie(handoff, { expiresAt, now, secure: true })

    expect(cookie).toContain(`${ACCOUNT_DELETION_HANDOFF_COOKIE}=`)
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=Lax")
    expect(cookie).toContain("Secure")
    expect(cookie).toContain(`Path=${ACCOUNT_DELETION_HANDOFF_COOKIE_PATH}`)
    expect(getCookieValue(`${cookie}; unrelated=value`, ACCOUNT_DELETION_HANDOFF_COOKIE)).toBe(handoff)
    expect(clearAccountDeletionHandoffCookie({ secure: true })).toContain("Max-Age=0")
  })
})
