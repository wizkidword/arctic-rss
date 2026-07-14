"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function ChatDiscoveryPreference({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function toggle() {
    if (saving) {
      return
    }

    setSaving(true)

    try {
      const response = await fetch("/api/chat/discovery-preferences", {
        body: JSON.stringify({ enabled: !enabled }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Unable to update discovery settings.")
      }

      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
      disabled={saving}
      onClick={toggle}
      type="button"
    >
      {enabled ? "Use non-personalized discovery" : "Enable personalized discovery"}
    </button>
  )
}
