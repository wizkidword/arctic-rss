"use client"

import { useEffect, useTransition } from "react"
import { LoaderCircleIcon, XIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { cancelBulkReadAction } from "@/app/app/actions"
import { Button } from "@/components/ui/button"
import { type BulkReadJobProgress } from "@/lib/bulk-read-jobs"

export function BulkReadProgress({
  job,
}: {
  job: BulkReadJobProgress
}) {
  const router = useRouter()
  const [isCanceling, startTransition] = useTransition()
  const percent =
    job.totalArticles === 0
      ? 100
      : Math.min(100, Math.round((job.processedArticles / job.totalArticles) * 100))

  useEffect(() => {
    const interval = window.setInterval(() => router.refresh(), 1_500)

    return () => window.clearInterval(interval)
  }, [router])

  function cancel() {
    startTransition(() => {
      void cancelBulkReadAction(job.id).then(() => router.refresh())
    })
  }

  return (
    <div className="border-b bg-sky-50 px-3 py-3 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100 sm:px-5 lg:px-6">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 text-sm">
        <LoaderCircleIcon className="size-4 animate-spin" />
        <p className="min-w-0 flex-1">
          <span className="font-medium">Marking articles as read.</span>{" "}
          {job.processedArticles.toLocaleString()} of {job.totalArticles.toLocaleString()} articles complete ({percent}%).
        </p>
        <Button
          disabled={isCanceling}
          onClick={cancel}
          size="sm"
          type="button"
          variant="outline"
        >
          <XIcon data-icon="inline-start" />
          {isCanceling ? "Canceling…" : "Cancel"}
        </Button>
      </div>
    </div>
  )
}
