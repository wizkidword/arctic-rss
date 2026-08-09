/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  resetPasswordAction: vi.fn(),
}))

vi.mock("./actions", () => ({
  resetPasswordAction: mocks.resetPasswordAction,
}))

import { ResetPasswordForm } from "./reset-password-form"

describe("ResetPasswordForm", () => {
  afterEach(() => {
    cleanup()
    mocks.resetPasswordAction.mockReset()
  })

  it("explains the UTF-8 byte limit for each new password field", () => {
    render(<ResetPasswordForm token={"x".repeat(40)} />)

    expect(
      screen.getAllByText(
        "Use at least 8 characters and no more than 72 UTF-8 bytes. Emoji and accented characters can use more than one byte."
      )
    ).toHaveLength(2)
  })
})
