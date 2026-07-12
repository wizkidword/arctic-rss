import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))

vi.mock("@/lib/reader-navigation", () => ({
  articleDetailHref: (articleId: string) => `/app/article/${articleId}`,
}))

import { SmartDigestDetail } from "./smart-digest-detail"

describe("SmartDigestDetail", () => {
  it("renders matched terms, email status, and grouped feed items", () => {
    const markup = renderToStaticMarkup(
      <SmartDigestDetail
        digest={{
          articleCount: 1,
          completedAt: new Date("2026-06-30T12:05:00.000Z"),
          createdAt: new Date("2026-06-30T12:00:00.000Z"),
          emailErrorMessage: null,
          emailStatus: "SENT",
          errorMessage: null,
          id: "digest-1",
          items: [
            {
              articleId: "article-1",
              articleTitle: "Climate talks resume",
              articleUrl: "https://example.com/climate",
              feedTitle: "World Desk",
              id: "item-1",
              matchedFields: ["title"],
              matchedTerms: ["climate"],
              position: 1,
              publishedAt: new Date("2026-06-30T10:00:00.000Z"),
              reason: 'Matched "climate" in title.',
              summary: "Talks resumed.",
            },
          ],
          status: "COMPLETED",
          title: "Climate Watch",
          topicPrompt: "Climate and energy policy",
        }}
      />
    )

    expect(markup).toContain("Climate and energy policy")
    expect(markup).toContain("sent")
    expect(markup).toContain("World Desk")
    expect(markup).toContain("Climate talks resume")
    expect(markup).toContain("climate")
    expect(markup).toContain('href="/app/article/article-1"')
  })
})
