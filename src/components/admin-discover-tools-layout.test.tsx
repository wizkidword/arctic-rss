import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()

  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [initialState, vi.fn(), false]),
  }
})

vi.mock("@/app/admin/actions", () => ({
  importDiscoverOpmlAction: vi.fn(),
  updateDiscoverCategoryMetadataAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

import { AdminDiscoverCategoryMetadataForm } from "./admin-discover-category-metadata-form"
import { AdminDiscoverImportForm } from "./admin-discover-import-form"

describe("Admin Discover tool layouts", () => {
  it("keeps the OPML import controls within a card-safe two-column grid", () => {
    const markup = renderToStaticMarkup(<AdminDiscoverImportForm />)

    expect(markup).toContain("sm:grid-cols-2")
    expect(markup).toContain("sm:col-span-2")
    expect(markup).not.toContain("xl:grid-cols-[")
  })

  it("gives the card description and save action full-width rows", () => {
    const markup = renderToStaticMarkup(
      <AdminDiscoverCategoryMetadataForm
        categories={[
          {
            description: "National and world reporting.",
            iconKey: "general",
            id: "us-general",
            label: "US General",
          },
        ]}
      />
    )

    expect(markup).toContain("sm:grid-cols-2")
    expect(markup.match(/sm:col-span-2/g)).toHaveLength(2)
    expect(markup).not.toContain("lg:grid-cols-[")
  })
})
