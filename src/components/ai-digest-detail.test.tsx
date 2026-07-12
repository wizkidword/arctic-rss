import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/lib/reader-navigation", () => ({
  articleDetailHref: (articleId: string) => `/app/article/${articleId}`,
}))

import { AiDigestDetail } from "./ai-digest-detail"

describe("AiDigestDetail", () => {
  it("renders completed items in must-read and skim-later sections", () => {
    const markup = renderToStaticMarkup(
      <AiDigestDetail
        digest={{
          articleCount: 2,
          completedAt: new Date("2026-06-23T13:05:00.000Z"),
          createdAt: new Date("2026-06-23T13:00:00.000Z"),
          errorMessage: null,
          id: "digest-1",
          items: [
            {
              articleId: "article-1",
              articleTitle: "Top story",
              articleUrl: "https://example.com/top",
              feedTitle: "Example Feed",
              id: "item-1",
              position: 0,
              publishedAt: new Date("2026-06-23T12:00:00.000Z"),
              reason: "Prioritized.",
              section: "MUST_READ",
              summary: "Top summary.",
              topic: "Technology",
            },
            {
              articleId: "article-2",
              articleTitle: "Second story",
              articleUrl: "https://example.com/second",
              feedTitle: "Example Feed",
              id: "item-2",
              position: 0,
              publishedAt: new Date("2026-06-23T11:00:00.000Z"),
              reason: "Read later.",
              section: "SKIM_LATER",
              summary: "Second summary.",
              topic: "Business",
            },
          ],
          model: "local-digest-v1",
          overview: "Two unread stories.",
          provider: "local",
          status: "COMPLETED",
          title: "Arctic digest - 2026-06-23",
        }}
      />
    )

    expect(markup).toContain("Must Read")
    expect(markup).toContain("Skim Later")
    expect(markup).toContain("Top story")
    expect(markup).toContain("Second story")
    expect(markup).toContain("/app/article/article-1")
  })
})
