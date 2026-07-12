import { getTurnstileSiteKey } from "@/lib/turnstile"

import { ForgotPasswordForm } from "./forgot-password-form"

export const dynamic = "force-dynamic"

export default function ForgotPasswordPage() {
  const turnstileSiteKey = getTurnstileSiteKey()

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <ForgotPasswordForm turnstileSiteKey={turnstileSiteKey} />
    </main>
  )
}
