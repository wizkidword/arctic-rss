import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  dismissStoryClusterAction: vi.fn(),
}))

import { StoryClusterDismissButton } from "./story-cluster-dismiss-button"

describe("StoryClusterDismissButton", () => {
  it("submits the selected article and group without exposing other group data", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterDismissButton articleId="article-1" clusterId="cluster-1" />
    )

    expect(markup).toContain('name="articleId"')
    expect(markup).toContain('value="article-1"')
    expect(markup).toContain('name="clusterId"')
    expect(markup).toContain('value="cluster-1"')
    expect(markup).toContain("Dismiss group")
  })
})
