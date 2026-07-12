import { describe, expect, it } from "vitest"

import { normalizeSignupInput, validateSignupInput } from "./signup"

describe("signup input", () => {
  it("normalizes email and trims display name", () => {
    expect(
      normalizeSignupInput({
        email: "  READER@EXAMPLE.COM ",
        name: "  Arctic Reader  ",
        password: "long-enough",
      })
    ).toEqual({
      email: "reader@example.com",
      name: "Arctic Reader",
      password: "long-enough",
    })
  })

  it("requires a valid email and an 8 character password", () => {
    expect(
      validateSignupInput({
        email: "not-an-email",
        name: "",
        password: "short",
      }).success
    ).toBe(false)

    expect(
      validateSignupInput({
        email: "reader@example.com",
        name: "",
        password: "long-enough",
      }).success
    ).toBe(true)
  })
})
