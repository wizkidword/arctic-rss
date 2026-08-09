import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { BriefingsWorkflowGuide } from "./briefings-workflow-guide"

describe("BriefingsWorkflowGuide", () => {
  it("explains saved views, monitors, and digests in one progression", () => {
    const markup = renderToStaticMarkup(<BriefingsWorkflowGuide />)

    expect(markup).toContain("Search")
    expect(markup).toContain("Save view")
    expect(markup).toContain("Monitor")
    expect(markup).toContain("Smart Digest")
    expect(markup).toContain("Review results")
    expect(markup).toContain('href="/app/search"')
    expect(markup).toContain('href="/app/saved-searches"')
    expect(markup).toContain('href="/app/smart-digests"')
    expect(markup).toContain("Preview the saved view")
    expect(markup).toContain("scheduled briefing")
  })
})
