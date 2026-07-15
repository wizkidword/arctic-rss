import { describe, expect, it, vi } from "vitest"

import { getAppOrigin } from "@/lib/app-origin"

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}))

vi.mock("@/components/google-analytics", () => ({
  GoogleAnalytics: ({ measurementId }: { measurementId: string | undefined }) => (
    <div data-google-analytics={measurementId ?? ""} />
  ),
}))

vi.mock("@/lib/google-analytics", () => ({
  getGoogleAnalyticsMeasurementId: () => "G-TEST123",
}))

import RootLayout, { metadata } from "./layout"

describe("RootLayout", () => {
  it("allows the public theme script to update html before hydration", () => {
    const element = RootLayout({ children: <main>Landing</main> })

    expect(element.type).toBe("html")
    expect(element.props.suppressHydrationWarning).toBe(true)
  })

  it("uses the configured canonical origin and a launch-accurate public description", () => {
    expect(String(metadata.metadataBase)).toBe(String(getAppOrigin()))
    expect(metadata.description).toBe(
      "A calm, browser-based RSS reader for following the open web.",
    )
    expect(metadata.description).not.toContain("open-source")
  })
})
