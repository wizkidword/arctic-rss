import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { auth } from "@/auth"
import { AiDigestDetail } from "@/components/ai-digest-detail"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getAiDigestForUser } from "@/lib/ai-digests"
import { cn } from "@/lib/utils"

export default async function AiDigestPage({
  params,
}: {
  params: Promise<{
    digestId: string
  }>
}) {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const { digestId } = await params
  const digest = await getAiDigestForUser({
    digestId,
    userId: session.user.id,
  })

  if (!digest) {
    notFound()
  }

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">
              {digest.title || "AI Digest"}
            </h1>
            <Badge
              variant={
                digest.status === "FAILED" ? "destructive" : "secondary"
              }
            >
              {digest.status.toLowerCase()}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Stored unread digest for your Arctic RSS account.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          href="/app/ai"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          AI Summaries
        </Link>
      </section>

      <AiDigestDetail
        digest={{
          articleCount: digest.articleCount ?? 0,
          completedAt: digest.completedAt ?? null,
          createdAt: digest.createdAt || new Date(),
          errorMessage: digest.errorMessage ?? null,
          id: digest.id,
          items: digest.items ?? [],
          model: digest.model ?? null,
          overview: digest.overview ?? null,
          provider: digest.provider ?? null,
          status: digest.status,
          title: digest.title ?? null,
        }}
      />
    </div>
  )
}
