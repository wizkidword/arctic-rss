import { isGoogleAuthConfigured } from "@/lib/google-auth"
import { getTurnstileSiteKey } from "@/lib/turnstile"

import { SignupForm } from "./signup-form"

export const dynamic = "force-dynamic"

export default function SignupPage() {
  const turnstileSiteKey = getTurnstileSiteKey()
  const googleAuthEnabled = isGoogleAuthConfigured()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <SignupForm
        googleAuthEnabled={googleAuthEnabled}
        turnstileSiteKey={turnstileSiteKey}
      />
    </main>
  )
}
