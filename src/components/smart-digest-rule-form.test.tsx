import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/smart-digests/actions", () => ({
  createSmartDigestRuleAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { SmartDigestRuleForm } from "./smart-digest-rule-form"

describe("SmartDigestRuleForm", () => {
  it("renders rule, source, schedule, and email controls", () => {
    const markup = renderToStaticMarkup(
      <SmartDigestRuleForm
        folders={[{ id: "folder-1", name: "World News" }]}
        subscriptions={[
          {
            faviconUrl: null,
            folderId: "folder-1",
            folderName: "World News",
            id: "subscription-1",
            title: "Reuters",
          },
        ]}
      />
    )

    expect(markup).toContain("Include terms")
    expect(markup).toContain("Exclude terms")
    expect(markup).toContain("All active feeds")
    expect(markup).toContain("Selected folders")
    expect(markup).toContain("Selected feeds")
    expect(markup).toContain("Email matching digests")
    expect(markup).toContain("World News")
    expect(markup).toContain("Reuters")
  })
})
