import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { GoogleAnalyticsScripts } from "./google-analytics-scripts"

describe("GoogleAnalyticsScripts", () => {
  it("renders the GA4 bootstrap scripts when configured", () => {
    const markup = renderToStaticMarkup(
      <GoogleAnalyticsScripts measurementId="G-ABC123XYZ9" />
    )

    expect(markup).toContain(
      "https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9"
    )
    expect(markup).toContain("window.gtag")
    expect(markup).toContain("G-ABC123XYZ9")
  })

  it("renders nothing without a measurement id", () => {
    expect(
      renderToStaticMarkup(<GoogleAnalyticsScripts measurementId="" />)
    ).toBe("")
  })
})
