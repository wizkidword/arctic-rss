import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  bulkFeedAttentionAction: vi.fn(),
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { BulkFeedAttentionControls } from "./bulk-feed-attention-controls"

describe("BulkFeedAttentionControls", () => {
  it("requires a selection and an explicit unsubscribe confirmation", () => {
    const markup = renderToStaticMarkup(
      <BulkFeedAttentionControls
        subscriptions={[
          { id: "subscription-1", title: "Slow source" },
          { id: "subscription-2", title: "Moved source" },
        ]}
      />
    )

    expect(markup).toContain('name="subscriptionIds"')
    expect(markup).toContain("Retry selected")
    expect(markup).toContain("Pause selected")
    expect(markup).toContain("type <span class=\"font-mono text-foreground\">UNSUBSCRIBE</span>")
    expect(markup).toContain('name="confirmation"')
    expect(markup).toContain("Unsubscribe selected")
  })
})
