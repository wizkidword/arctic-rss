"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"

import { TurnstileWidget } from "@/components/turnstile-widget"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { trackAnalyticsEvent } from "@/lib/google-analytics-events"

type LoginFormProps = {
  googleAuthEnabled: boolean
  turnstileSiteKey: string
}

export function LoginForm({
  googleAuthEnabled,
  turnstileSiteKey,
}: LoginFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const signupTrackedRef = useRef(false)
  const registered = searchParams.get("registered") === "1"
  const reset = searchParams.get("reset") === "1"
  const verify = searchParams.get("verify") === "1"
  const verified = searchParams.get("verified") === "1"
  const verifyError = searchParams.get("verifyError") === "1"
  const oauthError = searchParams.get("error")
  const oauthAccessDenied = oauthError === "AccessDenied"
  const oauthRetryableError =
    oauthError === "Configuration" ||
    oauthError === "OAuthCallback" ||
    oauthError === "OAuthSignin"

  useEffect(() => {
    if (signupTrackedRef.current || (!registered && !verify)) {
      return
    }

    signupTrackedRef.current = true
    trackAnalyticsEvent("sign_up", { method: "email" })
  }, [registered, verify])

  function onGoogleSignIn() {
    setError("")
    setPending(true)
    void signIn("google", { redirectTo: "/app" })
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setPending(true)

    const formData = new FormData(event.currentTarget)
    const turnstileToken = String(
      formData.get("cf-turnstile-response") ?? ""
    )

    if (turnstileSiteKey && !turnstileToken) {
      setPending(false)
      setError("Complete the security check and try again.")
      return
    }

    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      turnstileToken,
      redirect: false,
    })

    setPending(false)

    if (result?.code === "email_unverified") {
      setError(
        "Verify your email before logging in. Check your inbox for the Arctic RSS link."
      )
      return
    }

    if (result?.error) {
      setError("Email or password is incorrect.")
      return
    }

    router.push("/app")
    router.refresh()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Log in to Arctic RSS</CardTitle>
        <CardDescription>
          Return to your reader shell, saved layout, and account settings.
        </CardDescription>
      </CardHeader>
      {googleAuthEnabled && (
        <CardContent className="pb-0">
          <Button
            className="w-full"
            disabled={pending}
            onClick={onGoogleSignIn}
            type="button"
            variant="outline"
          >
            <span
              aria-hidden="true"
              className="grid size-4 place-items-center rounded-full border text-[0.65rem] font-semibold"
            >
              G
            </span>
            Continue with Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </CardContent>
      )}
      <form onSubmit={onSubmit}>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            <Field data-invalid={!!error}>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  className="text-sm font-medium text-foreground underline"
                  href="/forgot-password"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!error}
                required
              />
              <FieldError>{error}</FieldError>
            </Field>
          </FieldGroup>
          <div className="mt-5">
            <TurnstileWidget action="login" siteKey={turnstileSiteKey} />
          </div>
          {registered && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Account created. Log in to continue. You can verify your email
              later from inside the reader.
            </p>
          )}
          {verify && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Account created. Check your email to verify before logging in.
            </p>
          )}
          {verified && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Email verified. Log in to continue.
            </p>
          )}
          {verifyError && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              That verification link is invalid or expired.
            </p>
          )}
          {oauthAccessDenied && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Google could not verify that email address.
            </p>
          )}
          {oauthRetryableError && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Google sign-in could not finish. Try again from this browser
              window, and allow cookies for Arctic RSS if your browser blocks
              them.
            </p>
          )}
          {reset && !error && (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              Password updated. Log in with your new password.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here?{" "}
            <Link className="font-medium text-foreground underline" href="/signup">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
