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
    requiredCopy: "Google Analytics",
  },
  {
    heading: "Terms of Service",
    route: "terms",
    requiredCopy: "Ko-fi tips are voluntary support",
  },
  {
    heading: "Cookie Policy",
    route: "cookies",
    requiredCopy: "Google Analytics",
  },
  {
    heading: "Security",
    route: "security",
    requiredCopy: "Vulnerability disclosure",
  },
]

describe("public legal pages", () => {
  it("publishes the expected policy routes with Arctic RSS contact copy", () => {
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
