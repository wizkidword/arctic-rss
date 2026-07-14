"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

type ResolutionStatus = "ACTIONED" | "DISMISSED"
type RetentionClass = "ORDINARY" | "SERIOUS"

export function AdminChatReportResolution({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [retentionClass, setRetentionClass] = useState<RetentionClass>("ORDINARY")
  const [submitting, setSubmitting] = useState<ResolutionStatus | null>(null)

  async function resolve(status: ResolutionStatus) {
    if (submitting) {
      return
    }

    setError(null)
    setSubmitting(status)

    try {
      const response = await fetch(`/api/chat/reports/${encodeURIComponent(reportId)}`, {
        body: JSON.stringify({ retentionClass, status }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to resolve this report.")
      }

      router.refresh()
    } catch (resolutionError) {
      setError(
        resolutionError instanceof Error
          ? resolutionError.message
          : "Unable to resolve this report."
      )
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 sm:justify-end">
      <label className="grid gap-1 text-left text-xs font-medium text-foreground">
        Retention class
        <select
          aria-label="Retention class"
          className="rounded-md border bg-background px-2 py-1.5 text-xs"
          disabled={Boolean(submitting)}
          onChange={(event) => setRetentionClass(event.target.value as RetentionClass)}
          value={retentionClass}
        >
          <option value="ORDINARY">Ordinary (365 days)</option>
          <option value="SERIOUS">Serious (730 days)</option>
        </select>
      </label>
      <button
        className="rounded-md border px-3 py-2 text-xs font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        disabled={Boolean(submitting)}
        onClick={() => resolve("DISMISSED")}
        type="button"
      >
        {submitting === "DISMISSED" ? "Dismissing…" : "Dismiss"}
      </button>
      <button
        className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={Boolean(submitting)}
        onClick={() => resolve("ACTIONED")}
        type="button"
      >
        {submitting === "ACTIONED" ? "Resolving…" : "Mark actioned"}
      </button>
      {error ? <p className="basis-full text-left text-xs text-destructive" role="alert">{error}</p> : null}
    </div>
  )
}
