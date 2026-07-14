"use client"

import Link from "next/link"
import { useState } from "react"

const CONFIRMATION = "DELETE"

export function AccountDeletionControl() {
  const [confirmation, setConfirmation] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function deleteAccount() {
    if (confirmation !== CONFIRMATION || !currentPassword || submitting) {
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch("/api/account/deletion", {
        body: JSON.stringify({ confirmation, currentPassword }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to delete the account.")
      }

      window.location.assign("/")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete the account.")
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
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
        If you sign in only with Google and do not have a local password, request deletion at{" "}
        <a className="underline" href="mailto:support@arcticrss.com">support@arcticrss.com</a>.
      </p>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <button
        className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
        disabled={confirmation !== CONFIRMATION || !currentPassword || submitting}
        onClick={deleteAccount}
        type="button"
      >
        {submitting ? "Deleting account…" : "Delete account"}
      </button>
    </section>
  )
}
