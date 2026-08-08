import { createHmac, scrypt } from "node:crypto"
import { readFile } from "node:fs/promises"

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
  it("uses a signed, short-lived v2 handoff without the raw email token", async () => {
    const handoff = createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })

    expect(handoff).not.toContain("email-token")
    expect(handoff).toContain(".v2.")
    await expect(verifyAccountDeletionHandoff(handoff, { now, secret })).resolves.toEqual({
      exp: Math.floor(expiresAt.getTime() / 1_000),
      tokenHash,
    })
  })

  it("rejects malformed, tampered, wrong-version, and expired handoffs", async () => {
    const handoff = createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })
    const alteredLastSignatureCharacter = handoff.endsWith("A") ? "E" : "A"

    await expect(
      verifyAccountDeletionHandoff(`${handoff.slice(0, -1)}${alteredLastSignatureCharacter}`, { now, secret })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
    await expect(
      verifyAccountDeletionHandoff(handoff.replace(".v2.", ".v3."), { now, secret })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
    await expect(
      verifyAccountDeletionHandoff("arcticrss-account-deletion-handoff.v2.***.not-a-signature", {
        now,
        secret,
      })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
    await expect(
      verifyAccountDeletionHandoff(handoff, { now: new Date("2026-08-08T12:15:00.000Z"), secret })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
  })

  it("accepts an unexpired legacy v1 handoff without issuing new v1 handoffs", async () => {
    const legacyHandoff = await createLegacyV1Handoff({ expiresAt, tokenHash })
    const longLivedLegacyHandoff = await createLegacyV1Handoff({
      expiresAt: new Date("2026-08-08T12:16:00.000Z"),
      tokenHash,
    })

    await expect(verifyAccountDeletionHandoff(legacyHandoff, { now, secret })).resolves.toEqual({
      exp: Math.floor(expiresAt.getTime() / 1_000),
      tokenHash,
    })
    expect(createAccountDeletionHandoff({ expiresAt, tokenHash }, { now, secret })).toContain(".v2.")
    await expect(
      verifyAccountDeletionHandoff(legacyHandoff, {
        now: new Date("2026-08-08T12:15:00.000Z"),
        secret,
      })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
    await expect(verifyAccountDeletionHandoff(longLivedLegacyHandoff, { now, secret })).rejects.toBeInstanceOf(
      AccountDeletionHandoffError
    )
  })

  it("bounds handoff input and keeps invalid load off synchronous memory-hard crypto", async () => {
    const source = await readFile("src/lib/account-deletion-handoff.ts", "utf8")
    expect(source).not.toContain("scryptSync")

    const startedAt = performance.now()
    const invalidRequests = Array.from({ length: 1_000 }, () =>
      verifyAccountDeletionHandoff("not-a-handoff", { now, secret }).catch(() => undefined)
    )
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(performance.now() - startedAt).toBeLessThan(250)
    await Promise.all(invalidRequests)

    await expect(
      verifyAccountDeletionHandoff(`a${"x".repeat(ACCOUNT_DELETION_HANDOFF_COOKIE.length + 512)}`, {
        now,
        secret,
      })
    ).rejects.toBeInstanceOf(AccountDeletionHandoffError)
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

async function createLegacyV1Handoff({
  expiresAt,
  tokenHash,
}: {
  expiresAt: Date
  tokenHash: string
}) {
  const encodedPayload = Buffer.from(
    JSON.stringify({ exp: Math.floor(expiresAt.getTime() / 1_000), tokenHash }),
    "utf8"
  ).toString("base64url")
  const signingInput = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      `arcticrss-account-deletion-handoff.v1.${encodedPayload}`,
      "arcticrss-account-deletion-handoff-v1",
      32,
      { N: 16_384, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.from(derivedKey))
      }
    )
  })
  const signature = createHmac("sha256", secret).update(signingInput).digest("base64url")

  return `arcticrss-account-deletion-handoff.v1.${encodedPayload}.${signature}`
}
