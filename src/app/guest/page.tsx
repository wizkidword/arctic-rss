import type { Metadata } from "next"

import { ReaderSurface } from "@/components/reader-surface"
import {
  getPublicReaderArticle,
  listPublicReaderArticles,
} from "@/lib/articles"

export const dynamic = "force-dynamic"

const GUEST_READ_ONLY_REASON =
  "Create an account to star, save, summarize, mark read, or subscribe."

type GuestSearchParams = {
  articleId?: string | string[]
}

type GuestPageProps = {
  searchParams: Promise<GuestSearchParams>
}

export async function generateMetadata({
  searchParams,
}: GuestPageProps): Promise<Metadata> {
  const params = await searchParams
  const selectedArticleId = firstSearchParam(params.articleId)

  return {
    alternates: {
      canonical: "/guest",
    },
    robots: {
      follow: true,
      index: !selectedArticleId,
    },
  }
}

export default async function GuestHomePage({
  searchParams,
}: GuestPageProps) {
  const params = await searchParams
  const articles = await listPublicReaderArticles({ limit: 50 })
  const articleId = firstSearchParam(params.articleId)
  const selectedListItem = articleId
    ? articles.find((article) => article.id === articleId)
    : articles[0]
  const selectedArticle = selectedListItem
    ? await getPublicReaderArticle({ articleId: selectedListItem.id })
    : null

  return (
    <ReaderSurface
      articles={articles}
      basePath="/guest"
      defaultView="CLASSIC"
      description="Sample articles from public Discover feeds. Create an account to choose your own sources."
      displayMode="THREE_PANE"
      emptyMessage="No public preview articles are available yet. Try Discover to browse public feed sources."
      markAllReadScope={{ type: "all" }}
      readOnlyActionReason={GUEST_READ_ONLY_REASON}
      selectedArticle={selectedArticle ?? undefined}
      selectedArticleId={articleId}
      title="Browse as Guest"
    />
  )
}

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
