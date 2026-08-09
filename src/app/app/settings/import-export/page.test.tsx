import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  listOpmlExportSubscriptions: vi.fn(),
  listUserOpmlImportJobs: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/auth", () => ({ auth: mocks.auth }))
vi.mock("@/app/app/actions", () => ({
  cancelOpmlImportAction: vi.fn(),
  retryOpmlImportAction: vi.fn(),
}))
vi.mock("@/components/opml-import-form", () => ({
  OpmlImportForm: () => <div>OPML import form</div>,
}))
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/components/ui/button", () => ({ buttonVariants: () => "button" }))
vi.mock("@/lib/opml", () => ({
  listOpmlExportSubscriptions: mocks.listOpmlExportSubscriptions,
}))
vi.mock("@/lib/opml-import-jobs", () => ({
  listUserOpmlImportJobs: mocks.listUserOpmlImportJobs,
}))
vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | undefined>) => values.filter(Boolean).join(" "),
}))

import ImportExportSettingsPage from "./page"

describe("ImportExportSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } })
    mocks.listOpmlExportSubscriptions.mockResolvedValue([])
    mocks.listUserOpmlImportJobs.mockResolvedValue([])
  })

  it("offers a private one-time account data download beside OPML", async () => {
    const markup = renderToStaticMarkup(await ImportExportSettingsPage())

    expect(markup).toContain('href="/api/account/export"')
    expect(markup).toContain("Export account data")
    expect(markup).toContain("This one-time download is not retained")
    expect(markup).toContain("full publisher article bodies")
  })

  it("redirects anonymous visitors to login", async () => {
    mocks.auth.mockResolvedValue(null)

    await expect(ImportExportSettingsPage()).rejects.toThrow("REDIRECT:/login")
  })
})
