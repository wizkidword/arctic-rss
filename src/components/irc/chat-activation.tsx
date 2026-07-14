"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

const activationChecks: Array<{ href?: string; id: string; label: string }> = [
  {
    id: "adult",
    label: "I confirm that I am at least 18 years old.",
  },
  {
    id: "terms",
    label: "I agree to the Terms of Service.",
    href: "/terms",
  },
  {
    id: "privacy",
    label: "I have read the Privacy Policy.",
    href: "/privacy",
  },
  {
    id: "community",
    label: "I agree to the Community Guidelines.",
    href: "/community",
  },
]

export function ChatActivation() {
  const router = useRouter()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const complete = activationChecks.every((item) => checked[item.id])

  async function submit() {
    if (!complete || submitting) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/chat/activation", {
        body: JSON.stringify({
          acceptCommunityGuidelines: true,
          acceptPrivacyPolicy: true,
          acceptTerms: true,
          attestAdult: true,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to activate ArcticIRC.")
      }

      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to activate ArcticIRC.")
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">ArcticIRC</p>
        <h1 className="mt-2 text-2xl font-semibold">Activate ArcticIRC</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          ArcticIRC is an 18+ beta. Confirm the statements below to activate chat. We record
          this confirmation, its time, your account, and the current policy version; we do not
          request a date of birth.
        </p>
        <div className="mt-5 space-y-3 text-sm">
          {activationChecks.map((item) => (
            <label className="flex gap-3" htmlFor={item.id} key={item.id}>
              <input
                checked={Boolean(checked[item.id])}
                id={item.id}
                onChange={(event) => setChecked((current) => ({ ...current, [item.id]: event.target.checked }))}
                type="checkbox"
              />
              <span>
                {item.href ? <Link className="underline" href={item.href}>{item.label}</Link> : item.label}
              </span>
            </label>
          ))}
        </div>
        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        <button
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!complete || submitting}
          onClick={submit}
          type="button"
        >
          {submitting ? "Activating…" : "Activate ArcticIRC"}
        </button>
      </section>
    </main>
  )
}
