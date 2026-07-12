import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listPublicReaderArticles: vi.fn(),
}))

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: (props: {
    articles: Array<{ id: string; title: string }>
    basePath: string
    description: string
    emptyMessage: string
    readOnlyActionReason?: string
    title: string
  }) => (
    <main
      data-base-path={props.basePath}
      data-read-only-action-reason={props.readOnlyActionReason ?? ""}
    >
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      <p>{props.emptyMessage}</p>
      {props.articles.map((article) => (
        <article key={article.id}>{article.title}</article>
      ))}
    </main>
  ),
}))

vi.mock("@/lib/articles", () => ({
  listPublicReaderArticles: mocks.listPublicReaderArticles,
}))

import GuestHomePage, { generateMetadata } from "./page"

describe("GuestHomePage", () => {
  beforeEach(() => {
    mocks.listPublicReaderArticles.mockResolvedValue([
      { id: "article-1", title: "Public Article" },
    ])
  })

  it("renders public reader previews in read-only guest mode", async () => {
    const markup = renderToStaticMarkup(await GuestHomePage({ searchParams: Promise.resolve({}) }))

    expect(mocks.listPublicReaderArticles).toHaveBeenCalledWith({ limit: 50 })
    expect(markup).toContain('data-base-path="/guest"')
    expect(markup).toContain("Browse as Guest")
    expect(markup).toContain(
      "Sample articles from public Discover feeds. Create an account to choose your own sources."
    )
    expect(markup).toContain("Public Article")
    expect(markup).toContain(
      "Create an account to star, save, summarize, mark read, or subscribe."
    )
  })

  it("keeps guest article selections out of search indexes and canonicalizes them to guest browsing", async () => {
    await expect(
      generateMetadata({
        searchParams: Promise.resolve({ articleId: "article-1" }),
      })
    ).resolves.toEqual({
      alternates: {
        canonical: "/guest",
      },
      robots: {
        follow: true,
        index: false,
      },
    })
  })

  it("leaves the stable guest browsing page indexable", async () => {
    await expect(
      generateMetadata({ searchParams: Promise.resolve({}) })
    ).resolves.toEqual({
      alternates: {
        canonical: "/guest",
      },
      robots: {
        follow: true,
        index: true,
      },
    })
  })
})
