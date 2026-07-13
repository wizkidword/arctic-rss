import { describe, expect, it } from "vitest"

import { GET } from "./route"

describe("GET /api/live", () => {
  it("returns a non-cacheable liveness response without dependency checks", async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ status: "ok" })
  })
})
