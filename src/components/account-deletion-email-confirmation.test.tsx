/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AccountDeletionEmailConfirmation } from "./account-deletion-email-confirmation"

describe("AccountDeletionEmailConfirmation", () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    window.history.replaceState(null, "", "/")
  })

  it("keeps the email token out of the request URL and submits it only after DELETE", async () => {
    const token = "x".repeat(43)
    window.history.replaceState(null, "", `/delete-account#token=${token}`)
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ error: "Invalid confirmation." }),
      ok: false,
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    render(<AccountDeletionEmailConfirmation />)

    await waitFor(() => expect(window.location.hash).toBe(""))
    expect((screen.getByRole("button", { name: "Delete account" }) as HTMLButtonElement).disabled).toBe(true)
    await user.type(screen.getByLabelText("Type DELETE to confirm"), "DELETE")
    await user.click(screen.getByRole("button", { name: "Delete account" }))

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/account/deletion/confirmation",
      expect.objectContaining({
        body: JSON.stringify({ confirmation: "DELETE", token }),
        method: "POST",
      })
    )
  })
})
