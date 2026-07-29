import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}))

vi.mock("@/app/app/actions", () => ({
  evaluateStoryClusterAction: vi.fn()
}))

vi.mock("@/components/story-cluster-dismiss-button", () => ({
  StoryClusterDismissButton: () => <button type="button">Dismiss group</button>
}))

vi.mock("@/components/story-cluster-merge-control", () => ({
  StoryClusterMergeControl: ({ clusters }: { clusters: unknown[] }) =>
    clusters.length > 1 ? <button type="button">Merge groups</button> : null
}))

vi.mock("@/components/story-cluster-split-button", () => ({
  StoryClusterSplitButton: () => <button type="button">Separate source</button>
}))

import { StoryClusterPanel } from "./story-cluster-panel"

describe("StoryClusterPanel", () => {
  it("shows transparent reasons and links without replacing original coverage", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterPanel
        articleId="article-1"
        clusters={[
          {
            id: "cluster-1",
            members: [
              {
                articleId: "article-1",
                feedTitle: "Example Feed",
                title: "Current coverage"
              },
              {
                articleId: "article-2",
                feedTitle: "Another Feed",
                title: "Related coverage"
              },
              {
                articleId: "article-3",
                feedTitle: "Third Feed",
                title: "Third coverage"
              }
            ],
            reasons: ["CANONICAL_URL", "PUBLICATION_TIME_WINDOW"]
          }
        ]}
      />
    )

    expect(markup).toContain("Related coverage")
    expect(markup).toContain("the same canonical URL")
    expect(markup).toContain("publication within 72 hours")
    expect(markup).toContain("Current coverage")
    expect(markup).toContain("Related coverage")
    expect(markup).toContain('href="/app/article/article-2"')
    expect(markup).toContain("Check again")
    expect(markup).toContain("Dismiss group")
    expect(markup).toContain("Separate source")
    expect(markup).toContain("remaining group must still have an explained connection")
    expect(markup).toContain("It preserves every original article")
  })
})
