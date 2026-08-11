"use client"

import { useEffect } from "react"

export function MobileAuthCallbackFallback() {
  useEffect(() => {
    // Remove one-time authorization values from browser history if the App
    // Link could not open the installed app. The server never logs this URL.
    window.history.replaceState(null, "", "/mobile/auth/callback")
  }, [])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-6">
      <div>
        <h1 className="text-2xl font-semibold">Return to Arctic RSS</h1>
        <p className="mt-3 text-muted-foreground">
          Open the Arctic RSS Android app to finish signing in. No account details are shown here.
        </p>
      </div>
    </main>
  )
}
