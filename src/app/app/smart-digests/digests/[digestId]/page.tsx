import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { auth } from "@/auth"
import { SmartDigestDetail } from "@/components/smart-digest-detail"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { getSmartDigestForUser } from "@/lib/smart-digests"
import { cn } from "@/lib/utils"

export default async function SmartDigestDetailPage({
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
  const digest = await getSmartDigestForUser({
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
              {digest.title}
            </h1>
            <Badge
              variant={
                digest.status === "FAILED" ? "destructive" : "secondary"
              }
            >
              {digest.status.toLowerCase().replaceAll("_", " ")}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Smart Digest from {digest.rule.name}.
          </p>
        </div>
        <Link
          className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          href={`/app/smart-digests/${encodeURIComponent(digest.rule.id)}`}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Digest rule
        </Link>
      </section>

      <SmartDigestDetail digest={digest} />
    </div>
  )
}
