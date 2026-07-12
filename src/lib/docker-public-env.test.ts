import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("docker public build environment", () => {
  it("passes the Google Analytics measurement id into the Next build", () => {
    const dockerfile = readFileSync(
      path.join(process.cwd(), "Dockerfile"),
      "utf8"
    )
    const compose = readFileSync(
      path.join(process.cwd(), "docker-compose.yml"),
      "utf8"
    )

    expect(dockerfile).toContain("ARG NEXT_PUBLIC_GA_MEASUREMENT_ID")
    expect(dockerfile).toContain(
      "ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID"
    )
    expect(compose).toContain("NEXT_PUBLIC_GA_MEASUREMENT_ID")
  })
})
