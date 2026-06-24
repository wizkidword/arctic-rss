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
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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

function createArticle(id: string, title: string): ReaderArticle {
  return {
    aiSummary: null,
    author: null,
    contentHtml: null,
    contentText: "Article body",
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
