"use client"

import Link from "next/link"
import { useState } from "react"

const CONFIRMATION = "DELETE"

export function AccountDeletionControl({ hasLocalPassword }: { hasLocalPassword: boolean }) {
  const [confirmation, setConfirmation] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submitDeletion() {
    if (
      confirmation !== CONFIRMATION ||
      (hasLocalPassword && !currentPassword) ||
      submitting
    ) {
      return
    }

    setError(null)
    setNotice(null)
    setSubmitting(true)

    try {
      const response = await fetch(
        hasLocalPassword
          ? "/api/account/deletion"
          : "/api/account/deletion/confirmation-request",
        {
          body: JSON.stringify(
            hasLocalPassword ? { confirmation, currentPassword } : { confirmation }
          ),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      )
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to continue account deletion.")
      }

      if (hasLocalPassword) {
        window.location.assign("/")
        return
      }

      setNotice("Check your verified email for a one-time deletion confirmation link.")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to continue account deletion.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-lg border border-destructive/35 bg-destructive/5 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-medium text-destructive">Delete account</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          This permanently removes your account and reader data from primary systems. Native chat
          messages still inside their retention period are shown as <span className="font-medium">Deleted user</span>.
          See the <Link className="underline" href="/retention">Retention and Deletion Policy</Link> for limited exceptions.
        </p>
      </div>
      <label className="mt-4 grid max-w-sm gap-1 text-sm font-medium" htmlFor="account-deletion-confirmation">
        Type DELETE to confirm
        <input
          autoComplete="off"
          className="rounded-md border border-destructive/40 bg-background px-3 py-2"
          id="account-deletion-confirmation"
          onChange={(event) => setConfirmation(event.target.value)}
          value={confirmation}
        />
      </label>
      {hasLocalPassword ? (
        <label className="mt-4 grid max-w-sm gap-1 text-sm font-medium" htmlFor="account-deletion-password">
          Enter your current password
          <input
            autoComplete="current-password"
            className="rounded-md border border-destructive/40 bg-background px-3 py-2"
            id="account-deletion-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            type="password"
            value={currentPassword}
          />
        </label>
      ) : (
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          We will send a short-lived, single-use confirmation link to your verified email. The
          account is not deleted until you open it while signed in to this account and type DELETE again.
        </p>
      )}
      {notice ? <p className="mt-3 text-sm text-foreground">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <button
        className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={confirmation !== CONFIRMATION || (hasLocalPassword && !currentPassword) || submitting}
        onClick={submitDeletion}
        type="button"
      >
        {submitting
          ? hasLocalPassword
            ? "Deleting account…"
            : "Sending confirmation email…"
          : hasLocalPassword
            ? "Delete account"
            : "Send deletion confirmation email"}
      </button>
    </section>
  )
}
