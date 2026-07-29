import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { StoryClusterTimeline } from "./story-cluster-timeline"

describe("StoryClusterTimeline", () => {
  it("shows a cited publication timeline and exact source headlines without claiming semantic agreement", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterTimeline
        cluster={{
          analysis: null,
          id: "cluster-1",
          members: [
            {
              articleId: "article-later",
              feedTitle: "Later Source",
              memberId: "member-later",
              publishedAt: "2026-07-28T12:00:00.000Z",
              title: "Later headline",
              url: "https://later.example/story",
            },
            {
              articleId: "article-first",
              feedTitle: "First Source",
              memberId: "member-first",
              publishedAt: "2026-07-28T10:00:00.000Z",
              title: "First headline",
              url: "https://first.example/story",
            },
            {
              articleId: "article-undated",
              feedTitle: "Undated Source",
              memberId: "member-undated",
              publishedAt: null,
              title: "Undated headline",
              url: "https://undated.example/story",
            },
          ],
          reasons: ["CANONICAL_URL"],
        }}
      />
    )

    expect(markup).toContain("Coverage timeline and source comparison")
    expect(markup).toContain("First known article")
    expect(markup).toContain("Latest source update")
    expect(markup).toContain("Headline framing by source")
    expect(markup).toContain("does not infer facts, corrections, or disagreements")
    expect(markup).toContain('href="/app/article/article-first"')
    expect(markup).toContain('href="https://first.example/story"')
    expect(markup).toContain('href="https://later.example/story"')
    expect(markup.indexOf("First headline")).toBeLessThan(
      markup.indexOf("Later headline")
    )
  })
})
