import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  mergeStoryClustersAction: vi.fn(),
}))

import { StoryClusterMergeControl } from "./story-cluster-merge-control"

describe("StoryClusterMergeControl", () => {
  it("submits only two selected group references for the current article", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterMergeControl
        articleId="article-1"
        clusters={[
          {
            analysis: null,
            id: "cluster-1",
            members: [
              { articleId: "article-1", feedTitle: "First Feed", memberId: "member-1", publishedAt: "2026-07-28T10:00:00.000Z", title: "First story", url: "https://first.example/story" },
              { articleId: "article-2", feedTitle: "Second Feed", memberId: "member-2", publishedAt: "2026-07-28T11:00:00.000Z", title: "Second story", url: "https://second.example/story" },
            ],
            reasons: ["CANONICAL_URL"],
          },
          {
            analysis: null,
            id: "cluster-2",
            members: [
              { articleId: "article-1", feedTitle: "First Feed", memberId: "member-1", publishedAt: "2026-07-28T10:00:00.000Z", title: "First story", url: "https://first.example/story" },
              { articleId: "article-3", feedTitle: "Third Feed", memberId: "member-3", publishedAt: "2026-07-28T12:00:00.000Z", title: "Third story", url: "https://third.example/story" },
            ],
            reasons: ["NORMALIZED_TITLE"],
          },
        ]}
      />
    )

    expect(markup).toContain('name="articleId"')
    expect(markup).toContain('value="article-1"')
    expect(markup).toContain('name="firstClusterId"')
    expect(markup).toContain('name="secondClusterId"')
    expect(markup).toContain('value="cluster-1"')
    expect(markup).toContain('value="cluster-2"')
    expect(markup).toContain("Merge groups")
  })

  it("does not render a merge control for one group", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterMergeControl
        articleId="article-1"
        clusters={[
          {
            analysis: null,
            id: "cluster-1",
            members: [
              { articleId: "article-1", feedTitle: "First Feed", memberId: "member-1", publishedAt: "2026-07-28T10:00:00.000Z", title: "First story", url: "https://first.example/story" },
              { articleId: "article-2", feedTitle: "Second Feed", memberId: "member-2", publishedAt: "2026-07-28T11:00:00.000Z", title: "Second story", url: "https://second.example/story" },
            ],
            reasons: ["CANONICAL_URL"],
          },
        ]}
      />
    )

    expect(markup).toBe("")
  })
})
