import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

describe("Auth pages configuration", () => {
  it("routes Auth.js errors back to the login page", () => {
    const authSource = readFileSync("src/auth.ts", "utf8")

    expect(authSource).toContain('error: "/login"')
  })

  it("gates unverified credential sign-in through the verification policy", () => {
    const authSource = readFileSync("src/auth.ts", "utf8")

    expect(authSource).toContain(
      "shouldBlockLoginForUnverifiedEmail(user.emailVerified)"
    )
  })
})
