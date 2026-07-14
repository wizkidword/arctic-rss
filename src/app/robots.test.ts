import { describe, expect, it } from "vitest"

import robots from "./robots"

describe("robots", () => {
  it("keeps private application and authentication routes out of the crawl surface", () => {
    expect(robots()).toEqual({
      rules: {
        allow: "/",
        disallow: [
          "/admin/",
        "/api/",
        "/app/",
        "/irc/",
          "/forgot-password",
          "/login",
          "/reset-password",
          "/signup",
          "/verify-email",
        ],
        userAgent: "*",
      },
      sitemap: "https://arcticrss.com/sitemap.xml",
    })
  })
})
