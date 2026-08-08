import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { BriefingsWorkflowGuide } from "./briefings-workflow-guide"

describe("BriefingsWorkflowGuide", () => {
  it("explains saved views, monitors, and digests in one progression", () => {
    const markup = renderToStaticMarkup(<BriefingsWorkflowGuide />)

    expect(markup).toContain("Saved view")
    expect(markup).toContain("Monitor")
    expect(markup).toContain("Smart Digest")
    expect(markup).toContain("private shortcut")
    expect(markup).toContain("checks for new matches")
    expect(markup).toContain("scheduled briefing")
  })
})
