"use client"

import { FlagIcon } from "lucide-react"
import { useId, useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

const reportCategories = [
  "HARASSMENT",
  "HATE",
  "IMPERSONATION",
  "ILLEGAL_CONTENT",
  "MALWARE",
  "OTHER",
  "PERSONAL_INFO",
  "SAFETY",
  "SCAM",
  "SPAM",
] as const

export function ChatReportButton({
  label,
  messageId,
  onSubmitted,
  roomSlug,
}: {
  label: string
  messageId?: string
  onSubmitted: (notice: string) => void
  roomSlug?: string
}) {
  const categoryId = useId()
  const detailsId = useId()
  const [category, setCategory] = useState<(typeof reportCategories)[number]>("OTHER")
  const [details, setDetails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [open, setOpen] = useState(false)

  async function submitReport() {
    setError(null)
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/chat/reports", {
        body: JSON.stringify({
          category,
          details: details.trim() || undefined,
          messageId,
          roomSlug,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || "Unable to submit this report.")
      }

      setOpen(false)
      setDetails("")
      onSubmitted("Report sent to Arctic moderators.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to submit this report.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="xs" variant="ghost">
        <FlagIcon aria-hidden="true" />
        {label}
      </Button>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report to Arctic moderators</AlertDialogTitle>
            <AlertDialogDescription>
              Reports are private to the moderation queue. They do not post to
              the room or reveal your report details to other members.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="grid gap-2 text-sm font-medium" htmlFor={categoryId}>
            Category
            <select
              className="h-10 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              id={categoryId}
              onChange={(event) => setCategory(event.target.value as (typeof reportCategories)[number])}
              value={category}
            >
              {reportCategories.map((value) => (
                <option key={value} value={value}>
                  {value.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium" htmlFor={detailsId}>
            Details (optional)
            <textarea
              className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              id={detailsId}
              maxLength={1_000}
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
          </label>
          {error ? <p aria-live="polite" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button disabled={isSubmitting} onClick={submitReport}>
              {isSubmitting ? "Sending…" : "Send report"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
