import { describe, expect, it } from "vitest"

import { isAdminEmail, parseAdminEmails } from "./admin"

describe("admin email parsing", () => {
  it("normalizes comma-separated admin emails", () => {
    expect(parseAdminEmails("  OWNER@EXAMPLE.COM, admin@example.com ,, ")).toEqual([
      "owner@example.com",
      "admin@example.com",
    ])
  })

  it("checks admin access case-insensitively", () => {
    const admins = parseAdminEmails("owner@example.com")

    expect(isAdminEmail("OWNER@example.com", admins)).toBe(true)
    expect(isAdminEmail("reader@example.com", admins)).toBe(false)
    expect(isAdminEmail(null, admins)).toBe(false)
  })
})
