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
      <AiDigestGenerator activeDigest={null} eligibleArticleCount={12} />
    )

    expect(markup).toContain("12 unread articles eligible")
    expect(markup).toContain("Generate digest")
    expect(markup).not.toContain("disabled")
  })

  it("disables duplicate generation while a digest is active", () => {
    const markup = renderToStaticMarkup(
      <AiDigestGenerator
        activeDigest={{
          id: "digest-1",
          status: "PROCESSING",
        }}
        eligibleArticleCount={12}
      />
    )

    expect(markup).toContain("Digest processing")
    expect(markup).toContain("disabled")
    expect(markup).toContain("/app/ai/digests/digest-1")
  })
})
