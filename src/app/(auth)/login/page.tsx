import { Suspense } from "react"

import { isGoogleAuthConfigured } from "@/lib/google-auth"
import { getTurnstileSiteKey } from "@/lib/turnstile"

import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  const turnstileSiteKey = getTurnstileSiteKey()
  const googleAuthEnabled = isGoogleAuthConfigured()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Suspense>
        <LoginForm
          googleAuthEnabled={googleAuthEnabled}
          turnstileSiteKey={turnstileSiteKey}
        />
      </Suspense>
    </main>
  )
}
