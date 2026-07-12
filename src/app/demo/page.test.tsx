import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

import DemoPage from "./page"

describe("DemoPage", () => {
  it("redirects the old demo route to guest browsing", () => {
    expect(() => DemoPage()).toThrow("REDIRECT:/guest")
    expect(mocks.redirect).toHaveBeenCalledWith("/guest")
  })
})
