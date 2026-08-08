import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock("@/app/app/saved-searches/actions", () => ({
  acknowledgeSavedSearchMonitorAction: vi.fn(),
  deleteSavedSearchAction: vi.fn(),
  setSavedSearchMonitorActionAction: vi.fn(),
  setSavedSearchMonitorEnabledAction: vi.fn(),
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  buttonVariants: () => "button",
}))

import { SavedSearchList } from "./saved-search-list"

describe("SavedSearchList", () => {
  it("lets an enabled monitor open a reviewable digest draft", () => {
    const markup = renderToStaticMarkup(
      <SavedSearchList
        savedSearches={[
          {
            collectionId: null,
            createdAt: new Date("2026-08-08T12:00:00.000Z"),
            definitionVersion: 1,
            description: null,
            folderId: "folder-1",
            id: "saved-search-1",
            monitorAction: "count",
            monitorCursorArticleId: null,
            monitorCursorCreatedAt: null,
            monitorEnabled: true,
            monitorLastRunAt: null,
            monitorNewMatchCount: 0,
            monitorNextRunAt: null,
            name: "Sea ice watch",
            publishedAfter: null,
            publishedBefore: null,
            query: "sea ice",
            state: "all",
            subscriptionId: null,
            updatedAt: new Date("2026-08-08T12:00:00.000Z"),
            userId: "user-1",
          },
        ]}
      />
    )

    expect(markup).toContain("Create digest")
    expect(markup).toContain(
      'href="/app/smart-digests/new?include=sea+ice&amp;name=Sea+ice+watch&amp;topic=sea+ice&amp;folder=folder-1&amp;sourceScope=FOLDERS"'
    )
  })
})
