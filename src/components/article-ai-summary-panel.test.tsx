import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/app/app/actions", () => ({
  generateArticleSummaryAction: vi.fn(),
}))

import { ArticleAiSummaryPanel } from "@/components/article-ai-summary-panel"

describe("ArticleAiSummaryPanel", () => {
  it("keeps AI summary tools collapsed by default so article text stays first", () => {
    const markup = renderToStaticMarkup(
      <ArticleAiSummaryPanel articleId="article-1" summary={null} />
    )

    expect(markup).toContain("<details")
    expect(markup).not.toContain("<details open")
    expect(markup).toContain("AI Summary")
    expect(markup).toContain("Open AI summary tools")
  })
})
