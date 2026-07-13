import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrCreateUserSettings: vi.fn(),
  listArticleCollectionsForUser: vi.fn(),
  listCollectionPodcastEpisodesForUser: vi.fn(),
  listReaderArticlePage: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock("@/auth", () => ({
  auth: mocks.auth,
}))

vi.mock("@/components/reader-surface", () => ({
  ReaderSurface: ({
    articles,
    basePath,
    currentCollection,
    description,
    title,
  }: {
    articles: unknown[]
    basePath: string
    currentCollection?: { id: string; name: string }
    description: string
    title: string
  }) => (
    <main
      data-article-count={articles.length}
      data-base-path={basePath}
      data-current-collection={currentCollection?.name ?? ""}
    >
      <h1>{title}</h1>
      <p>{description}</p>
    </main>
  ),
}))

vi.mock("@/components/podcast-episode-list", () => ({
  PodcastEpisodeList: ({
    currentCollection,
    episodes,
  }: {
    currentCollection?: { id: string; name: string }
    episodes: Array<{ title: string }>
  }) => (
    <section data-current-podcast-collection={currentCollection?.name ?? ""}>
      {episodes.map((episode) => (
        <article key={episode.title}>{episode.title}</article>
      ))}
    </section>
  ),
}))

vi.mock("@/lib/article-collections", () => ({
  listArticleCollectionsForUser: mocks.listArticleCollectionsForUser,
}))

vi.mock("@/lib/articles", () => ({
  listReaderArticlePage: mocks.listReaderArticlePage,
}))

vi.mock("@/lib/podcasts", () => ({
  listCollectionPodcastEpisodesForUser:
    mocks.listCollectionPodcastEpisodesForUser,
}))

vi.mock("@/lib/preferences", () => ({
  normalizeDefaultView: () => "EXPANDED",
}))

vi.mock("@/lib/settings", () => ({
  normalizeDateTimePreferences: () => ({
    dateFormat: "DEFAULT",
    timeFormat: "DEFAULT",
    timeZone: "UTC",
  }),
  normalizeDisplayMode: () => "THREE_PANE",
}))

vi.mock("@/lib/user-settings", () => ({
  getOrCreateUserSettings: mocks.getOrCreateUserSettings,
}))

import CollectionPage from "./page"

describe("CollectionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
      },
    })
    mocks.getOrCreateUserSettings.mockResolvedValue({
      defaultView: "EXPANDED",
      displayMode: "THREE_PANE",
    })
    mocks.listArticleCollectionsForUser.mockResolvedValue([
      { articleCount: 3, id: "collection-read-later", name: "Read Later" },
    ])
    mocks.listReaderArticlePage.mockResolvedValue({
      articles: [{ id: "article-1" }],
      nextCursor: null,
    })
    mocks.listCollectionPodcastEpisodesForUser.mockResolvedValue([])
  })

  it("renders a reader surface for saved articles and episodes in the chosen collection", async () => {
    const markup = renderToStaticMarkup(
      await CollectionPage({
        params: Promise.resolve({
          collectionId: "collection-read-later",
        }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(mocks.listReaderArticlePage).toHaveBeenCalledWith({
      after: undefined,
      collectionId: "collection-read-later",
      userId: "user-1",
    })
    expect(mocks.listCollectionPodcastEpisodesForUser).toHaveBeenCalledWith({
      collectionId: "collection-read-later",
      userId: "user-1",
    })
    expect(markup).toContain("Read Later")
    expect(markup).toContain(
      "Saved articles and podcast episodes in this collection."
    )
    expect(markup).toContain('data-base-path="/app/collections/collection-read-later"')
    expect(markup).toContain('data-current-collection="Read Later"')
    expect(markup).toContain('data-article-count="1"')
  })

  it("renders a podcast section when saved episodes are in the collection", async () => {
    mocks.listCollectionPodcastEpisodesForUser.mockResolvedValue([
      {
        title: "Episode 1",
      },
    ])

    const markup = renderToStaticMarkup(
      await CollectionPage({
        params: Promise.resolve({
          collectionId: "collection-read-later",
        }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(markup).toContain("Podcast Episodes")
    expect(markup).toContain("Episode 1")
    expect(markup).toContain('data-current-podcast-collection="Read Later"')
  })

  it("renders a podcast-only collection without an empty article reader", async () => {
    mocks.listReaderArticlePage.mockResolvedValue({
      articles: [],
      nextCursor: null,
    })
    mocks.listCollectionPodcastEpisodesForUser.mockResolvedValue([
      {
        title: "Episode 1",
      },
    ])

    const markup = renderToStaticMarkup(
      await CollectionPage({
        params: Promise.resolve({
          collectionId: "collection-read-later",
        }),
        searchParams: Promise.resolve({}),
      })
    )

    expect(markup).toContain("Episode 1")
    expect(markup).toContain(
      "Saved articles and podcast episodes in this collection."
    )
    expect(markup).not.toContain('data-article-count="0"')
  })

  it("404s when the collection is not owned by the reader", async () => {
    await expect(
      CollectionPage({
        params: Promise.resolve({
          collectionId: "collection-other",
        }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("NOT_FOUND")
  })
})
