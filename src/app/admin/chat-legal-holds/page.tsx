import Link from "next/link"
import { redirect } from "next/navigation"

import { requireAuthenticatedUser, requireFreshAdmin } from "@/lib/authorization"
import { AdminChatLegalHolds } from "@/components/admin-chat-legal-holds"
import { listActiveChatLegalHolds } from "@/lib/chat/legal-holds"

export const dynamic = "force-dynamic"

export default async function ChatLegalHoldsAdminPage() {
  const session = await requireAuthenticatedUser().catch(() => null)

  if (!session?.user?.id) {
    redirect("/login")
  }

  const admin = await requireFreshAdmin(session).catch(() => null)
  if (!admin) {
    redirect("/app")
  }

  const holds = await listActiveChatLegalHolds({
    identity: { role: admin.role, userId: admin.id },
  })

  return (
    <main className="min-h-screen p-4 sm:p-6">
      <section className="mx-auto max-w-4xl rounded-xl border bg-card p-5 shadow-sm sm:p-6">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">ArcticIRC</p>
            <h1 className="mt-1 text-xl font-semibold">Legal holds</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Create a scoped hold only under authorized legal, safety, abuse, fraud, or security grounds. Review every active hold within 90 days and release it when the reason ends.</p>
          </div>
          <Link className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" href="/admin">Back to admin</Link>
        </header>
        <div className="mt-6">
          <AdminChatLegalHolds holds={holds.map((hold) => ({
            ...hold,
            createdAt: hold.createdAt.toISOString(),
            reviewAt: hold.reviewAt.toISOString(),
            startedAt: hold.startedAt.toISOString(),
          }))} />
        </div>
      </section>
    </main>
  )
}
