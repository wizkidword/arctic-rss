import Link from "next/link"
import { redirect } from "next/navigation"
import { BookmarkIcon } from "lucide-react"

import { auth } from "@/auth"
import { Badge } from "@/components/ui/badge"
import { listArticleCollectionsForUser } from "@/lib/article-collections"

export default async function CollectionsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const collections = await listArticleCollectionsForUser(session.user.id)

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">Collections</h1>
            <Badge variant="secondary">
              {collections.length}{" "}
              {collections.length === 1 ? "collection" : "collections"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Saved articles and podcast episodes grouped across Arctic RSS.
          </p>
        </div>
      </section>

      {collections.length ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <Link
              className="flex min-h-28 flex-col justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
              href={`/app/collections/${collection.id}`}
              key={collection.id}
            >
              <span className="flex min-w-0 items-center gap-2">
                <BookmarkIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-heading font-semibold">
                  {collection.name}
                </span>
              </span>
              <span className="text-sm text-muted-foreground">
                {collection.articleCount}{" "}
                {collection.articleCount === 1 ? "item" : "items"}
              </span>
            </Link>
          ))}
        </section>
      ) : (
        <section className="rounded-lg border bg-card p-4">
          <h2 className="font-heading text-base font-medium">
            No collections yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use Save to collection from any article or podcast episode to
            create your first one.
          </p>
        </section>
      )}
    </div>
  )
}
