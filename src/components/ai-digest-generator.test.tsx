import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  generateAiDigestAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { AiDigestGenerator } from "./ai-digest-generator"

describe("AiDigestGenerator", () => {
  it("renders an enabled generation action for eligible unread articles", () => {
    const markup = renderToStaticMarkup(
      <AiDigestGenerator
        activeDigest={null}
        dailyArticleCount={12}
        weeklyArticleCount={28}
      />
    )

    expect(markup).toContain("Daily brief (12)")
    expect(markup).toContain("Weekly brief (28)")
    expect(markup).not.toContain("disabled")
  })

  it("disables duplicate generation while a digest is active", () => {
    const markup = renderToStaticMarkup(
      <AiDigestGenerator
        activeDigest={{
          id: "digest-1",
          period: "WEEKLY",
          status: "PROCESSING",
        }}
        dailyArticleCount={12}
        weeklyArticleCount={28}
      />
    )

    expect(markup).toContain("Weekly briefing processing")
    expect(markup).toContain("disabled")
    expect(markup).toContain("/app/ai/digests/digest-1")
  })
})
