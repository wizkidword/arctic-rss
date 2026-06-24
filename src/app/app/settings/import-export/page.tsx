import { DownloadIcon, FileUpIcon } from "lucide-react"
import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { OpmlImportForm } from "@/components/opml-import-form"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { listOpmlExportSubscriptions, listUserImportJobs } from "@/lib/opml"
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
    listUserImportJobs(session.user.id),
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
            The latest OPML import summaries for this account.
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
                    {job.totalFeeds} total · {job.addedFeeds} added ·{" "}
                    {job.skippedFeeds} skipped · {job.failedFeeds} failed ·{" "}
                    {job.folderCount} folders
                  </p>
                </div>
                {job.errorCount > 0 && (
                  <Badge variant="outline">
                    {job.errorCount}{" "}
                    {job.errorCount === 1 ? "error" : "errors"}
                  </Badge>
                )}
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
