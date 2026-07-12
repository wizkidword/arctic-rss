import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/components/article-ai-summary-panel", () => ({
  ArticleAiSummaryPanel: () => null,
}))

vi.mock("@/components/article-context-menu", () => ({
  ArticleActionToolbar: ({
    article,
    currentCollection,
    variant,
  }: {
    article: { title: string }
    currentCollection?: { id: string; name: string }
    variant?: string
  }) => (
    <div
      data-action-toolbar={variant ?? "default"}
      data-current-collection={currentCollection?.name ?? ""}
    >
      Actions for {article.title}
    </div>
  ),
  ArticleContextMenu: ({
    children,
    className,
    currentCollection,
    inlineActions,
  }: {
    children: ReactNode
    className?: string
    currentCollection?: { id: string; name: string }
    inlineActions?: boolean
  }) => (
    <div
      className={className}
      data-current-collection={currentCollection?.name ?? ""}
      data-inline-actions={inlineActions ? "true" : "false"}
    >
      {children}
    </div>
  ),
}))

vi.mock("@/components/article-read-tracker", () => ({
  ArticleReadTracker: ({ articleId }: { articleId: string }) => (
    <span data-tracked-article={articleId}>Tracked {articleId}</span>
  ),
}))

vi.mock("@/components/article-state-controls", () => ({
  ArticleStateControls: () => null,
  MarkAllReadButton: () => null,
}))

vi.mock("@/components/reader-keyboard-shortcuts", () => ({
  ReaderKeyboardShortcuts: () => null,
}))

vi.mock("@/components/reader-view-switcher", () => ({
  ReaderViewSwitcher: () => null,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  CardDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  CardHeader: ({ children }: { children: ReactNode }) => (
    <header>{children}</header>
  ),
  CardTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/lib/reader-navigation", () => ({
  articleDetailHref: (articleId: string) => `/app/article/${articleId}`,
  articleSelectionHref: (basePath: string, articleId: string) =>
    `${basePath}?articleId=${articleId}`,
}))

vi.mock("@/lib/utils", () => ({
  cn: (...values: Array<string | false | null | undefined>) =>
    values.filter(Boolean).join(" "),
}))

import { ReaderSurface } from "./reader-surface"
import type { ReaderArticle } from "@/lib/articles"

const articles: ReaderArticle[] = [
  createArticle("article-1", "First unread article"),
  createArticle("article-2", "Second unread article"),
]

describe("ReaderSurface read tracking", () => {
  it("does not mark the default preview read without an explicit selection", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app/unread"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="Unread articles"
        emptyMessage="No unread articles."
        title="Unread"
      />
    )

    expect(markup).not.toContain("data-tracked-article")
  })

  it("marks an explicitly selected article read", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app/unread"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="Unread articles"
        emptyMessage="No unread articles."
        selectedArticleId="article-2"
        title="Unread"
      />
    )

    expect(markup).toContain('data-tracked-article="article-2"')
    expect(markup).not.toContain('data-tracked-article="article-1"')
  })
})

describe("ReaderSurface date and time preferences", () => {
  it("formats article timestamps with the selected reader preferences", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={[
          {
            ...articles[0],
            publishedAt: new Date("2026-06-27T13:05:00.000Z"),
          },
        ]}
        basePath="/app/unread"
        dateTimePreferences={{
          dateFormat: "YYYY_MM_DD",
          timeFormat: "HOUR_24",
          timeZone: "America/New_York",
        }}
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="Unread articles"
        emptyMessage="No unread articles."
        title="Unread"
      />
    )

    expect(markup).toContain("2026-06-27, 09:05")
  })
})

describe("ReaderSurface display modes", () => {
  it("renders reader mode as an inline article stream", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="READER"
        description="All articles"
        emptyMessage="No articles."
        title="All Articles"
      />
    )

    expect(markup).toContain('data-reader-display-mode="reader"')
    expect(markup).not.toContain("Newest stored items first")
    expect(markup.match(/Article body/g) ?? []).toHaveLength(2)
  })

  it("enables inline post actions on feed list items", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        title="All Articles"
      />
    )

    expect(markup.match(/data-inline-actions="true"/g) ?? []).toHaveLength(2)
    expect(markup.match(/data-inline-actions="false"/g) ?? []).toHaveLength(1)
  })

  it("does not duplicate selected article preview media or summary before the body", () => {
    const article = {
      ...createArticle("article-rich", "Rich article"),
      imageUrl: "https://example.com/preview.jpg",
      sanitizedContentHtml:
        '<p>Full article body.</p><img src="https://example.com/body.jpg" alt="Body image">',
      summary: "This preview text should not repeat above the article body.",
    }

    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={[article]}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        selectedArticleId="article-rich"
        title="All Articles"
      />
    )

    expect(markup).not.toContain('src="https://example.com/preview.jpg"')
    expect(markup).not.toContain(
      "This preview text should not repeat above the article body."
    )
    expect(markup).toContain("break-words")
    expect(markup).toContain("min-w-0")
    expect(markup).toContain('src="https://example.com/body.jpg"')
    expect(markup).toContain("Full article body.")
  })

  it("shows the article image inside the body when feed content has no image", () => {
    const article = {
      ...createArticle("article-image", "Image article"),
      imageUrl: "https://example.com/feed-image.jpg",
      sanitizedContentHtml: "<p>Full article body without media.</p>",
      summary: "This preview text should not repeat above the article body.",
    }

    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={[article]}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        selectedArticleId="article-image"
        title="All Articles"
      />
    )

    expect(markup.match(/src="https:\/\/example.com\/feed-image.jpg"/g) ?? [])
      .toHaveLength(1)
    expect(markup).toContain("object-contain")
    expect(markup).not.toContain("object-cover")
    expect(markup).not.toContain(
      "This preview text should not repeat above the article body."
    )
    expect(markup).toContain("Full article body without media.")
  })

  it("orders an explicitly selected article before the classic list on mobile", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        selectedArticleId="article-2"
        title="All Articles"
      />
    )

    expect(markup).toContain("order-2 xl:order-1")
    expect(markup).toContain("order-1 xl:order-2")
  })

  it("shows source favicons on classic article list rows", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles.map((article) => ({
          ...article,
          feedFaviconUrl: "https://example.com/favicon.ico",
        }))}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        title="All Articles"
      />
    )

    expect(
      markup.match(
        /src="https:\/\/www.google.com\/s2\/favicons\?domain=example.com&amp;sz=64"/g
      ) ?? []
    )
      .toHaveLength(2)
    expect(markup).toContain('alt="Example Feed icon"')
  })

  it("falls back to article domain favicons when a feed favicon is missing", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        title="All Articles"
      />
    )

    expect(markup).toContain("domain=example.com&amp;sz=64")
  })

  it("renders a persistent action toolbar for the selected article detail", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        selectedArticleId="article-2"
        title="All Articles"
      />
    )

    expect(markup).toContain('data-action-toolbar="persistent"')
    expect(markup).toContain("Actions for Second unread article")
  })

  it("embeds YouTube videos inline for selected YouTube articles", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={[
          {
            ...articles[0],
            imageUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            title: "YouTube video article",
            url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          },
        ]}
        basePath="/app"
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="All articles"
        emptyMessage="No articles."
        selectedArticleId="article-1"
        title="All Articles"
      />
    )

    expect(markup).toContain(
      'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"'
    )
    expect(markup).toContain('title="YouTube video article"')
  })

  it("passes the active collection to article menus and the detail toolbar", () => {
    const markup = renderToStaticMarkup(
      <ReaderSurface
        articles={articles}
        basePath="/app/collections/collection-later"
        currentCollection={{
          id: "collection-later",
          name: "Read Later",
        }}
        defaultView="CLASSIC"
        displayMode="THREE_PANE"
        description="Saved articles"
        emptyMessage="No saved articles."
        selectedArticleId="article-2"
        title="Read Later"
      />
    )

    expect(markup.match(/data-current-collection="Read Later"/g) ?? []).toHaveLength(
      4
    )
  })
})

function createArticle(id: string, title: string): ReaderArticle {
  return {
    aiSummary: null,
    author: null,
    contentHtml: null,
    contentText: "Article body",
    feedFaviconUrl: null,
    feedId: "feed-1",
    feedTitle: "Example Feed",
    id,
    imageUrl: null,
    isRead: false,
    isStarred: false,
    publishedAt: null,
    readAt: null,
    sanitizedContentHtml: null,
    starredAt: null,
    summary: null,
    title,
    url: `https://example.com/${id}`,
  }
}
