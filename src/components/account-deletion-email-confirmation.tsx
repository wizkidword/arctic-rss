"use client"

import { useCallback, useRef, useState } from "react"

const CONFIRMATION = "DELETE"

function getConfirmationTokenFromFragment() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get("token")?.trim()

  // Fragments are not sent to the server, and removing this one immediately
  // also keeps it out of copied URLs and later client-side navigation.
  window.history.replaceState(null, "", window.location.pathname)

  return token && token.length >= 32 && token.length <= 512 ? token : null
}

export function AccountDeletionEmailConfirmation() {
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const initialized = useRef(false)

  const initializeFromFragment = useCallback((element: HTMLElement | null) => {
    if (!element || initialized.current) {
      return
    }

    initialized.current = true
    const nextToken = getConfirmationTokenFromFragment()
    setToken(nextToken)
    if (!nextToken) {
      setError("This deletion confirmation link is invalid or expired. Request a new one from Settings.")
    }
  }, [])

  async function confirmDeletion() {
    if (!token || confirmation !== CONFIRMATION || submitting) {
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch("/api/account/deletion/confirmation", {
        body: JSON.stringify({ confirmation, token }),
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
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10" ref={initializeFromFragment}>
      <section className="w-full rounded-lg border border-destructive/35 bg-destructive/5 p-5">
        <h1 className="font-heading text-2xl font-semibold text-destructive">Confirm account deletion</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This link works only for the signed-in account that requested it. Type DELETE to permanently remove that account and its reader data.
        </p>
        <label className="mt-5 grid gap-1 text-sm font-medium" htmlFor="email-account-deletion-confirmation">
          Type DELETE to confirm
          <input
            autoComplete="off"
            className="rounded-md border border-destructive/40 bg-background px-3 py-2"
            id="email-account-deletion-confirmation"
            onChange={(event) => setConfirmation(event.target.value)}
            value={confirmation}
          />
        </label>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        <button
          className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!token || confirmation !== CONFIRMATION || submitting}
          onClick={confirmDeletion}
          type="button"
        >
          {submitting ? "Deleting account…" : "Delete account"}
        </button>
      </section>
    </main>
  )
}
