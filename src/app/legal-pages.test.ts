import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const legalPages = [
  {
    heading: "Legal",
    route: "legal",
    requiredCopy: "Privacy Policy",
  },
  {
    heading: "Privacy Policy",
    route: "privacy",
    requiredCopy: "ApprovedPolicyDocument",
  },
  {
    heading: "Terms of Service",
    route: "terms",
    requiredCopy: "ApprovedPolicyDocument",
  },
  {
    heading: "Cookie Policy",
    route: "cookies",
    requiredCopy: "ApprovedPolicyDocument",
  },
  {
    heading: "Security",
    route: "security",
    requiredCopy: "ApprovedPolicyDocument",
  },
  {
    heading: "Community Guidelines",
    route: "community",
    requiredCopy: "ApprovedPolicyDocument",
  },
  {
    heading: "Retention and Deletion",
    route: "retention",
    requiredCopy: "ApprovedPolicyDocument",
  },
]

describe("public legal pages", () => {
  it("publishes the approved-policy routes", () => {
    const missing = legalPages.filter(({ route }) => {
      const pagePath = path.join(
        process.cwd(),
        "src",
        "app",
        "(legal)",
        route,
        "page.tsx"
      )

      return !existsSync(pagePath)
    })

    expect(missing).toEqual([])

    for (const { heading, requiredCopy, route } of legalPages) {
      const pagePath = path.join(
        process.cwd(),
        "src",
        "app",
        "(legal)",
        route,
        "page.tsx"
      )
      const pageSource = readFileSync(pagePath, "utf8")

      expect(pageSource).toContain(heading)
      expect(pageSource).toContain(requiredCopy)
    }
  })
})
