/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const refresh = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}))

import { AdminChatReportResolution } from "./admin-chat-report-resolution"

describe("AdminChatReportResolution", () => {
  afterEach(() => {
    refresh.mockReset()
    vi.unstubAllGlobals()
  })

  it("sends the selected retention class with an actioned resolution", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve({}), ok: true })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()

    render(<AdminChatReportResolution reportId="report-1234" />)

    await user.selectOptions(screen.getByLabelText("Retention class"), "SERIOUS")
    await user.click(screen.getByRole("button", { name: "Mark actioned" }))

    expect(fetchMock).toHaveBeenCalledWith("/api/chat/reports/report-1234", {
      body: JSON.stringify({ retentionClass: "SERIOUS", status: "ACTIONED" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    })
    expect(refresh).toHaveBeenCalledOnce()
  })
})
