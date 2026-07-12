import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  resendEmailVerificationAction: vi.fn(),
}))

import { EmailVerificationReminder } from "./email-verification-reminder"

describe("EmailVerificationReminder", () => {
  it("shows a small resend prompt for unverified readers", () => {
    const markup = renderToStaticMarkup(<EmailVerificationReminder />)

    expect(markup).toContain("Verify your email")
    expect(markup).toContain("Resend verification email")
  })
})
