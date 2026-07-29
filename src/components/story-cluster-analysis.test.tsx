import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("@/app/app/actions", () => ({
  generateStoryClusterAnalysisAction: vi.fn(),
}))

import { StoryClusterAnalysis } from "./story-cluster-analysis"

const cluster = {
  analysis: null,
  id: "cluster-1",
  members: [
    {
      articleId: "article-1",
      feedTitle: "First Feed",
      memberId: "member-1",
      publishedAt: "2026-07-28T10:00:00.000Z",
      title: "First source",
      url: "https://first.example/story",
    },
    {
      articleId: "article-2",
      feedTitle: "Second Feed",
      memberId: "member-2",
      publishedAt: "2026-07-28T11:00:00.000Z",
      title: "Second source",
      url: "https://second.example/story",
    },
  ],
  reasons: ["CANONICAL_URL" as const],
}

describe("StoryClusterAnalysis", () => {
  it("offers a reader-triggered analysis without creating one on render", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterAnalysis articleId="article-1" cluster={cluster} />,
    )

    expect(markup).toContain("Optional cited AI comparison")
    expect(markup).toContain("Runs only when you ask")
    expect(markup).toContain("Generate cited analysis")
    expect(markup).toContain('name="clusterId"')
    expect(markup).toContain('value="cluster-1"')
  })

  it("renders every stored statement with links to the cited original sources", () => {
    const markup = renderToStaticMarkup(
      <StoryClusterAnalysis
        articleId="article-1"
        cluster={{
          ...cluster,
          analysis: {
            claims: [
              {
                citations: ["member-1", "member-2"],
                kind: "DISAGREEMENT",
                statement: "The two sources describe the timing differently.",
              },
            ],
            model: "gpt-5.4-mini",
            provider: "openai",
            sourceCount: 2,
          },
        }}
      />,
    )

    expect(markup).toContain("Different accounts")
    expect(markup).toContain("The two sources describe the timing differently.")
    expect(markup).toContain('href="/app/article/article-1"')
    expect(markup).toContain('href="https://first.example/story"')
    expect(markup).toContain('href="https://second.example/story"')
    expect(markup).not.toContain("Generate cited analysis")
  })
})
