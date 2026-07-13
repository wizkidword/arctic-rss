import { DownloadIcon, FileUpIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import {
  cancelOpmlImportAction,
  retryOpmlImportAction,
} from "@/app/app/actions"
import { OpmlImportForm } from "@/components/opml-import-form"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  listUserOpmlImportJobs,
} from "@/lib/opml-import-jobs"
import { listOpmlExportSubscriptions } from "@/lib/opml"
import { cn } from "@/lib/utils"

const importDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
})

export default async function ImportExportSettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const [subscriptions, importJobs] = await Promise.all([
    listOpmlExportSubscriptions(session.user.id),
    listUserOpmlImportJobs(session.user.id),
  ])

  return (
    <div className="flex min-h-screen flex-col gap-4 p-3 sm:p-4 lg:p-6">
      <section className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-semibold">
              Import / Export
            </h1>
            <Badge variant="secondary">
              {subscriptions.length}{" "}
              {subscriptions.length === 1 ? "subscription" : "subscriptions"}
            </Badge>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Move subscriptions between Arctic RSS and other readers with OPML.
            Folder names are preserved where possible.
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <DownloadIcon className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-base font-medium">Export OPML</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Download an OPML file containing your subscriptions and folder
            assignments.
          </p>
          <a
            className={cn(buttonVariants(), "w-fit")}
            download
            href="/api/opml/export"
          >
            <DownloadIcon data-icon="inline-start" />
            Export OPML
          </a>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileUpIcon className="size-4 text-muted-foreground" />
            <h2 className="font-heading text-base font-medium">Import OPML</h2>
          </div>
          <OpmlImportForm />
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="font-heading text-base font-medium">Recent Imports</h2>
          <p className="text-sm text-muted-foreground">
            The latest OPML import summaries for this account. Refresh this
            page to update an import that is still running.
          </p>
        </div>

        {importJobs.length ? (
          <div className="divide-y">
            {importJobs.map((job) => (
              <div
                className="grid gap-3 p-4 lg:grid-cols-[minmax(180px,1fr)_auto]"
                key={job.id}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        job.status === "FAILED" ? "destructive" : "secondary"
                      }
                    >
                      {job.status.toLowerCase()}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {importDateFormatter.format(job.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {job.processedFeeds} of {job.totalFeeds} processed · {" "}
                    {job.addedFeeds} added · {" "}
                    {job.skippedFeeds} skipped · {job.failedFeeds} failed ·{" "}
                    {job.folderCount} folders
                  </p>
                  {job.cancelRequested && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Cancel requested; the current feed will finish before the
                      import stops.
                    </p>
                  )}
                  {job.lastError && (
                    <p className="mt-2 text-sm text-destructive">
                      {job.lastError}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {job.failedFeeds > 0 && (
                    <Badge variant="outline">
                      {job.failedFeeds}{" "}
                      {job.failedFeeds === 1 ? "error" : "errors"}
                    </Badge>
                  )}
                  {(job.status === "PENDING" || job.status === "PROCESSING") &&
                    !job.cancelRequested && (
                      <form action={cancelOpmlImportAction}>
                        <input name="jobId" type="hidden" value={job.id} />
                        <button
                          className={cn(buttonVariants({ variant: "outline" }))}
                          type="submit"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  {(job.status === "CANCELED" ||
                    job.status === "FAILED" ||
                    (job.status === "COMPLETED" && job.failedFeeds > 0)) && (
                    <form action={retryOpmlImportAction}>
                      <input name="jobId" type="hidden" value={job.id} />
                      <button className={buttonVariants({ variant: "outline" })} type="submit">
                        {job.status === "CANCELED" ? "Resume" : "Retry failed"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            No OPML imports yet.
          </p>
        )}
      </section>
    </div>
  )
}
