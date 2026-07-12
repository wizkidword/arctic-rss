import { describe, expect, it } from "vitest"

import sitemap from "./sitemap"

describe("sitemap", () => {
  it("lists only stable public routes and never guest article selections", () => {
    const urls = sitemap().map((entry) => entry.url)

    expect(urls).toEqual([
      "https://arcticrss.com",
      "https://arcticrss.com/guest",
      "https://arcticrss.com/guest/discover",
      "https://arcticrss.com/guest/podcasts/discover",
      "https://arcticrss.com/legal",
      "https://arcticrss.com/privacy",
      "https://arcticrss.com/terms",
      "https://arcticrss.com/cookies",
      "https://arcticrss.com/security",
    ])
    expect(urls.some((url) => url.includes("articleId="))).toBe(false)
  })
})
