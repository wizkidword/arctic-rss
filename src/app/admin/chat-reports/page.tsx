import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { requireAuthenticatedUser, requireFreshAdmin } from "@/lib/authorization"
import { isChatEnabled } from "@/lib/chat/feature-flags"
import { listChatReports } from "@/lib/chat/moderation"
import { AdminChatReportResolution } from "@/components/admin-chat-report-resolution"

export const dynamic = "force-dynamic"

export default async function ChatReportsAdminPage() {
  const session = await requireAuthenticatedUser().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const admin = await requireFreshAdmin(session).catch(() => null)
  if (!admin) {
    redirect("/app")
  }

  if (!isChatEnabled()) {
    notFound()
  }

  const reports = await listChatReports({
    identity: { role: admin.role, userId: admin.id },
  })

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-xl border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Arctic IRC</p>
            <h1 className="mt-1 text-xl font-semibold">Open moderation reports</h1>
          </div>
          <Link className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" href="/admin">Back to admin</Link>
        </header>
        {reports.length ? (
          <div className="divide-y">
            {reports.map((report) => (
              <article className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={report.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{report.category}</span><span className="text-muted-foreground">{report.room ? `#${report.room.slug}` : "Account report"}</span>{report.target?.chatProfile?.handle ? <span className="text-muted-foreground">against {report.target.chatProfile.handle}</span> : null}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{report.details || "No reporter details provided."}</p>
                  {report.evidence ? (
                    <details className="mt-3 max-w-xl rounded border bg-muted/30 p-2 text-xs">
                      <summary className="cursor-pointer font-medium">Restricted evidence metadata</summary>
                      <p className="mt-2 text-muted-foreground">Captured {report.evidence.createdAt.toLocaleString()}. Message bodies are never copied into this record.</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5">{JSON.stringify(report.evidence.snapshot, null, 2)}</pre>
                    </details>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground sm:text-right"><p>{report.status}</p><p className="mt-1">{report.createdAt.toLocaleString()}</p><p className="mt-1 font-mono">{report.id}</p><AdminChatReportResolution reportId={report.id} /></div>
              </article>
            ))}
          </div>
        ) : <p className="px-5 py-12 text-center text-sm text-muted-foreground">No open chat reports.</p>}
      </section>
    </main>
  )
}
