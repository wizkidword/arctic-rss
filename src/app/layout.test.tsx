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

vi.mock("@/components/google-analytics-scripts", () => ({
  GoogleAnalyticsScripts: ({
    measurementId,
  }: {
    measurementId: string | undefined
  }) => <div data-google-analytics-scripts={measurementId ?? ""} />,
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

  it("uses the configured canonical origin and does not describe the private app as open-source", () => {
    expect(String(metadata.metadataBase)).toBe(String(getAppOrigin()))
    expect(metadata.description).toBe("A calm, private RSS reader inspired by Google Reader.")
    expect(metadata.description).not.toContain("open-source")
  })
})
