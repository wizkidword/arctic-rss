"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"

type LegalHold = {
  authorizedByUserId: string | null
  createdAt: string
  id: string
  reason: string
  reviewAt: string
  reviewDue: boolean
  startedAt: string
  subjectId: string
  subjectType: "CHAT_AUDIT_LOG" | "CHAT_MESSAGE" | "CHAT_REPORT"
}

type AdminChatLegalHoldsProps = {
  holds: LegalHold[]
}

export function AdminChatLegalHolds({ holds }: AdminChatLegalHoldsProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function createHold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const reviewAt = form.get("reviewAt")

    if (typeof reviewAt !== "string" || !reviewAt) {
      setError("A legal-hold review date is required.")
      return
    }

    await submit("/api/admin/chat/legal-holds", {
      method: "POST",
      body: {
        reason: form.get("reason"),
        reviewAt: new Date(reviewAt).toISOString(),
        subjectId: form.get("subjectId"),
        subjectType: form.get("subjectType"),
      },
    })
  }

  async function updateHold(holdId: string, action: "release" | "review") {
    await submit(`/api/admin/chat/legal-holds/${encodeURIComponent(holdId)}`, {
      method: "PATCH",
      body: { action },
    })
  }

  async function submit(
    url: string,
    { body, method }: { body: Record<string, unknown>; method: "PATCH" | "POST" }
  ) {
    if (saving) {
      return
    }

    setError(null)
    setSaving(true)

    try {
      const response = await fetch(url, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        method,
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to update the legal hold.")
      }

      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update the legal hold.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2" onSubmit={createHold}>
        <label className="grid gap-1 text-sm font-medium">
          Record type
          <select className="rounded-md border bg-background px-3 py-2" defaultValue="CHAT_REPORT" name="subjectType">
            <option value="CHAT_REPORT">Moderation report</option>
            <option value="CHAT_MESSAGE">Native message</option>
            <option value="CHAT_AUDIT_LOG">Chat audit record</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Record ID
          <input className="rounded-md border bg-background px-3 py-2" maxLength={128} name="subjectId" required />
        </label>
        <label className="grid gap-1 text-sm font-medium sm:col-span-2">
          Authorized reason
          <textarea
            className="min-h-24 rounded-md border bg-background px-3 py-2"
            maxLength={500}
            name="reason"
            placeholder="Record the legal or safety reason. Do not copy message content."
            required
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Review by
          <input
            className="rounded-md border bg-background px-3 py-2"
            name="reviewAt"
            required
            type="datetime-local"
          />
        </label>
        <div className="flex items-end">
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={saving} type="submit">
            Create legal hold
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

      {holds.length ? (
        <div className="divide-y rounded-lg border">
          {holds.map((hold) => (
            <article className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]" key={hold.id}>
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{hold.subjectType} · {hold.subjectId}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{hold.reason}</p>
                <p className={hold.reviewDue ? "mt-2 text-xs font-medium text-destructive" : "mt-2 text-xs text-muted-foreground"}>
                  Review {new Date(hold.reviewAt).toLocaleString()}{hold.reviewDue ? " — overdue" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button className="rounded-md border px-3 py-2 text-sm disabled:opacity-50" disabled={saving} onClick={() => updateHold(hold.id, "review")} type="button">
                  Review for 89 days
                </button>
                <button className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive disabled:opacity-50" disabled={saving} onClick={() => updateHold(hold.id, "release")} type="button">
                  Release
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">No active legal holds.</p>}
    </div>
  )
}
