/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signupAction: vi.fn(),
}))

vi.mock("next-auth/react", () => ({
  signIn: mocks.signIn,
}))

vi.mock("./actions", () => ({
  signupAction: mocks.signupAction,
}))

import { SignupForm } from "./signup-form"

type TestWindow = Window & {
  gtag?: ReturnType<typeof vi.fn>
}

describe("SignupForm", () => {
  afterEach(() => {
    cleanup()
    mocks.signIn.mockReset()
    mocks.signupAction.mockReset()
    delete (window as TestWindow).gtag
  })

  it("tracks Google signup starts without sending personal data", async () => {
    const user = userEvent.setup()
    const gtag = vi.fn()
    ;(window as TestWindow).gtag = gtag

    render(<SignupForm googleAuthEnabled turnstileSiteKey="" />)

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" })
    )

    expect(gtag).toHaveBeenCalledWith("event", "sign_up_start", {
      method: "google",
    })
    expect(mocks.signIn).toHaveBeenCalledWith("google", { redirectTo: "/app" })
  })
})
