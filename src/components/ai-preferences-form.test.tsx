import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  updateAiPreferencesAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { AiPreferencesForm } from "./ai-preferences-form"

describe("AiPreferencesForm", () => {
  it("renders the user's saved AI toggle values", () => {
    const markup = renderToStaticMarkup(
      <AiPreferencesForm
        aiAutoSummariesEnabled
        dailyDigestEnabled={false}
      />
    )

    expect(markup).toContain('name="aiAutoSummariesEnabled"')
    expect(markup).toContain('name="dailyDigestEnabled"')
    expect(markup).toMatch(/name="aiAutoSummariesEnabled"[^>]*checked=""/)
    expect(markup).not.toMatch(/name="dailyDigestEnabled"[^>]*checked=""/)
    expect(markup).toContain("Automatic article summaries")
    expect(markup).toContain("Daily digest")
  })
})
