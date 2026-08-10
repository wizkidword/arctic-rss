import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>()

  return {
    ...actual,
    useActionState: vi.fn((_action, initialState) => [
      initialState,
      vi.fn(),
      false,
    ]),
  }
})

vi.mock("@/app/app/actions", () => ({
  followCollectionArticleSourceAction: vi.fn(),
  removeArticleFromCollectionAction: vi.fn(),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

import { CollectionRetentionNotice } from "./collection-retention-notice"

describe("CollectionRetentionNotice", () => {
  it("explains why the saved article remains available and how final removal works", () => {
    const markup = renderToStaticMarkup(
      <CollectionRetentionNotice
        articleId="article-1"
        collectionId="collection-1"
        feedTitle="Example Source"
        savedAt="2026-08-09, 8:00 AM"
        sourceIsFollowed={false}
      />
    )

    expect(markup).toContain("Saved copy.")
    expect(markup).toContain(
      "Saved from Example Source on 2026-08-09, 8:00 AM."
    )
    expect(markup).toContain("Follow source again")
    expect(markup).toContain('name="articleId"')
    expect(markup).toContain('value="article-1"')
    expect(markup).toContain('name="collectionId"')
    expect(markup).toContain('value="collection-1"')
    expect(markup).toContain("Remove from collection")
    expect(markup).toContain(
      "If this is your last saved collection copy, removing it will remove access unless you follow the source again."
    )
  })

  it("shows a durable save without implying that a followed source is unavailable", () => {
    const markup = renderToStaticMarkup(
      <CollectionRetentionNotice
        articleId="article-1"
        collectionId="collection-1"
        feedTitle="Example Source"
        savedAt="2026-08-09, 8:00 AM"
        sourceIsFollowed
      />
    )

    expect(markup).toContain("Saved to this collection.")
    expect(markup).toContain("You still follow this source.")
    expect(markup).not.toContain("Follow source again")
    expect(markup).toContain(
      "Removing this saved copy does not affect your source subscription."
    )
  })
})
