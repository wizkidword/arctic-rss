import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

describe("approved release command", () => {
  it("enables the opt-in chat profile before building the chat gateway", async () => {
    const script = await readFile("scripts/windows/deploy-approved-release.ps1", "utf8")

    expect(script).toContain(
      'docker compose -p "$compose_project" --project-directory "$stage" --profile chat build migrate web worker chat-gateway',
    )
  })
})
