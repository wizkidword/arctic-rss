import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  splitStoryClusterMemberAction: vi.fn(),
}))

import { StoryClusterSplitButton } from "./story-cluster-split-button"

describe("StoryClusterSplitButton", () => {
  it("submits only the selected source and group references", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterSplitButton
        articleId="article-1"
        clusterId="cluster-1"
        memberArticleId="article-2"
      />
    )

    expect(markup).toContain('name="articleId"')
    expect(markup).toContain('value="article-1"')
    expect(markup).toContain('name="clusterId"')
    expect(markup).toContain('value="cluster-1"')
    expect(markup).toContain('name="memberArticleId"')
    expect(markup).toContain('value="article-2"')
    expect(markup).toContain("Separate source")
  })
})
