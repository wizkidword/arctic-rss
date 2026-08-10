import { describe, expect, it, vi } from "vitest"

const bcrypt = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
}))

vi.mock("bcryptjs", () => bcrypt)

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE,
  getPasswordUtf8ByteLength,
  isBcryptPasswordByteLengthValid,
} from "./password-policy"
import { hashPassword, verifyPassword } from "./password"

describe("bcrypt password byte policy", () => {
  it("measures UTF-8 bytes at the bcrypt boundary", () => {
    expect(BCRYPT_MAX_PASSWORD_BYTES).toBe(72)
    expect(getPasswordUtf8ByteLength("a".repeat(72))).toBe(72)
    expect(getPasswordUtf8ByteLength("😀".repeat(18))).toBe(72)
    expect(isBcryptPasswordByteLengthValid("😀".repeat(18))).toBe(true)
    expect(isBcryptPasswordByteLengthValid("😀".repeat(19))).toBe(false)
  })

  it("does not send over-limit passwords to bcrypt for a new hash", () => {
    expect(() => hashPassword("😀".repeat(19))).toThrow(
      BCRYPT_PASSWORD_BYTE_LIMIT_MESSAGE
    )
    expect(bcrypt.hash).not.toHaveBeenCalled()
  })

  it("returns a generic failed verification for over-limit password candidates", async () => {
    bcrypt.compare.mockResolvedValue(true)

    expect(verifyPassword("😀".repeat(19), "legacy-password-hash")).toBe(false)
    expect(bcrypt.compare).not.toHaveBeenCalled()
  })
})
